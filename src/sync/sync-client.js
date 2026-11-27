// Sync client. fetch and store are injected, so tests need no module mocks.
//
// Wire format = docs/contracts/events.md (Lane A):
//   POST /v1/events   { events: EventIn[] }   (at most 50 per batch)
//   200 → { results: [{ index, idempotency_key, status, code? }], server_received_at }
//     accepted | duplicate → markSynced        (the server has it)
//     conflict | invalid   → markQuarantined   (never retried automatically)
//   429        → wait Retry-After, retry the same batch (bounded)
//   413 / 422  → split the batch in half; a single event that is refused is quarantined
//   401 / 410  → stop everything, delete nothing
//   5xx / network error → capped exponential backoff with jitter (bounded)
// When the client gives up it returns { stopped: true, reason } and leaves events pending.

const DEFAULTS = {
  endpoint: '/v1/events',
  headers: {},
  batchSize: 50,        // MAX_BATCH_EVENTS in the contract
  maxRetries: 5,        // transient failures (network, 5xx) per batch
  max429Retries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  jitter: Math.random,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

// Only contract fields go on the wire. Local bookkeeping (key, status, quarantineCode) stays local.
export function toWire(rec) {
  const wire = {
    idempotency_key: rec.idempotency_key,
    type: rec.type,
    schema_version: rec.schema_version,
    client_created_at: rec.client_created_at,
    payload: rec.payload,
  };
  for (const f of ['content_id', 'content_version', 'skill_ids']) {
    if (rec[f] !== undefined) wire[f] = rec[f];
  }
  return wire;
}

export function createSyncClient({ fetch: fetchImpl, store, ...overrides }) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  if (!store) throw new TypeError('store is required');
  const opts = { ...DEFAULTS, ...overrides };
  const stop = (reason) => ({ stopped: true, reason, changed: 0 });

  async function applyResults(events, body) {
    const results = Array.isArray(body?.results) ? body.results : [];
    const synced = [];
    let changed = 0;
    for (const r of results) {
      const rec = events[r.index]; // the server answers by position in the request
      if (!rec) continue;
      if (r.status === 'accepted' || r.status === 'duplicate') {
        synced.push(rec.key);
        changed += 1;
      } else if (r.status === 'conflict' || r.status === 'invalid') {
        await store.markQuarantined(rec.key, r.code || r.status);
        changed += 1;
      } // unknown status: leave pending
    }
    if (synced.length) await store.markSynced(synced);
    return changed;
  }

  // Returns { stopped, reason?, changed } — never shares mutable state between halves.
  async function syncBatch(events) {
    let transient = 0;
    let rateLimited = 0;
    for (;;) {
      let res;
      try {
        res = await fetchImpl(opts.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...opts.headers },
          body: JSON.stringify({ events: events.map(toWire) }),
        });
      } catch {
        res = null;
      }

      if (res && res.status === 200) {
        let body;
        try { body = await res.json(); } catch { return stop('bad_response'); }
        return { stopped: false, changed: await applyResults(events, body) };
      }
      if (res && (res.status === 401 || res.status === 410)) return stop(`http_${res.status}`);
      if (res && res.status === 429) {
        if (rateLimited++ >= opts.max429Retries) return stop('rate_limited');
        const retryAfter = Number.parseFloat(res.headers.get('retry-after') ?? '1');
        await opts.sleep(Math.max(0, Number.isFinite(retryAfter) ? retryAfter : 1) * 1000);
        continue;
      }
      if (res && (res.status === 413 || res.status === 422)) {
        if (events.length === 1) {
          // This event itself is refused: park it so it cannot block the queue.
          await store.markQuarantined(events[0].key, `http_${res.status}`);
          return { stopped: false, changed: 1 };
        }
        const half = Math.ceil(events.length / 2);
        const first = await syncBatch(events.slice(0, half));
        if (first.stopped) return first;
        const second = await syncBatch(events.slice(half));
        return { ...second, changed: first.changed + second.changed };
      }
      if (res && res.status < 500) return stop(`http_${res.status}`); // other 4xx: not retryable

      // network error or 5xx
      if (transient++ >= opts.maxRetries) return stop('network');
      const exp = opts.baseDelayMs * 2 ** (transient - 1);
      await opts.sleep(Math.min(opts.maxDelayMs, Math.floor(exp * (1 + opts.jitter()))));
    }
  }

  async function syncOnce() {
    let changed = 0;
    for (;;) {
      const batch = await store.listUnsynced(opts.batchSize);
      if (batch.length === 0) return { changed, stopped: false };
      const r = await syncBatch(batch);
      changed += r.changed;
      if (r.stopped) return { changed, stopped: true, reason: r.reason };
      // A 200 that settled nothing would re-send the same batch forever.
      if (r.changed === 0) return { changed, stopped: true, reason: 'no_progress' };
    }
  }

  return { syncOnce };
}
