# Phase 02: Runner hardening

Status: Not started | Plan phase: 2 (re-grounded in this repo) | Blocked by: 00.1

**Goal.** A learner's mistake, a runaway loop or a failing test never leaves the page frozen or the learner guessing why.

## Starting point (verified in `src/infrastructure/pyodide-runner.js` and `index.html`)

- **The error-swallowing bug from the plan is not in this repo.** `#execute` wraps `runPythonAsync` in `try / catch / finally`. The `catch` returns `{ output: <message>, error: true }`. The `finally` restores `sys.stdout` and `sys.stdin` and has no `return`. The bug (a `return` inside `finally`) is in the monolith and possibly in the draft `src/core/pyodide.js`; check that file separately.
- The constructor takes a `loadRuntime` function, so the runner can be tested with a fake runtime and no browser.
- Python runs on the page's main thread (`loadPyodide()` from a `<script defer>`). There is no Worker and no timeout, so `while True: pass` freezes the tab.
- A test passes when the run has no error and its output contains the fixed text `ALL_PASSED`. The test strings print it themselves (8 occurrences in `catalog.js`), and the learner's code runs in the same interpreter and can print it too.
- The runtime script is pinned to `v0.26.4` but has no `integrity` attribute, and there is no CSP.
- `validateCode` caps code at 20 KB of UTF-8 (`SECURITY.maxCodeBytes`). That limits size, not CPU time or memory.

## Steps

### Step 02.1 Contract tests for errors (Size: S)
- Acceptance criteria: a test with a fake runtime whose `runPythonAsync` throws shows `run()` returns `error: true` with the message, and that the stdout and stdin restore call still runs. Run the same test against any other runner you keep (the draft `src/core/pyodide.js`).
- Verification: `node --test tests/runner.test.js`. Expect green here. Against the monolith's `runPython` it should be red first; fix it, then green.
- Blocked by: none

### Step 02.2 Make a pass hard to fake and easy to understand (Size: M)
- Acceptance criteria: the runner, not the content, appends the success marker, and the marker contains a per-run random token the learner's code cannot know in advance. Printing `ALL_PASSED` alone no longer passes. The result carries `passed`, `output` and, when it failed, the error text.
- Verification: a unit test where the fake runtime's output is only `ALL_PASSED` gives `passed: false`; output containing the run's token gives `passed: true`.
- Blocked by: 02.1

This raises the bar and nothing more: learner code and tests still share one interpreter, so a determined learner can game a pass. That is acceptable for self-study and never for ranking (see the trust table in [`overview.md`](../overview.md)). Per-test feedback ("test 3 of 5 failed: expected 8, got 7") needs content that lists its cases, which arrives with Phase 05.

### Step 02.3 Run Python in a Web Worker with a timeout (Size: M)
- Acceptance criteria: submitting `while True: pass` shows a plain message ("Stopped after N seconds") and the page stays responsive. The worker is terminated and recreated. `PyodideRunner` keeps its public methods (`run`, `runFunctionTests`, `runStdin`, `ready`, `initialize`) so `main.js` callers do not change. Loading shows progress.
- Verification: a unit test of the timeout wrapper with a fake worker; a manual run of the infinite loop in a browser, with the UI still scrollable while it runs.
- Blocked by: 02.1, D-16

Design notes: a small request and reply protocol keyed by an id; one request in flight at a time; terminate on timeout, then lazily recreate. The worker loads Pyodide itself, so loading no longer blocks the page. Decide the timeout in seconds and write it in `config.js`.

### Step 02.4 Protect the runtime script (Size: S)
- Acceptance criteria: the Pyodide `<script>` carries `integrity` and `crossorigin="anonymous"`, or the bundle is self-hosted under the app's origin.
- Verification: change one character of the hash and confirm the script is blocked and the startup message appears.
- Blocked by: none

The integrity attribute covers only `pyodide.js`. The runtime then fetches the WebAssembly file and the standard library from the index URL. A worker loads the script with `importScripts`, which has no integrity option. So once 02.3 lands, self-hosting the whole pinned bundle is the stronger fix; plan it for Phase 09 if you do only the attribute now.

## Exit criteria

Error behavior is under test, a runaway loop can be stopped, a pass needs a per-run token, and the runtime script is pinned and verified or self-hosted.

## Risks and notes

- Terminating the worker throws away the loaded interpreter. Reload time depends on browser cache; measure it before choosing a timeout.
- Memory is not limited by a timeout. A huge allocation can still crash the worker. The UI must survive that too.
- `src/infrastructure/**` is a one-way door in the risk gate. Expect to add the review label.

## Not in this phase

Server-side execution. Learner code on a server runs only in an isolated container and is Phase 10, never in the API process.

## Evidence

- (fill in)
