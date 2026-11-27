// CI runs `npm test` without installing dev dependencies, so tests that need fake-indexeddb
// skip loudly instead of failing. Run `npm install` locally to execute them.
const hasIdb = await import('fake-indexeddb/auto').then(() => true, () => false);
const idb = { skip: !hasIdb && 'fake-indexeddb not installed (npm install)' };
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createEventStore } from '../src/sync/event-store.js';
import { createSyncClient, toWire } from '../src/sync/sync-client.js';

// Plain stubs, no mock.method on ESM modules.
const iso = (i) => new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString();
const ev = (i) => ({
  idempotency_key: randomUUID(), type: 'attempt', schema_version: 1,
  client_created_at: iso(i), content_id: `drill-${i}`, content_version: 1,
  skill_ids: ['loops'], payload: { typed: `x${i}` },
});

function fakeStore() {
  const state = new Map();
  let nextKey = 1;
  return {
    state,
    async appendEvent(e) { const r = { ...e, key: nextKey++, status: 'pending', quarantineCode: null }; state.set(r.key, r); return r; },
    async listUnsynced(limit = 50) {
      return [...state.values()].filter((e) => e.status === 'pending')
        .sort((a, b) => a.key - b.key).slice(0, limit);
    },
    async markSynced(keys) { for (const k of keys) state.get(k) && (state.get(k).status = 'synced'); },
    async markQuarantined(key, code) { const r = state.get(key); if (r) { r.status = 'quarantined'; r.quarantineCode = code; } },
    async listEvents() { return [...state.values()]; },
  };
}
async function seeded(n) { const s = fakeStore(); for (let i = 0; i < n; i++) await s.appendEvent(ev(i)); return s; }

function makeFetch(handler) {
  const calls = [];
  const f = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    return handler(body, calls.length);
  };
  f.calls = calls;
  return f;
}
// Contract-shaped 200: results answer by index.
const results = (rows) => new Response(JSON.stringify({ results: rows, server_received_at: iso(0) }), { status: 200 });
const allAccepted = ({ events }) => results(events.map((e, index) => ({ index, idempotency_key: e.idempotency_key, status: 'accepted' })));
const statusOnly = (s, h) => new Response('', { status: s, headers: h });
const client = (o) => createSyncClient({ sleep: async () => {}, ...o });

test('wire format: contract endpoint, only contract fields, no local bookkeeping', async () => {
  const store = await seeded(1);
  const f = makeFetch(allAccepted);
  await client({ fetch: f, store }).syncOnce();
  assert.equal(f.calls[0].url, '/v1/events');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.deepEqual(Object.keys(f.calls[0].body.events[0]).sort(), Object.keys(toWire(ev(0))).sort());
  for (const local of ['key', 'status', 'quarantineCode']) assert.ok(!(local in f.calls[0].body.events[0]));
});

test('all four statuses by index: accepted/duplicate → synced; conflict/invalid → quarantined', async () => {
  const store = await seeded(4);
  const f = makeFetch(({ events }) => results([
    { index: 0, idempotency_key: events[0].idempotency_key, status: 'accepted' },
    { index: 1, idempotency_key: events[1].idempotency_key, status: 'duplicate' },
    { index: 2, idempotency_key: events[2].idempotency_key, status: 'conflict', code: 'hash_mismatch' },
    { index: 3, idempotency_key: null, status: 'invalid', code: 'invalid_event' },
  ]));
  const r = await client({ fetch: f, store }).syncOnce();
  const s = (k) => store.state.get(k);
  assert.deepEqual([1, 2, 3, 4].map((k) => s(k).status), ['synced', 'synced', 'quarantined', 'quarantined']);
  assert.equal(s(3).quarantineCode, 'hash_mismatch');
  assert.equal(s(4).quarantineCode, 'invalid_event');
  assert.equal(r.stopped, false);
});

test('results are matched by index, not by order of the results array', async () => {
  const store = await seeded(2);
  const f = makeFetch(({ events }) => results([
    { index: 1, idempotency_key: events[1].idempotency_key, status: 'conflict', code: 'c' },
    { index: 0, idempotency_key: events[0].idempotency_key, status: 'accepted' },
  ]));
  await client({ fetch: f, store }).syncOnce();
  assert.equal(store.state.get(1).status, 'synced');
  assert.equal(store.state.get(2).status, 'quarantined');
});

test('429 → waits Retry-After then succeeds', async () => {
  const store = await seeded(1);
  const sleeps = [];
  const f = makeFetch((b, n) => (n === 1 ? statusOnly(429, { 'retry-after': '2' }) : allAccepted(b)));
  await client({ fetch: f, store, sleep: async (ms) => { sleeps.push(ms); } }).syncOnce();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(sleeps, [2000]);
  assert.equal(store.state.get(1).status, 'synced');
});

test('429 forever → stops with reason, events stay pending, no throw', async () => {
  const store = await seeded(1);
  const f = makeFetch(() => statusOnly(429, { 'retry-after': '0' }));
  const r = await client({ fetch: f, store }).syncOnce();
  assert.deepEqual([r.stopped, r.reason], [true, 'rate_limited']);
  assert.equal(store.state.get(1).status, 'pending');
});

