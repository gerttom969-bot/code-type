# Phase 10: Later

Status: Parked | Plan phase: fog | Blocked by: 09

Ideas that are real but not yet worth building. Each has a **trigger**: the condition that moves it into the plan. When a trigger fires, give the item its own phase file or steps in an existing one, and add a row to [`decisions.md`](../decisions.md) if it widens the API.

| Item | Why parked | Start when |
| --- | --- | --- |
| Profile photo | The API is scoped to identity, sync and leaderboard (D-10) | Phases 06 to 08 are done and a decision row widens the scope |
| CV and recordings | Their purpose and who may see them are not written down. Recordings and especially video grow storage and backup cost | The purpose and access rules are written, and the numbers in Step 09.2 allow it. No video |
| Server-side judge for ranked problems | Browser results cannot be trusted for ranking (see the trust table in `overview.md`) | Ranking matters to learners and an abuse model is written. Piston first, an isolated container with gVisor later. Never in the API process |
| Custom compression coders | Photos, audio and PDFs are already compressed, and events are tiny. The wins are not where the data is | A benchmark on real data, comparing ratio and time with gzip and zstd on the same samples, shows a win that matters at real volume (D-15) |
| A trained risk model for the gate | It needs hundreds of labelled dangerous PRs, which one repo will not produce soon | The `audit-ok` and `audit-missed` labels reach a size a model could use |
| Redis for leaderboard or queues | At tiny scale the leaderboard is a SQL query (D-17) | A measured bottleneck |
| Tracing and metrics stack | A single service does not need it | A second service exists or an outage cannot be explained from logs |
| Server-side AI drafting | Not specified | Research when picked up |
| A light theme, Arabic UI | Open design questions (D-14) | Decided in Step 09.1 |

## Notes on the profile photo and files

When files arrive, these rules apply from the first line of code:

- The browser re-encodes a photo to a small image and strips its metadata (photos can carry location). The server checks the type from the file's bytes, not its name, rejects SVG and HTML, and caps the size.
- Files live outside Postgres. The database holds metadata only (owner, path, size, content type, a hash), and events refer to a `file_id`.
- Files are served as downloads with `X-Content-Type-Options: nosniff`, from an origin different from the app.
- Files can be deleted on request while the event log stays intact.
- The backup includes the files, so the backup size grows with them.

## Notes on compression as a learning project

Implementing Huffman, arithmetic coding and asymmetric numeral systems is a strong exercise for the fundamentals-to-data-structures path, and a Huffman implementation can become a problem in the Phase 05 content pipeline (starter code, tests, a reference solution). Keep it in `experiments/compression/`, outside the product. Compare against `gzip` and `zstd` on the same samples and report the ratio and the time for each. An edge case to test first: input with a single distinct symbol.
