# Phase 04: Local-first data layer

Status: Not started | Plan phase: 3 and 5 (preparation) | Blocked by: 03

**Goal.** Everything a learner does is an append-only event stored on the device, progress is derived from those events, and no failure silently loses work.

## Starting point (verified in `src/infrastructure/json-storage.js` and `src/domain/progress.js`)

- Progress is one record per user in `localStorage` under `codetype:user:<name>`, saved whole on every `save(progress)`.
- `readJson` returns the fallback on any parse error. `load` then builds a fresh record. The next `save` overwrites the corrupt original. This was reproduced: a record containing `{corrupt json` loads as a new record with `xp = 0`, and saving replaces the raw text.
- `normalizeProgress` always writes `schemaVersion: 2`, so a newer shape cannot be represented without changing it. The export has its own separate `schemaVersion: 1`.
- `load` and `save` are synchronous, and `main.js` calls them synchronously (for example in `renderLeaderboard`).
- XP is a counter, not a ledger (see Phase 03).

## Steps

### Step 04.1 An append-only event log (Size: M)
- Acceptance criteria: a repository with `append(event)` and `list({ after })`. Each event has an `idempotency_key` (a UUID made with `crypto.randomUUID`), a `type`, a `payload`, a `schema_version` and `client_created_at`. Progress shown in the UI is computed from the log with the Phase 03 functions.
- Verification: unit tests with an in-memory fake; `node --test tests/event-log.test.js`; then a manual check in a browser that a reload keeps the log.
- Blocked by: 03.5, D-08

IndexedDB is asynchronous, so repository callers in `main.js` become `async`. Plan that change in the same PR instead of discovering it halfway.

### Step 04.2 Never overwrite corrupt data (Size: S)
- Acceptance criteria: when stored data fails to parse, the raw text is copied to `codetype:corrupt:<user>:<timestamp>` before a fresh record is created. The learner sees a message and an export is offered.
- Verification: a test reproduces today's overwrite first (red), then passes after the fix.
- Blocked by: none

### Step 04.3 Migrate from schema 2 to 3 in three steps (Size: M)
- Acceptance criteria: **Expand:** add the event store and keep the old fields. **Migrate:** create `legacy_import` events from `solvedProblems`, `completedSnippets` and `xp` once, with deterministic keys (for example a name-based UUID) so running it twice adds nothing. **Contract:** remove the old fields only in a later release, after exports prove the data is safe. XP and solved sets are identical before and after for fixture records.
- Verification: `node --test tests/migration.test.js` with fixture records from schema 2, run twice.
- Blocked by: 04.1

Never do all three steps in one release. `src/domain/progress.js` is a one-way door in the gate and needs your review.

### Step 04.4 Export and import (Size: S)
- Acceptance criteria: the export contains the events. Import validates every event and skips any whose key already exists. Importing the same file twice changes nothing.
- Verification: a round-trip test: export, import into an empty store, export again, compare.
- Blocked by: 04.1

### Step 04.5 Storage failures are visible (Size: S)
- Acceptance criteria: `StorageError` (quota full, storage blocked) shows a plain message with an export button. The event stays in memory until it is stored, so it is not lost in the meantime.
- Verification: a fake storage that throws on write keeps the event in the pending list and surfaces the message.
- Blocked by: 04.1

## Exit criteria

Corrupt data is preserved, progress is derived from events, schema 3 migrates cleanly twice over, and exports round-trip.

## Risks and notes

- `localStorage` is shared by the whole origin and small compared to an event log that grows, which is why D-08 defaults to IndexedDB.
- An old tab and a new tab can write at once. Keys are unique, so a duplicate append must be a no-op, not an error.
- Keep the local user directory (`codetype:users`) as it is. Accounts change in Phases 06 and 07.

## Evidence

- (fill in)
