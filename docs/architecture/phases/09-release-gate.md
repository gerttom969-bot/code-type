# Phase 09: Release gate

Status: Not started | Plan phase: 7 | Blocked by: 07, 08

**Goal.** A short checklist that must be fully green before real learners are invited.

## Steps

### Step 09.1 Design and accessibility pass (Size: S)
- Acceptance criteria: text contrast meets WCAG AA. Status never relies on colour alone: green success, red error, amber partial and grey neutral each come with text or an icon. A learner can finish the first session with the keyboard only. Reduced-motion preferences are respected. The calm look stays, with no badge inflation. D-14 (language and text direction) is decided; code blocks stay left-to-right in any layout.
- Verification: walk every screen; run a contrast checker on the colour tokens in `styles.css`; tab through the first session.
- Blocked by: 07.4

### Step 09.2 Load numbers (Size: S)
- Acceptance criteria: expected learners and submissions per day are written down, converted to requests per minute at peak, and checked against the VM from Phase 08.
- Verification: the numbers are in this file, and a simple load test against staging stays within them.
- Blocked by: 06.7

### Step 09.3 Security review (Size: M)
- Acceptance criteria: a Content-Security-Policy is deployed. The Pyodide runtime is self-hosted or integrity-checked. Cookies are `HttpOnly; Secure; SameSite=Lax`. Rate limits and body-size limits are on. No secret is in the repo or its history. `SECURITY.md` matches the code, and no document claims a sandbox that does not exist.
- Verification: a header check of the deployed site; a secret scan of the repo history; read `SECURITY.md` against the code.
- Blocked by: 08.5

### Step 09.4 Privacy and deletion (Size: M)
- Acceptance criteria: a learner can delete their account. Events are append-only, so the design states exactly what deletion does: for example, the account and credentials are removed and the learner's events are detached from the identity. Personal files (if any exist by then) are deleted outright. The requirements of Egypt's personal data protection law are checked by someone qualified; this file is not legal advice.
- Verification: delete a test account end to end and confirm what remains in the database and the backups.
- Blocked by: 06.3

Backups also hold the data. Decide how long they live.

### Step 09.5 Final rehearsal (Size: S)
- Acceptance criteria: the restore is repeated from the latest backup on a clean machine. The running commit matches `main`. Every box below is ticked.
- Verification: the checklist below, with the date.
- Blocked by: 09.1 to 09.4

## Release checklist

- [ ] First session works with no account and shows Python loading progress.
- [ ] A runaway loop can be stopped.
- [ ] Two devices converge on the same totals.
- [ ] The status (saved, syncing, offline, failed) is always visible.
- [ ] A restore from backup has been done on a clean machine.
- [ ] The running commit equals `main`.
- [ ] Accessibility pass done.
- [ ] Security review done.
- [ ] Deletion works and its behavior is documented.
- [ ] Load numbers written down and checked.

## Exit criteria

Every box is ticked with a date, and Evidence below links to the run of each check.

## Evidence

- (fill in)
