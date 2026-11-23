# Phase 00: Baseline and source of truth

Status: Not started | Plan phase: new | Blocked by: nothing

**Goal.** Everyone, including future you, agrees what the system is today, which copy of the app is canonical, and where each prototype feature will land.

## Starting point (verified in the repo, 2026-11-23)

- `main` has one commit, `21657f9 Initial CodeType SICP release`, and no other branch on the remote.
- The app is static HTML plus ES modules: `index.html`, `styles.css`, `src/` (`config.js`, `data/`, `domain/`, `infrastructure/`, `learning/`, `security/`, `services/`, `ui/`, `main.js` at 727 lines).
- `npm test` runs 34 tests, all passing: `domain`, `learning`, `security`, `startup`. `tests/security.browser.html` is a manual browser check.
- All content is in `src/data/catalog.js`: 5 typing snippets, 6 fill-in-the-blank exercises, 5 standard problems, 3 hard problems, 4 pro problems, 3 mini projects, 5 fake leaderboard peers.
- There is no `.github/` folder and no CI.
- Other copies of the app exist outside the repo: `codetype (1).html` (2,341 lines, kept here as `prototype/codetype.html`), `kilt.txt` (1,850 lines, older), and `codetype__2_.html` (1,833 lines) named in the production plan but not part of this repo.

## Steps

### Step 00.1 Decide the base app (Size: S)
- Acceptance criteria: [`decisions.md`](../decisions.md) D-01 is changed from Open to a dated choice with a one-line reason. Only one copy is edited from now on; the others are read-only feature sources.
- Verification: `grep -n "D-01" docs/architecture/decisions.md` shows a dated choice.
- Blocked by: none

The default is this repo's modular app, because it already has module boundaries and 34 tests. The plan's strangler approach (keep the monolith, extract in slices) is right if real learners already hold progress under the monolith's storage keys, because those ids and records must keep working. If nobody does yet, there is nothing to protect and the modular app is cheaper.

### Step 00.2 Finish the feature inventory (Size: S)
- Acceptance criteria: every row below has a verified "in this repo" and "in the prototype" answer and a target phase. No "not checked" left.
- Verification: open each file named in a row and write the line or function that proves it.
- Blocked by: 00.1

| Feature | In this repo | In the prototype | Target phase |
| --- | --- | --- | --- |
| Typing drills on code snippets | Yes, 5 in `catalog.snippets`, with `typing-lenses.js` | Not checked | 05 |
| Fill-in-the-blank | Yes, 6 in `catalog.midSnippets` | Calls `recordMastery(..., "fill-blanks")` | 05 |
| Problems with a Pyodide judge | Yes, 12 across three lists, `pyodide-runner.js` | Yes | 02 |
| Mini projects | Yes, 3 in `catalog.projects` | Not checked | 05 |
| SICP studio (black boxes, thinking protocol, async lab, style review, study plan) | Yes, `src/learning/`, `ui/learning-studio.js` | Not checked | none |
| Spaced review | 10 concept cards, fixed delay per rating (`learning/revision.js`) | Per-item boxes with intervals 0, 10 min, 1 h, 4 h, 24 h, 72 h (`srRecord`) | 03 |
| Prediction drills | No | Yes (46 mentions of "predict") | 03 |
| Mastery by topic | No | Yes, `recordMastery`, counts only passes for problems | 03 |
| Daily goal | No | Yes, `daily` state with `goal: 5` | 03 |
| Streak | Field set to 1 at creation, never updated | Present (5 mentions, not read in detail) | 03, 04 |
| Leaderboard | Local users plus 5 fixed peers | Not checked | 06, 07 |
| Accounts | Local PBKDF2 accounts and guest mode | Not checked | 06, 07 |
| Progress export | Yes, JSON, `json-storage.js` | Not checked | 04 |

### Step 00.3 Point the existing docs at this folder (Size: S)
- Acceptance criteria: the root `README.md` links to `docs/architecture/README.md`. No existing doc claims something the code does not do.
- Verification: `grep -n "docs/architecture" README.md`; read `ARCHITECTURE.md` and `SECURITY.md` against Phase 00.2.
- Blocked by: none

### Step 00.4 Record the baseline numbers (Size: S)
- Acceptance criteria: the Evidence section below holds the commit, the test result, the line count of `src/main.js`, and the date.
- Verification: `git rev-parse --short HEAD && npm test && wc -l src/main.js`
- Blocked by: none

## Exit criteria

D-01 decided, the inventory has no unknown, and the baseline is written down. Phases 01 and 02 can then start in parallel.

## Risks and notes

- Choosing the monolith as the base (D-01 B) makes Phases 02 to 04 mostly extraction work first. Say so in the decision.
- Do not merge prototype features into the repo during this phase. Phase 00 only decides where they go.

## Evidence

Captured while drafting these docs; re-run to confirm.

- Commit `21657f9`, branch `main`, remote has only `main`.
- `npm test`: 34 tests, 34 pass, 0 fail.
- `src/main.js`: 727 lines.
