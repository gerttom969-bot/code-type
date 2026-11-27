// CI runs `npm test` without installing dev dependencies, so tests that need fake-indexeddb
// skip loudly instead of failing. Run `npm install` locally to execute them.
const hasIdb = await import('fake-indexeddb/auto').then(() => true, () => false);
const idb = { skip: !hasIdb && 'fake-indexeddb not installed (npm install)' };
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventStore } from '../src/sync/event-store.js';

let n = 0;
const freshStore = () => createEventStore({ dbName: `test-db-${++n}` });

test('appendEvent stores with pending status and assigns incrementing keys', idb, async () => {
  const store = await freshStore();
  const a = await store.appendEvent({ type: 'x', client_created_at: 200 });
  const b = await store.appendEvent({ type: 'y', client_created_at: 100 });
  assert.ok(a.key < b.key);
  assert.equal(a.status, 'pending');
  assert.equal(a.quarantineCode, null);
});

test('listEvents orders by client_created_at', idb, async () => {
  const store = await freshStore();
  await store.appendEvent({ type: 'c', client_created_at: 300 });
  await store.appendEvent({ type: 'a', client_created_at: 100 });
  await store.appendEvent({ type: 'b', client_created_at: 200 });
  const types = (await store.listEvents()).map((e) => e.type);
  assert.deepEqual(types, ['a', 'b', 'c']);
});

test('equal client_created_at falls back to insertion order (stable tie-breaker)', idb, async () => {
  const store = await freshStore();
  await store.appendEvent({ type: 'first', client_created_at: 1000 });
  await store.appendEvent({ type: 'second', client_created_at: 1000 });
  await store.appendEvent({ type: 'third', client_created_at: 1000 });
  await store.appendEvent({ type: 'earlier', client_created_at: 500 });
  const types = (await store.listEvents()).map((e) => e.type);
  assert.deepEqual(types, ['earlier', 'first', 'second', 'third']);
});

test('listUnsynced excludes synced/quarantined and respects limit', idb, async () => {
  const store = await freshStore();
  const events = [];
  for (let i = 0; i < 5; i++) events.push(await store.appendEvent({ type: `e${i}`, client_created_at: i }));
  await store.markSynced([events[1].key]);
  await store.markQuarantined(events[3].key, 'conflict');
  const unsynced = await store.listUnsynced(50);
  assert.deepEqual(unsynced.map((e) => e.type), ['e0', 'e2', 'e4']);
  assert.deepEqual((await store.listUnsynced(2)).map((e) => e.type), ['e0', 'e2']);
});

test('markSynced and markQuarantined persist', idb, async () => {
  const store = await freshStore();
  const e = await store.appendEvent({ type: 'x', client_created_at: 1 });
  await store.markQuarantined(e.key, 'invalid_schema');
  let all = await store.listEvents();
  assert.equal(all[0].status, 'quarantined');
  assert.equal(all[0].quarantineCode, 'invalid_schema');
  await store.markSynced([e.key]);
  all = await store.listEvents();
  assert.equal(all[0].status, 'synced');
});

test('ISO-8601 client_created_at strings sort by instant, not as NaN', idb, async () => {
  const store = await freshStore();
  for (const t of ['2026-11-26T10:00:00Z', '2026-11-26T09:00:00Z', '2026-11-26T11:00:00Z', '2026-11-25T23:00:00Z']) {
    await store.appendEvent({ type: t, client_created_at: t });
  }
  const order = (await store.listEvents()).map((e) => e.client_created_at);
  assert.deepEqual(order, ['2026-11-25T23:00:00Z', '2026-11-26T09:00:00Z', '2026-11-26T10:00:00Z', '2026-11-26T11:00:00Z']);
});

test('same instant written with different offsets keeps insertion order', idb, async () => {
  const store = await freshStore();
  await store.appendEvent({ type: 'a', client_created_at: '2026-11-26T12:00:00+02:00' });
  await store.appendEvent({ type: 'b', client_created_at: '2026-11-26T10:00:00Z' });
  assert.deepEqual((await store.listEvents()).map((e) => e.type), ['a', 'b']);
});
