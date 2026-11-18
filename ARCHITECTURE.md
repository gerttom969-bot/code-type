# CodeType architecture — SICP-inspired boundaries

## Product contract

CodeType helps a learner become fluent in reading, typing, decomposing, implementing, and verifying Python programs. It records local progress and supports deliberate revision. It is not intended to be a leaderboard-first game or a prompt-and-copy code generator.

The central learning loop is:

```text
SPECIFY → DECOMPOSE → COMPOSE → VERIFY → REFLECT → REVISE
```

A learner should understand what a procedure promises before inspecting how its representation works.

## System map

```text
index.html + styles.css
  semantic controls, accessible views, visual tokens
              │
              ▼
src/main.js
  composition root / application orchestration
  ├── ui/LearningStudio
  │     ├── learning/black-boxes       public contracts + teaching evaluators
  │     ├── learning/async-decision    pure execution-model decision
  │     ├── learning/python-style      bounded code-review heuristics
  │     └── learning/revision          recall scheduling + study-plan generation
  │
  ├── domain/progress                 immutable progress transformations
  ├── domain/validation               pure input validation
  ├── services/auth-service           local demo authentication/session policy
  ├── infrastructure/json-storage     local persistence boundary
  ├── infrastructure/pyodide-runner   browser Python execution adapter
  ├── data/catalog                    read-only exercises and examples
  └── security/password-kdf + safe-html
        cryptographic derivation / text-safe output boundary
```

## Abstraction barriers and contracts

| Module | Public contract | Deliberately hidden |
|---|---|---|
| `learning/black-boxes.js` | Each black box declares a signature, inputs, output, preconditions, postconditions, caller knowledge, and boundary examples. | The implementation representation that is revealed only on request. |
| `learning/async-decision.js` | `decideAsync({ workload, api, independentTasks })` returns a recommendation, the function form, a reason, and an example. | UI events, DOM, browser storage, and actual scheduling. |
| `learning/python-style.js` | `inspectPythonStyle(source)` returns ordered findings with line, severity, explanation, and suggested correction. | No claim of full Python syntax or semantic analysis. |
| `learning/revision.js` | `getDueCards`, `gradeReview`, and `createStudyPlan` are deterministic functions over explicit inputs and timestamps. | DOM and persistence. |
| `ui/learning-studio.js` | Receives a root, navigation node, progress getter, save callback, and notification callback. | It does not own account authentication or directly access localStorage. |
| `domain/progress.js` | Creates and normalizes a schema-versioned progress record; XP and completion updates return new objects. | Serialization format and browser APIs. |
| `infrastructure/json-storage.js` | Exposes load/save/export operations for progress. | UI rendering and learning policy. |
| `services/auth-service.js` | Signup, login, guest account, session restore, expiry, rotation. Dependencies such as storage, crypto, clock, and sleep are injectable. | Form rendering and Python evaluation. |
| `infrastructure/pyodide-runner.js` | Initializes the interpreter and returns structured execution results. | It is not an isolation boundary; submitted code still executes in the browser environment. |
| `ui/dom.js` | Creates DOM nodes and assigns text safely. | Business rules and persistent data. |

## Why the Black-box Workbench is SICP-inspired

A procedure is taught through its contract, not by starting with a line-by-line explanation. Each lesson separates:

1. **What callers can know:** public name, accepted inputs, and returned meaning.
2. **What callers must not assume:** local variables, closure layout, loop choice, or internal data structure.
3. **The contract:** preconditions, postconditions, and examples.
4. **Composition:** how one procedure's output becomes another procedure's input.
5. **Representation reveal:** an implementation is shown only after the learner has formed a prediction.

The interactive contract values are evaluated by deterministic JavaScript teaching functions. They illustrate the published contract and trace; they are explicitly not a Python interpreter. Python code examples can be practised in the typing trainer or run in the separate Pyodide area.

## Learning workflow

- **Think protocol:** a six-stage worksheet records contract, examples, decomposition, composition, invariant checks, and representation reflection.
- **Async decision lab:** a pure decision model distinguishes pure/synchronous work, asynchronous I/O, blocking APIs, and CPU-bound computation.
- **Style & detection:** explainable heuristics help learners spot common Python design hazards. Findings are review signals, not authoritative lint results.
- **Active recall:** revision scheduling is stored as `dueAt`, `lastReviewedAt`, rating, and repetition count per card.
- **Study plan:** converts a goal, time budget, and focus into four finite session blocks.
- **Typing lens:** each Python snippet has a structure prompt and a question so typing reinforces reading and code-shape recognition.

## State and persistence

`appState` in `main.js` is the composition-root's transient view state. The domain state is stored separately in the progress repository. Learning records have this shape:

```js
{
  learning: {
    notes: { specify, examples, decompose, compose, verify, reflect },
    completedSteps: [],
    reviewSchedules: {},
    plan: null
  },
  schemaVersion: 2
}
```

`normalizeProgress` treats persisted JSON as untrusted input. It bounds note lengths, accepts only known step identifiers and review ratings, and normalizes study-plan fields. Old progress records receive an empty learning record without losing XP or solved exercises.

## Decision rules: when to use async

- Use `def` for pure transformations, validation, and ordinary in-memory calculations.
- Use `async def` when the function must await an asynchronous dependency.
- Overlap independent I/O waits with structured concurrency when it is safe to do so.
- Do not call blocking I/O directly inside an event-loop task unless it is isolated by an explicit thread/executor boundary or replaced by an async client.
- Do not expect `asyncio` to make CPU-bound Python code parallel. Consider processes, native code, or an appropriate worker boundary for heavy computation.

The Async Lab is a reasoning aid. It does not automatically know whether a real third-party library is awaitable; the developer must verify the library's actual API contract.

## Security and operational limits

The project remains a local browser demo. PBKDF2 hardens offline password guessing compared with a fast hash, but client-side storage cannot provide trusted authentication. Local backoff is bypassable. The browser Python runtime is not sandboxed. See `SECURITY.md` for mitigations and the production migration plan.

## Mapping to the supplied 150-principle checklist

- **11–25, abstraction and architecture:** separated UI, domain, learning logic, storage, authentication, and Python execution; pure learning modules are tested independently.
- **26–40, data:** progress has a schema version, UTC timestamps, normalized records, and JSON export. A relational database, migrations, backup, and restore tests remain production work.
- **56–70, frontend:** semantic HTML, native form controls, responsive CSS tokens, accessible labels, focus states, and text-only rendering.
- **71–85, performance:** no frontend framework or utility CSS CDN; Pyodide remains a separately loaded runtime. Real device performance must still be measured.
- **86–100, security:** PBKDF2, output-safe DOM operations, generic login errors, local rate-backoff, session TTL, and a documented non-sandboxed Python boundary. Server cookies, CSRF, CSP response headers, and server rate limits need a backend.
- **126–135, testing:** pure domain and learning behavior is covered by Node's test runner. A full real-browser, multi-browser, visual-regression, and CI matrix is still a deployment task.
- **146–150, longevity:** plain HTML/CSS/JavaScript, explicit contracts, replaceable persistence, portable progress, and decision documentation. Longevity still requires maintenance.
