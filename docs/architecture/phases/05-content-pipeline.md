# Phase 05: Content pipeline

Status: Not started | Plan phase: 4 | Blocked by: 03

**Goal.** Content is validated data with permanent ids, so a typo or a deleted file can never corrupt a learner's history, and every new item carries a reason a person wrote.

## Starting point (verified in `src/data/catalog.js` and `src/domain/progress.js`)

- All content is JavaScript objects in one file: 5 snippets, 6 fill-in exercises, 5 problems, 3 hard problems, 4 pro problems, 3 projects, 5 fake peers.
- Ids are mixed: snippets use numbers (1 to 5), fill-in exercises use numbers (101 to 106), problems use string `slug`s.
- Progress stores these ids: `solvedProblems` holds slugs, `completedSnippets` holds numbers. They are permanent in practice, because removing one drops a learner's record.
- Each problem's tests are one string of `assert`s ending in `print('ALL_PASSED')`.
- The risk gate's content guard ([`ids_guard.py`](../../../tools/risk-gate/risk_gate/ids_guard.py)) expects every `content/**/*.json` file to have a **top-level string `id`**. Numeric ids do not satisfy it.

## Steps

### Step 05.1 Define the schema and the id rule (Size: S)
- Acceptance criteria: a JSON Schema for each content kind. Every item has a top-level string `id`, a `status` of `active` or `deprecated`, and a `concept_id`. Numeric snippet ids map to strings (for example `snippet-1`) and the old numbers still resolve to them.
- Verification: the schema file is committed and one example of each kind validates.
- Blocked by: none

### Step 05.2 Move the catalog into `content/` (Size: M)
- Acceptance criteria: one JSON file per item under `content/`. A loader produces the same `catalog` shape the UI already uses, so screens do not change. Every id that exists in today's `catalog.js` still resolves.
- Verification: `node --test tests/content.test.js` compares the loader output to the old catalog and fails if any old id is missing.
- Blocked by: 05.1

### Step 05.3 Validate content in CI (Size: M)
- Acceptance criteria: for every problem, its tests **fail** on the starter code and **pass** on a `reference_solution.py` kept in the same folder. Ids are unique. A new CI job runs this on every PR.
- Verification: `python tools/content-check/check.py` prints each problem with `starter: fail, reference: pass`.
- Blocked by: 05.2

The reference solutions are trusted code you wrote, so running them in CI is fine. The runner (Phase 02.2) adds the pass marker, so tests no longer need to print one.

### Step 05.4 Misconception items, written by you (Size: M per concept)
- Acceptance criteria: each question has options, and **every** option, including the right one, has a written reason (`why`). Each wrong option is a real mental-model trap, not filler. Items have a `kind` (predict, explain, transfer) so Phase 03 can weigh them.
- Verification: the schema rejects an option with an empty `why`.
- Blocked by: 05.1

Start with the one concept you know best. A short, correct, curated set beats a long generated one.

### Step 05.5 Deprecate, never delete (Size: S)
- Acceptance criteria: removing an item is done by setting `status: deprecated`. Deprecated items leave new practice but still resolve for history and reports.
- Verification: `tools/risk-gate/tests/test_gitflow.py::test_deleting_a_content_id_is_blocked_even_with_the_label` already proves the gate blocks a deleted id with exit code 2. Add a local test that fails when an old id is missing.
- Blocked by: 05.2

## Exit criteria

All content is JSON with string ids, CI proves every problem's starter fails and reference passes, and at least one concept has a full set of curated items.

## Risks and notes

- `content/**` is a one-way door and removal is blocked outright. Move files with the id kept.
- Remove `planned: true` from the `content/**` rule in `risk/policy.yml` when the folder first exists. A test fails if a planned path already matches.
- The fake peers in `catalog.js` are not content. They go in Phase 07.

## Evidence

- (fill in)
