import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventStore } from '../src/sync/event-store.js';
import { createSyncClient } from '../src/sync/sync-client.js';

// Plain stub functions — no mock.method on ESM modules.
function fakeStore() {
  const state = new Map();
  let nextKey = 1;
  return {
    state,
    async appendEvent(ev) {
      const rec = { ...ev, key: nextKey++, status: 'pending', quarantineCode: null };
      state.set(rec.key, rec);
      return rec;
    },
    async listUnsynced(limit = 50) {
      return [...state.values()].filter((e) => e.status === 'pending').sort((a, b) =>
        a.client_created_at - b.client_created_at || a.key - b.key).slice(0, limit);
    },
    async markSynced(keys) { for (const k of keys) { const r = state.get(k); if (r) { r.status = 'synced'; } } },
    async markQuarantined(key, code) { const r = state.get(key); if (r) { r.status = 'quarantined'; r.quarantineCode = code; } },
    async listEvents() { return [...state.values()]; },
  };
}

function makeFetch(handler) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return handler(JSON.parse(init.body)); };
  f.calls = calls;
  return f;
}

const okResponse = (results) => new Response(JSON.stringify(results), { status: 200 });
const eventsOf = (call) => call.body.events;

test('all four statuses: accepted/duplicate → synced; conflict/invalid → quarantined', async () => {
  const store = fakeStore();
  const evs = [];
  for (const t of ['a', 'b', 'c', 'd']) evs.push(await store.appendEvent({ type: t, client_created_at: 1 }));
  const fetchStub = makeFetch(() => okResponse([
    { key: evs[0].key, status: 'accepted' },
    { key: evs[1].key, status: 'duplicate' },
    { key: evs[2].key, status: 'conflict' },
    { key: evs[3].key, status: 'invalid', code: 'schema_error' },
  ]));
  const client = createSyncClient({ fetch: fetchStub, store, sleep: async () => {} });
  await client.syncOnce();
  assert.equal(store.state.get(evs[0].key).status, 'synced');
  assert.equal(store.state.get(evs[1].key).status, 'synced');
  assert.equal(store.state.get(evs[2].key).status, 'quarantined');
  assert.equal(store.state.get(evs[2].key).quarantineCode, 'conflict');
  assert.equal(store.state.get(evs[3].key).status, 'quarantined');
  assert.equal(store.state.get(evs[3].key).quarantineCode, 'schema_error');
});

test('429 → backoff with Retry-After then success', async () => {
  const store = fakeStore();
  await store.appendEvent({ type: 'x', client_created_at: 1 });
  const sleeps = [];
  let calls = 0;
  const fetchStub = makeFetch(() => {
    calls += 1;
    return calls === 1
      ? new Response('slow down', { status: 429, headers: { 'retry-after': '2' } })
      : okResponse([{ key: 1, status: 'accepted' }]);
  });
  const client = createSyncClient({ fetch: fetchStub, store, sleep: async (ms) => { sleeps.push(ms); } });
  await client.syncOnce();
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [2000]);
  assert.equal(store.state.get(1).status, 'synced');
});

for (const code of [413, 422]) {
  test(`${code} on whole batch → split in half and retry each half`, async () => {
    const store = fakeStore();
    const evs = [];
    for (let i = 0; i < 4; i++) evs.push(await store.appendEvent({ type: `e${i}`, client_created_at: i }));
    const fetchStub = makeFetch(({ events }) => events.length > 2
      ? new Response('too big', { status: code })
      : okResponse(events.map((e) => ({ key: e.key, status: 'accepted' }))));
    const client = createSyncClient({ fetch: fetchStub, store, sleep: async () => {} });
    await client.syncOnce();
    assert.equal(fetchStub.calls.length, 3); // 1 failing + 2 halves
    assert.equal(eventsOf(fetchStub.calls[0]).length, 4);
    assert.equal(eventsOf(fetchStub.calls[1]).length, 2);
    assert.equal(eventsOf(fetchStub.calls[2]).length, 2);
    assert.ok(evs.every((e) => store.state.get(e.key).status === 'synced'));
  });
}

for (const code of [410, 401]) {
  test(`${code} → stop sync, nothing deleted`, async () => {
    const store = fakeStore();
    await store.appendEvent({ type: 'a', client_created_at: 1 });
    await store.appendEvent({ type: 'b', client_created_at: 2 });
    const fetchStub = makeFetch(() => new Response('gone', { status: code }));
    const client = createSyncClient({ fetch: fetchStub, store, sleep: async () => {} });
    const result = await client.syncOnce();
    assert.equal(result.stopped, true);
    assert.equal(fetchStub.calls.length, 1); // no retry
    assert.ok([...store.state.values()].every((e) => e.status === 'pending')); // nothing removed
  });
}

test('network error → exponential backoff + jitter, capped', async () => {
  const store = fakeStore();
  await store.appendEvent({ type: 'x', client_created_at: 1 });
  const sleeps = [];
  let calls = 0;
  const fetchStub = makeFetch(() => {
    calls += 1;
    if (calls <= 3) throw new Error('connection reset');
    return okResponse([{ key: 1, status: 'accepted' }]);
  });
  const client = createSyncClient({
    fetch: fetchStub, store,
    baseDelayMs: 100, maxDelayMs: 300,   // cap below the 3rd retry's 400ms
    jitter: () => 0.5,                   // deterministic jitter (delay = exp * 1.5)
    sleep: async (ms) => { sleeps.push(ms); },
  });
  await client.syncOnce();
  assert.equal(calls, 4);
  // 100*1.5=150, 200*1.5=300, then capped at 300*1.5 → 300
  assert.deepEqual(sleeps, [150, 300, 300]);
  assert.equal(store.state.get(1).status, 'synced');
});

test('idempotency: same batch submitted twice only syncs once', async () => {
  const store = await createEventStore({ dbName: 'idem-db' });
  await store.appendEvent({ type: 'x', client_created_at: 1 });
  await store.appendEvent({ type: 'y', client_created_at: 2 });
  const fetchStub = makeFetch(({ events }) => okResponse(events.map((e) => ({ key: e.key, status: 'accepted' }))));
  const client = createSyncClient({ fetch: fetchStub, store, sleep: async () => {} });
  await client.syncOnce();
  await client.syncOnce(); // second run: nothing pending, no fetch
  assert.equal(fetchStub.calls.length, 1);
  const all = await store.listEvents();
  assert.ok(all.every((e) => e.status === 'synced'));
});

test('120 events are split into batches of 50, 50, 20', async () => {
  const store = await createEventStore({ dbName: 'batch-db' });
  for (let i = 0; i < 120; i++) await store.appendEvent({ type: `e${i}`, client_created_at: i });
  const fetchStub = makeFetch(({ events }) => okResponse(events.map((e) => ({ key: e.key, status: 'accepted' }))));
  const client = createSyncClient({ fetch: fetchStub, store, sleep: async () => {} });
  await client.syncOnce();
  assert.deepEqual(fetchStub.calls.map((c) => eventsOf(c).length), [50, 50, 20]);
  const all = await store.listEvents();
  assert.ok(all.every((e) => e.status === 'synced'));
});
