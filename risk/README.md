# Risk gate

A deterministic check on every pull request. No LLM is involved in the decision: an LLM can be
prompt-injected by the diff it is judging.

| Verdict | Meaning | Exit code |
|---|---|---|
| `cleared` | Small, low-risk change. ~10% are sampled for a post-merge audit. | 0 |
| `human_required` | Touches a one-way door, is out of distribution, or scores >= threshold. Passes once a human adds the `critical-reviewed` label. | 1 (0 with label) |
| `blocked` | A `content/` id disappeared. Not overridable: mark it `deprecated` instead. | 2 |

`risk/policy.yml` is the single source of truth for the tiers. See it for the one-way-door list.

## One-time setup (GitHub)

1. Commit this whole change **directly to `main`** (bootstrap). The workflow judges PRs with the
   tool that already exists on the base branch, so the PR that introduces it cannot be gated.
2. Repo settings -> Secrets and variables -> Actions -> new secret `RISK_AUDIT_SALT` (any random
   string). Without it the audit sampling uses a public default and is predictable.
3. Create the label `critical-reviewed`.
4. Settings -> Branches -> protect `main`: require a pull request, require status checks
   `gate`, `web` and `risk-gate`, and do not allow bypassing.
5. Optional: pin the actions in `.github/workflows/*.yml` to full commit SHAs.

## Local run

```bash
cd tools/risk-gate
uv sync --frozen --extra dev
uv run pytest && uv run ruff check . && uv run mypy

# judge your current branch against main
cd ../..
PYTHONPATH=tools/risk-gate uv run --frozen --project tools/risk-gate \
  python -m risk_gate.cli --policy risk/policy.yml --base main --head HEAD --pr 1
```

`tools/risk-gate/tests/test_policy_live.py` needs a git checkout (`git init && git add .`).

## Design decisions

- **`pull_request_target`, not `pull_request`.** With `pull_request`, GitHub runs the workflow file
  from the PR, so a PR could delete the gate that judges it. The gate workflow must never check
  out or execute PR code; it only runs `git diff` over fetched commits.
- **The override label is dropped on every new push.** An approval covers the diff that was read.
- **Renames are reported as delete + add** (`--no-renames`), so moving a file out of a protected
  path still matches the rule for the old path.
- **Dead-rule test.** A non-`planned` rule that matches no tracked file fails CI. When a planned
  path first appears, delete `planned: true` (a test enforces that too).
- **Step 2 is a hand-tuned heuristic, not a model.** Every decision is uploaded as a CI artifact;
  together with the `audit-ok` / `audit-missed` labels that becomes the dataset to calibrate it later.

## Known limits (be honest about them)

- The override label is a speed bump. Anyone with triage access, including the PR author, can add
  it. For a team repo add CODEOWNERS + "require approval" so a second human is enforced.
- Fork PRs work (the workflows use `pull_request_target`) but have not been run on a real runner yet.
- `ids_guard.py` assumes every `content/**/*.json` has a top-level string `id`. Confirm against the
  Phase 2 content schema.
- Actions are pinned by tag, not SHA.
