// Sync client. Dependencies (fetch, store) are injected — no module-level mocks needed.
//
// Response contract (per batch POST):
//   HTTP 200 → body: [{ key, status, code? }, ...]
//     status "accepted" | "duplicate"  → markSynced
//     status "conflict"              → markQuarantined(key, "conflict")   (not synced, not retried)
//     status "invalid"               → markQuarantined(key, code || "invalid") (not retried)
//   HTTP 429 → backoff per Retry-After (seconds), retry same batch
//   HTTP 413/422 → whole batch rejected: split in half and retry each half
//   HTTP 410/401 → fatal: stop sync entirely, delete nothing
//   network error → retry with capped exponential backoff + jitter

const DEFAULTS = {
  endpoint: '/sync',
  batchSize: 50,          // batches are capped at 50 events
  maxRetries: 5,         // network-error retries
  max429Retries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,      // backoff cap
  jitter: Math.random,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export function createSyncClient({ fetch: fetchImpl, store, ...overrides }) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  if (!store) throw new TypeError('store is required');
  const opts = { ...DEFAULTS, ...overrides };

  async function postBatch(events) {
    const res = await fetchImpl(opts.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    return res;
  }

  async function applyResults(results) {
    const synced = [];
    for (const r of results) {
      if (r.status === 'accepted' || r.status === 'duplicate') {
        synced.push(r.key);
      } else if (r.status === 'conflict') {
        await store.markQuarantined(r.key, 'conflict');
      } else if (r.status === 'invalid') {
        await store.markQuarantined(r.key, r.code || 'invalid');
      }
      // unknown statuses are ignored
    }
    if (synced.length) await store.markSynced(synced);
  }

  async function syncBatch(events, ctx) {
    if (events.length === 0) return;
    let res;
    try {
      res = await postBatch(events);
    } catch (err) {
      // Network error: exponential backoff + jitter, capped.
      if (ctx.networkRetries >= opts.maxRetries) throw new Error('max network retries exceeded');
      ctx.networkRetries += 1;
      const exp = opts.baseDelayMs * 2 ** (ctx.networkRetries - 1);
      const delay = Math.min(opts.maxDelayMs, Math.floor(exp * (1 + opts.jitter()))); // cap after jitter
      await opts.sleep(delay);
      return syncBatch(events, ctx);
    }

    if (res.status === 200) {
      await applyResults(await res.json());
      return;
    }

    if (res.status === 429) {
      if (ctx.retries429 >= opts.max429Retries) throw new Error('too many 429s');
      ctx.retries429 += 1;
      const retryAfter = parseFloat(res.headers.get('retry-after') ?? '1');
      await opts.sleep(Math.max(0, retryAfter) * 1000);
      return syncBatch(events, ctx);
    }

    if (res.status === 413 || res.status === 422) {
      // Whole batch rejected: split in half and retry each half.
      const half = Math.ceil(events.length / 2);
      await syncBatch(events.slice(0, half), { ...ctx });
      await syncBatch(events.slice(half), { ...ctx });
      return;
    }

    if (res.status === 410 || res.status === 401) {
      // Fatal: stop sync, delete nothing. Pending events stay pending.
      ctx.stopped = true;
      return;
    }

    throw new Error(`unexpected status ${res.status}`);
  }

  async function syncOnce() {
    const ctx = { networkRetries: 0, retries429: 0, stopped: false };
    let synced = 0;
    // Drain the store batch by batch (each capped at batchSize).
    for (;;) {
      const batch = await store.listUnsynced(opts.batchSize);
      if (batch.length === 0 || ctx.stopped) break;
      await syncBatch(batch, ctx);
      synced += batch.length;
    }
    return { synced, stopped: ctx.stopped };
  }

  return { syncOnce };
}
