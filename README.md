# CodeType — a Python reasoning workbench

CodeType is a local-first Python learning application. It combines code typing, problem solving, and progress tracking with a SICP-inspired environment for learning how to reason about programs.

The default landing view is **SICP Studio**. It teaches learners to start with a contract, treat procedures as black boxes, compose smaller operations, check invariants, and only then inspect implementation details.

## Run locally

### Windows

1. Extract the entire project folder.
2. Double-click `start-windows.bat`.
3. Open `http://127.0.0.1:8000/` if the browser does not open automatically.

### macOS / Linux

```bash
chmod +x start-macos-linux.sh
./start-macos-linux.sh
```

Or run a standard static server from this folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>. Do not open `index.html` directly as a `file://` URL. ES modules and Web Crypto need a secure browser origin; localhost qualifies.

Pyodide is loaded from its pinned CDN script, so an internet connection is required for Python execution. The reasoning tools, black-box simulations, notes, and plan generator work in the browser without the Python runtime.

## How to study inside CodeType

### 1. Black-box workbench

Choose a procedure and read its public signature and contract before revealing the implementation. The contract lists inputs, output meaning, preconditions, and postconditions. The interactive input panel is a deterministic teaching simulator; it is not executing Python. Use it to predict behavior, inspect the trace, and test a boundary case. Reveal the Python representation only after you can explain the contract.

The examples move through several ideas:

- A pure procedure (`square`).
- Composition (`sum_of_squares`).
- Hidden state (`make_withdraw`).
- A data pipeline (filter, aggregate, and return).

### 2. Thinking protocol

Use the six-step worksheet before implementing a challenge:

1. Specify the contract.
2. Make ordinary, boundary, and rejected-input examples.
3. Decompose the problem into smaller black boxes.
4. Compose the data flow.
5. State and verify an invariant.
6. Reflect on which representation details can change without breaking callers.

Notes and completed steps are saved with the local progress record.

### 3. Async decision lab

Select the workload, the API exposed by the library, and whether independent operations can overlap. CodeType explains when `def` is sufficient, when `async def` is required to await an asynchronous dependency, when concurrency can help, and why CPU-bound work does not become parallel merely because it is written with `async`.

### 4. Style and detection

Inspect a Python sample for selected maintainability signals: mutable default arguments, broad exception handling, global state, blocking sleep inside a simple `async def` block, async functions with no `await`, long lines, and trailing whitespace. The report is a teaching heuristic, not a Python parser or a replacement for Ruff, Pyright, or code review. Verify each finding in context.

### 5. Active recall and planning

The revision deck reveals an answer only after the learner attempts recall. Ratings schedule a next review. The planner breaks one goal into recall, black-box study, implementation/verification, and reflection. These are simple local study aids, not a validated learning-science model.

### 6. Type with a structure lens

The typing trainer still measures WPM, accuracy, and errors. Every reference snippet now also explains the structural idea to notice—such as filter versus transform, decorators and signatures, data representation, async composition, or expressive names—before the learner starts copying characters.

## Tests

Node.js 20+ is recommended. The project uses Node's built-in test runner; no npm dependencies are required for the unit tests.

```bash
npm test
```

The current suite checks domain behavior, security boundaries, black-box contracts, async decisions, review scheduling, plan generation, and the SICP Studio's integration into the app shell.

## Data and security boundary

- Accounts and progress are stored in this browser's `localStorage`.
- Passwords use PBKDF2-HMAC-SHA-256 in Web Crypto for this demo. Client-side accounts are not production authentication.
- Progress is schema-versioned and exported as JSON from Profile.
- User content is rendered through text nodes / `textContent`; the application does not assign user-controlled strings to `innerHTML`.
- **The Pyodide judge is not sandboxed. Only run code you wrote and trust.** Python can interoperate with browser JavaScript and access browser capabilities.

Read [SECURITY.md](./SECURITY.md) before exposing this project publicly and [ARCHITECTURE.md](./ARCHITECTURE.md) for the abstraction map and module contracts.
