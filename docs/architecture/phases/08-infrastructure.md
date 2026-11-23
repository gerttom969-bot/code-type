# Phase 08: Infrastructure

Status: Not started | Plan phase: 6 | Blocked by: 06 and the numbers in D-13

**Goal.** A fresh virtual machine becomes a working server with one command, and a restore from backup has been proven once.

## Starting point

- There is no Dockerfile, Compose file or deploy workflow in the repo.
- The web app is static files and needs only a static host. The API (Phase 06) is the first thing that needs a server.
- A single VM is a single point of failure. The local-first design (Phase 04) is what makes that acceptable: learners keep working and sync later.
- Provider and cost are open (D-12). The reliability numbers are open (D-13); Step 08.2 cannot be signed off without them.

## Steps

### Step 08.1 One VM, Docker Compose (Size: M)
- Acceptance criteria: the API, Postgres 16 and a reverse proxy with TLS are defined in one Compose file. Only SSH keys can log in. The firewall opens only the ports needed. Secrets come from environment variables or a secrets file outside the repo, never from the repo. Every process restarts by itself. The proxy compresses responses (gzip or brotli).
- Verification: reboot the VM and confirm every service comes back with no manual step. Validate any deploy change with its dry run before applying it.
- Blocked by: 06.7

### Step 08.2 Backup off the machine, restore tested (Size: S)
- Acceptance criteria: a scheduled backup is stored outside the VM and compressed with zstd. One real restore into a clean machine succeeded. The backup interval meets the "maximum events lost" number in D-13, and the restore time meets the tolerated restore time.
- Verification: restore into a clean machine; compare the count of events and the latest sync cursor with the source.
- Blocked by: 08.1, D-13

A backup that has never been restored is not a backup.

### Step 08.3 Deploy workflow, and merged is not deployed (Size: M)
- Acceptance criteria: a deploy workflow runs a dry run first. The API exposes the git commit it was built from. After each deploy, the running commit is compared with `main`.
- Verification: `curl -s https://<host>/health` shows a commit equal to `git rev-parse origin/main`.
- Blocked by: 08.1

The workflow lives under `.github/**`, a one-way door in the risk gate.

### Step 08.4 Minimal monitoring (Size: S)
- Acceptance criteria: a health check, an alert when disk use passes 80%, and structured logs you can read after a failure. A full tracing stack is not needed yet.
- Verification: fill a test volume past the threshold and see the alert.
- Blocked by: 08.1

A full disk is a classic cause of a database outage, and cheap to prevent.

### Step 08.5 Static hosting with safe headers (Size: S)
- Acceptance criteria: the web app is served with a Content-Security-Policy, `X-Content-Type-Options: nosniff` and sensible caching. If the Pyodide bundle is self-hosted (Phase 02.4), it has a long cache lifetime and a pinned version in its path.
- Verification: inspect the response headers of the deployed site.
- Blocked by: 02.4

## Exit criteria

One command builds a working server from a fresh VM, a real restore has been done, and the running commit is verifiably the one on `main`.

## Risks and notes

- Compression is HTTP gzip or brotli at the proxy and zstd for backups (D-15). Photos, audio and PDFs are already compressed, so do not spend effort recompressing them.
- Hard limits belong at the proxy as well as in the API: a maximum request body size, and rate limits.
- Put the VM's size and expected load next to the numbers from Step 09.2.

## Evidence

- (fill in)
