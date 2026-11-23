# Phase 01: Guardrails

Status: Built locally, not yet run on GitHub | Plan phase: 1 | Blocked by: 00.1 for the file layout only

**Goal.** Every pull request gets a deterministic verdict, and the first real PR and fork PR have proved the gate works on a GitHub runner.

## Starting point

- The repo has no `.github/` folder and no CI.
- The risk gate was built and checked locally: `risk/policy.yml`, `tools/risk-gate/` (Python, 21 tests, `ruff` and `mypy --strict` clean), and three workflows (`ci.yml`, `risk-gate.yml`, `risk-audit.yml`). Details are in [`risk/README.md`](../../../risk/README.md).
- It has **never run on a GitHub runner.** That is the point of Step 01.2.
- `risk/policy.yml` is tuned to this repo: `src/security/**`, `src/services/auth-service.js`, `src/domain/progress.js`, `src/infrastructure/**`, `SECURITY.md`, `.github/**`, `risk/**` and `tools/risk-gate/**` are one-way doors. Backend paths are marked `planned: true` until they exist.
- The workflows use `pull_request_target` so a PR cannot edit the gate that judges it. They never check out or run PR code.

## Steps

### Step 01.1 Bootstrap commit to `main` (Size: S)
- Acceptance criteria: one commit on `main` contains `risk/`, `tools/risk-gate/`, `.github/`, `docs/` and `.gitignore`. The `ci` workflow is green on that push.
- Verification: `git log --stat -1` lists the paths; the Actions tab shows `ci` green.
- Blocked by: none

The workflow needs a tool that already exists on the base branch, so this first commit cannot be gated. Do it deliberately and once.

### Step 01.2 Prove the token path, including a fork PR (Size: S)
- Acceptance criteria: a PR from a branch gets a verdict in its summary. A PR from a fork is observed and what the token could and could not do is written in Evidence. Secret `RISK_AUDIT_SALT` and label `critical-reviewed` exist.
- Verification: the Actions run logs for both PRs, and the labels visible on the PRs.
- Blocked by: 01.1

### Step 01.3 Protect `main` (Size: S)
- Acceptance criteria: `main` requires a PR and the checks `gate`, `web` and `risk-gate`, with no bypass.
- Verification: open a PR that touches `src/security/safe-html.js` with no label. The merge button stays blocked. Add `critical-reviewed` and it unblocks. Push another commit and the label is removed again.
- Blocked by: 01.2

### Step 01.4 Rules-only mode first (Size: M)
- Acceptance criteria: every one-way-door path blocks until you personally review. The dead-rule test passes. Decision JSON is kept somewhere that outlives 90 days (D-04).
- Verification: `cd tools/risk-gate && uv sync --frozen --extra dev && uv run pytest && uv run ruff check . && uv run mypy`
- Blocked by: 01.2

Artifacts are deleted after at most 90 days, so they are not a permanent record. Options to weigh, in your own words: a data branch in the same repo, a comment or issue on each PR, or the server after Phase 08. For each, ask what you lose if GitHub access is lost, and how easily you can read the data later to calibrate the score. Whatever you pick, the writer is the workflow with a narrow token, and nothing taken from the PR (its title or file names) may be run as a command or used as a file name, because that text comes from strangers.

### Step 01.5 Pick the audit rate with arithmetic (Size: S)
- Acceptance criteria: D-05 holds a number and the working. With zero misses, 3 / n bounds the miss rate at 95% confidence, so a 5% bound needs about 60 audited PRs. At a 10% audit rate that is about 600 cleared PRs.
- Verification: the working is written in `decisions.md`.
- Blocked by: 01.2

A solo project will not see 600 cleared PRs soon. Decide whether to audit all cleared PRs while volume is small.

## Exit criteria

A branch PR and a fork PR both received correct verdicts on GitHub, branch protection blocks an unreviewed one-way-door change, and the decision records have a home.

## Risks and notes

- The override label is a speed bump. Anyone with triage access can add it, including the PR author. It is cleared on every push so it only vouches for the diff that was read. A second human reviewer is the real fix if the team grows.
- Actions are pinned by tag, not commit SHA. Pin them when you next touch the workflows (this is a `.github/**` change and needs review).
- `tools/risk-gate/risk_gate/ids_guard.py` assumes every `content/**/*.json` has a top-level string `id`. Phase 05 must follow that, or change the guard.
- Fork PRs have not been run yet. Treat any difference from what `risk/README.md` says as a bug in the docs.

## Not in this phase

A trained model for the score. It needs hundreds of labelled dangerous PRs, which one repo will not produce for a long time. Keep collecting the decision JSON and the `audit-ok` and `audit-missed` labels.

## Evidence

- (fill in)
