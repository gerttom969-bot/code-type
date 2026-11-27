// Event store backed by IndexedDB.
// Ordering: client_created_at ASC, with insertion order (auto-increment key) as stable tie-breaker.

const DB_NAME = 'offline-events';
const STORE = 'events';
const DB_VERSION = 1;

function openDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // Inline auto-increment keyPath 'key' gives a stable insertion-order tie-breaker.
        db.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// client_created_at is an ISO-8601 string on the wire (numbers are accepted too).
// Compare as instants: subtracting two strings gives NaN and an arbitrary order.
function toMs(v) {
  return typeof v === 'number' ? v : Date.parse(v);
}

function compareEvents(a, b) {
  // Primary: client_created_at. Tie-breaker: key (insertion order) — stable and deterministic.
  const d = toMs(a.client_created_at) - toMs(b.client_created_at);
  if (d !== 0 && !Number.isNaN(d)) return d;
  return a.key - b.key;
}

export async function createEventStore({ dbName = DB_NAME } = {}) {
  const db = await openDb(dbName);
  const store = (mode) => db.transaction(STORE, mode).objectStore(STORE);

  async function appendEvent(event) {
    const record = {
      ...event,
      status: 'pending',
      quarantineCode: null,
    };
    record.key = await reqToPromise(store('readwrite').add(record));
    return record;
  }

  async function listUnsynced(limit = 50) {
    const all = await reqToPromise(store('readonly').getAll());
    return all
      .filter((e) => e.status === 'pending')
      .sort(compareEvents)
      .slice(0, limit);
  }

  async function markSynced(keys) {
    for (const key of keys) {
      const rec = await reqToPromise(store('readwrite').get(key));
      if (!rec) continue;
      rec.status = 'synced';
      await reqToPromise(store('readwrite').put(rec));
    }
  }

  async function markQuarantined(key, code) {
    const rec = await reqToPromise(store('readwrite').get(key));
    if (!rec) return;
    rec.status = 'quarantined';
    rec.quarantineCode = code;
    await reqToPromise(store('readwrite').put(rec));
  }

  async function listEvents() {
    const all = await reqToPromise(store('readonly').getAll());
    return all.sort(compareEvents);
  }

  return { appendEvent, listUnsynced, markSynced, markQuarantined, listEvents };
}
