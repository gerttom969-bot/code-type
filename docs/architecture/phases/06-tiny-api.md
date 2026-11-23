# Phase 06: Tiny API

Status: Not started | Plan phase: 5 | Blocked by: 04, 05 (06.1 has no blocker)

**Goal.** A small server that does exactly three jobs, identity, sync and leaderboard, and never loses or double counts an event.

## Starting point

- There is no backend and no Python outside `tools/risk-gate/`.
- Authentication is browser-only (`src/services/auth-service.js`, PBKDF2 in `localStorage`). `SECURITY.md` already says real accounts need a trusted backend.
- [`decisions.md`](../decisions.md) D-10 fixes the scope: identity, sync, leaderboard. Anything else needs a new decision row first.

## Conventions for the API

1. Never execute learner code in the API process.
2. XP is derived from events. There is no mutable XP counter.
3. Every event has a unique `idempotency_key`.
4. Errors are `application/problem+json`.
5. All database access goes through repository functions. No queries in routes.
6. No `print`. Use `structlog`.
7. Migrations go expand, migrate, contract. Never destructive in one deploy.

Stack: FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2, Postgres 16, `uv`, `ruff`, `mypy --strict`, `pytest-asyncio`. No Redis (D-17).

## Steps

### Step 06.1 The event schema on paper (Size: S)
- Acceptance criteria: one list that says, for each field, who sets it (client or server) and why: `event_id`, `learner_id`, `idempotency_key`, `type`, `payload`, `schema_version`, `client_created_at`, `server_received_at`. It also states the payload size cap, what happens when a key repeats with a different payload (D-07), and which fields are typed columns versus `jsonb`.
- Verification: the list is committed and agrees with Step 03.1 and the draft table in the System Design doc.
- Blocked by: none

### Step 06.2 Skeleton and conventions (Size: M)
- Acceptance criteria: `apps/api` with a `/health` route, structured logging, a problem+json error handler, a repository module, Alembic set up, and the lint and type gates on.
- Verification: `cd apps/api && uv sync --frozen --extra dev && uv run pytest && uv run ruff check . && uv run mypy`
- Blocked by: 06.1

Remove `planned: true` from the `apps/api/**` rules in `risk/policy.yml` as each path appears.

### Step 06.3 Identity (Size: M)
- Acceptance criteria: sign up, sign in, sign out and "who am I". Passwords use Argon2id. The session is an opaque id in an `HttpOnly; Secure; SameSite=Lax` cookie. Cookie-authenticated writes are CSRF-protected. Sign-in has a server-side rate limit.
- Verification: tests for a wrong password, a reused session after sign-out, a missing CSRF token, and the rate limit.
- Blocked by: 06.2, D-09

Local PBKDF2 hashes made in the browser cannot be trusted by a server. Existing local learners set a password again when they create an account.

### Step 06.4 Event ingest (Size: M)
- Acceptance criteria: `POST /events` takes a batch. Each event is inserted once, enforced by `UNIQUE (idempotency_key)`. The reply says per event whether it was accepted, a duplicate, or rejected. The same key with a different payload returns `409`. Size, batch and rate limits apply.
- Verification: `uv run pytest -k ingest`: a replayed batch changes nothing; an oversized payload is rejected; the changed-payload case returns `409` as problem+json.
- Blocked by: 06.3

### Step 06.5 Sync read (Size: M)
- Acceptance criteria: `GET /events?after=<cursor>` returns new events in order. The cursor is a server-assigned increasing sequence, not a timestamp, because timestamps can tie or go backwards.
- Verification: a test pulls in pages and gets every event exactly once.
- Blocked by: 06.4

### Step 06.6 Leaderboard (Size: S)
- Acceptance criteria: ranks come from events with server-computed XP. A client-sent XP value in a payload is ignored.
- Verification: a test submits an event claiming a huge XP value and the rank does not change.
- Blocked by: 06.4

### Step 06.7 The two hard tests (Size: M)
- Acceptance criteria: a replayed batch changes nothing, and two devices syncing the same learner at the same moment never double count or lose an event.
- Verification: `uv run pytest -k "replay or concurrent"` runs both as real tests against Postgres.
- Blocked by: 06.5

## Exit criteria

All routes pass their tests including the two hard ones, migrations apply from empty, and the gates are green.

## Risks and notes

- Several API paths are in the gate's lists (`app/models`, `app/ledger`, `app/auth` are one-way doors; `routes`, `settings.py`, `db.py` raise the score). Expect reviews.
- Keep the server's definition of what an event is worth in one table or module so it is reviewable.
- Do not add file uploads here. A profile photo is the first candidate in Phase 10.

## Evidence

- (fill in)
