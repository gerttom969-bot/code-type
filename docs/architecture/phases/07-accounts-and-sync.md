# Phase 07: Accounts and sync in the client

Status: Not started | Plan phase: 5 | Blocked by: 06

**Goal.** A learner signs in on a second device and sees the same progress, with no double counting, and always knows whether their work is saved.

## Starting point (verified)

- There is no network code in `src/` other than the Pyodide script.
- Accounts are local (`services/auth-service.js`), including a guest mode (`continueAsGuest`).
- `renderLeaderboard` in `main.js` builds rows from the local user directory plus the 5 fixed peers in `catalog.peers`.

## Steps

### Step 07.1 An API client (Size: S)
- Acceptance criteria: `src/infrastructure/api-client.js` wraps `fetch` with a timeout, reads `application/problem+json` into a typed error, and reuses the same idempotency key on a retry.
- Verification: unit tests with a fake `fetch`: a timeout, a `409`, a `5xx` followed by success.
- Blocked by: 06.4

### Step 07.2 The sync engine (Size: M)
- Acceptance criteria: unsent events wait in an outbox and go out in batches. The engine is a pure state machine (idle, sending, backing off, offline) driven by events: app start, the browser's `online` event, a timer, an acknowledgement. Acknowledged events are marked and never resent. New remote events are appended to the local log by cursor.
- Verification: `node --test tests/sync.test.js` covers an offline period, a duplicate acknowledgement, a partial failure, and two logs merging to the same result in either order.
- Blocked by: 07.1, 04.1

### Step 07.3 Account flows (Size: M)
- Acceptance criteria: sign up, sign in and sign out use the API. Guest mode stays local only. A guest who creates an account keeps their events, which merge safely because keys are unique.
- Verification: a manual run: practise as a guest, sign up, confirm the same totals on a second browser.
- Blocked by: 07.2, 06.3

### Step 07.4 Visible status (Size: S)
- Acceptance criteria: the UI always says one of: saved on this device, syncing, offline and will sync, or failed with the reason. It is announced to screen readers and does not rely on colour alone.
- Verification: toggle the network in browser tools and watch each state appear; check the announcement with a screen reader or the accessibility tree.
- Blocked by: 07.2

### Step 07.5 A real leaderboard (Size: S)
- Acceptance criteria: `catalog.peers` is deleted. The board shows only server-verified rows and has a friendly empty state.
- Verification: with an empty database the page shows the empty state, not fake names.
- Blocked by: 06.6

### Step 07.6 Retire browser-side auth (Size: M)
- Acceptance criteria: after a stated migration window, local password verification and the local user directory are removed, and `SECURITY.md` and the risk register are updated.
- Verification: `grep -rn "password-kdf" src` finds no use; `SECURITY.md` matches the code.
- Blocked by: 07.3

`SECURITY.md`, `src/services/**` and `src/security/**` are one-way doors: expect a review.

## Exit criteria

Two devices converge on the same totals under offline use, retries and duplicates, and the status is always visible.

## Risks and notes

- Merge conflicts cannot occur in an append-only log, but ordering can differ by device clock. Use the server cursor for sync order and `client_created_at` only as a hint.
- A learner who clears browser data loses unsynced events. The status text must make "saved on this device only" obvious for guests.

## Evidence

- (fill in)
