# Decisions

Every choice that shapes the phases. **Decided** means settled. **Default** means these files assume it and the owner can overrule it. **Open** means it blocks or changes a phase and needs the owner. **Deferred** means it is parked on purpose.

Change a row here first, then edit the phases that cite it.

| ID | Decision | Status | Default or choice | Affects |
| --- | --- | --- | --- | --- |
| D-01 | Which app is the base | Open | **A:** this repo's modular app is the base and prototype features are ported in. **B:** the single-file monolith stays the base and is split step by step (the plan's strangler approach). Flip to B only if real learners already hold data under the monolith's storage keys | 00, 02, 03, 04 |
| D-02 | Code style | Default | ES modules, `async`/`await`, `const`/`let`, no shared globals | all |
| D-03 | Risk gate review mode | Decided | `review: owner`. A solo project has no team reviewer | 01 |
| D-04 | Where gate decision records live | Open | GitHub only (artifact, then an issue or a data branch) until the server exists, then move them. 90-day artifacts are not a permanent record | 01, 08 |
| D-05 | Audit rate | Open | `0.10` as written in `risk/policy.yml`. With zero misses, about 60 audited PRs bound the miss rate at 5% (rule of three: 3 / n). At 10% sampling that is about 600 cleared PRs, so raise the rate while PR volume is small | 01 |
| D-06 | "Learned" thresholds | Open | Probability threshold 0.8 and confidence 0.95 need 13 passes in a row with no failure. Calibrate with the table in Phase 03 before shipping | 03 |
| D-07 | Same idempotency key, different payload | Default | Reject with `409` as `application/problem+json`, keep the first event | 04, 06 |
| D-08 | Browser event storage | Open | IndexedDB for events (the log grows), `localStorage` stays for small settings | 04 |
| D-09 | Identity method | Open | Username and password with Argon2id and an `HttpOnly` cookie. The alternative is an emailed magic link | 06, 07 |
| D-10 | API scope | Decided | Identity, sync, leaderboard. Nothing else enters the API without a new row here | 06 |
| D-11 | Files on the server | Deferred | The profile photo is the only candidate and comes first. CV and recordings wait until their purpose and access rules are written. No video | 10 |
| D-12 | Hosting provider | Open | A rented VM with Docker Compose. Free or paid, and whether the card passes verification, is not decided | 08 |
| D-13 | Reliability numbers | Open | None. The owner supplies: maximum events lost if the VM is destroyed, tolerated downtime, tolerated restore time | 08 |
| D-14 | UI language and direction | Open | English first. Arabic with right-to-left layout is a design question, code blocks stay left-to-right | 09 |
| D-15 | Compression in the data path | Decided | No custom coders. Use HTTP gzip or brotli at the proxy and zstd for backups. A custom coder enters only if a benchmark on real data beats them by a margin that matters at real volume. The coder work lives in `experiments/`, outside the product | 10 |
| D-16 | Where Python runs in the browser | Default | A Web Worker with a timeout and terminate | 02 |
| D-17 | Redis | Deferred | Not needed at tiny scale. The leaderboard is a SQL query. Revisit when a measured bottleneck exists | 10 |
| D-18 | Server-side judge for ranked problems | Deferred | Piston first, gVisor later, only after the API is stable and an abuse model is written | 10 |

## Recording a decision

1. Edit the row. Put the date and a one-line reason in the **Default or choice** cell.
2. If a decision changes a phase, edit that phase's file in the same PR.
3. Never delete a row. Mark it superseded and add a new one.