for (const code of [413, 422]) {
  test(`${code} on a batch → split in half and retry each half`, async () => {
    const store = await seeded(4);
    const f = makeFetch((b) => (b.events.length > 2 ? statusOnly(code) : allAccepted(b)));
    await client({ fetch: f, store }).syncOnce();
    assert.deepEqual(f.calls.map((c) => c.body.events.length), [4, 2, 2]);
    assert.ok([...store.state.values()].every((e) => e.status === 'synced'));
  });

  test(`${code} on a single event → that event is quarantined, the rest still sync (no infinite split)`, async () => {
    const store = await seeded(3);
    const poison = store.state.get(2).idempotency_key;
    const f = makeFetch((b) => (b.events.some((e) => e.idempotency_key === poison) ? statusOnly(code) : allAccepted(b)));
    const r = await client({ fetch: f, store }).syncOnce();
    assert.equal(r.stopped, false);
    assert.ok(f.calls.length < 10, `bounded calls, got ${f.calls.length}`);
    assert.equal(store.state.get(2).status, 'quarantined');
    assert.equal(store.state.get(2).quarantineCode, `http_${code}`);
    assert.deepEqual([1, 3].map((k) => store.state.get(k).status), ['synced', 'synced']);
  });
}

for (const code of [410, 401]) {
  test(`${code} → stop, nothing deleted, no retry`, async () => {
    const store = await seeded(2);
    const f = makeFetch(() => statusOnly(code));
    const r = await client({ fetch: f, store }).syncOnce();
    assert.deepEqual([r.stopped, r.reason], [true, `http_${code}`]);
    assert.equal(f.calls.length, 1);
    assert.ok([...store.state.values()].every((e) => e.status === 'pending'));
  });

  test(`${code} inside a batch that was split → the whole sync stops (stop flag is not lost)`, async () => {
    const store = await seeded(4);
    const f = makeFetch((b) => statusOnly(b.events.length > 2 ? 413 : code));
    const r = await client({ fetch: f, store }).syncOnce();
    assert.equal(r.stopped, true);
    assert.deepEqual(f.calls.map((c) => c.body.events.length), [4, 2]); // second half never tried
    assert.ok([...store.state.values()].every((e) => e.status === 'pending'));
  });
}

test('network error → exponential backoff + jitter, capped after jitter', async () => {
  const store = await seeded(1);
  const sleeps = [];
  const f = makeFetch((b, n) => { if (n <= 3) throw new Error('connection reset'); return allAccepted(b); });
  await client({
    fetch: f, store, baseDelayMs: 100, maxDelayMs: 300, jitter: () => 0.5,
    sleep: async (ms) => { sleeps.push(ms); },
  }).syncOnce();
  assert.equal(f.calls.length, 4);
  assert.deepEqual(sleeps, [150, 300, 300]);
  assert.equal(store.state.get(1).status, 'synced');
});

test('5xx is transient; giving up returns a reason instead of throwing', async () => {
  const store = await seeded(1);
  const f = makeFetch(() => statusOnly(503));
  const r = await client({ fetch: f, store, maxRetries: 2 }).syncOnce();
  assert.deepEqual([r.stopped, r.reason], [true, 'network']);
  assert.equal(f.calls.length, 3);
  assert.equal(store.state.get(1).status, 'pending');
});

test('other 4xx (e.g. 404 wrong endpoint) is not retried', async () => {
  const store = await seeded(1);
  const f = makeFetch(() => statusOnly(404));
  const r = await client({ fetch: f, store }).syncOnce();
  assert.deepEqual([r.stopped, r.reason, f.calls.length], [true, 'http_404', 1]);
});

test('a 200 that settles nothing stops instead of re-sending forever', async () => {
  const store = await seeded(2);
  const f = makeFetch(() => results([]));
  const r = await client({ fetch: f, store }).syncOnce();
  assert.deepEqual([r.stopped, r.reason, f.calls.length], [true, 'no_progress', 1]);
});

test('a non-JSON 200 stops with bad_response', async () => {
  const store = await seeded(1);
  const f = makeFetch(() => new Response('<html>', { status: 200 }));
  assert.equal((await client({ fetch: f, store }).syncOnce()).reason, 'bad_response');
});

test('real IndexedDB store: second syncOnce sends nothing', idb, async () => {
  const store = await createEventStore({ dbName: 'idem-db' });
  await store.appendEvent(ev(1)); await store.appendEvent(ev(2));
  const f = makeFetch(allAccepted);
  const c = client({ fetch: f, store });
  await c.syncOnce(); await c.syncOnce();
  assert.equal(f.calls.length, 1);
  assert.ok((await store.listEvents()).every((e) => e.status === 'synced'));
});

test('real IndexedDB store: 120 events → batches of 50, 50, 20', idb, async () => {
  const store = await createEventStore({ dbName: 'batch-db' });
  for (let i = 0; i < 120; i++) await store.appendEvent(ev(i));
  const f = makeFetch(allAccepted);
  await client({ fetch: f, store }).syncOnce();
  assert.deepEqual(f.calls.map((c) => c.body.events.length), [50, 50, 20]);
});
