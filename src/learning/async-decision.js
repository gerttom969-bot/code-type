/** Pure decision rule. This advises architecture; it does not inspect Python bytecode. */
export function decideAsync({ workload = "pure", api = "sync", independentTasks = "one" } = {}) {
  if (workload === "cpu") {
    return {
      choice: "Use a normal def for the calculation; move heavy CPU work to a process, worker, or native implementation when necessary.",
      form: "def",
      concurrency: "asyncio does not make CPU-bound Python execute in parallel. A CPU loop still occupies the event-loop thread.",
      why: "The bottleneck is computation, not waiting. async/await is a concurrency interface for awaitable operations, not a CPU speed switch.",
      example: "def calculate_features(data: list[float]) -> list[float]:\n    return [value * value for value in data]"
    };
  }

  if (workload !== "io") {
    return {
      choice: "Use a normal def. Do not add async when the function has no awaitable work.",
      form: "def",
      concurrency: "There is no waiting operation for the event loop to manage.",
      why: "A simple transformation, validation rule, or in-memory calculation is synchronous work.",
      example: "def normalize_username(value: str) -> str:\n    return value.strip().lower()"
    };
  }

  if (api === "sync") {
    return {
      choice: "Prefer the synchronous API in a synchronous program. In an async service, isolate blocking I/O with an appropriate thread/executor boundary or choose a library with an async API.",
      form: "def (or an explicit blocking-I/O boundary)",
      concurrency: "Calling a blocking function directly inside async def can block the event loop and stall unrelated tasks.",
      why: "The library exposes a synchronous operation. Adding async to your own function does not transform that operation into non-blocking I/O.",
      example: "def load_document(path: str) -> str:\n    return Path(path).read_text(encoding=\"utf-8\")"
    };
  }

  if (workload === "io" && api === "async") {
    const overlap = independentTasks === "many";
    return {
      choice: "Use async def because the dependency is awaitable. " + (overlap ? "Use TaskGroup or gather when the independent operations are safe to overlap." : "Await the operation directly; async is useful because this call is awaitable, not because one request is automatically faster."),
      form: "async def",
      concurrency: overlap
        ? "Independent I/O waits can overlap while each task is suspended. Concurrency is not the same as CPU parallelism."
        : "One awaited I/O operation yields control while it waits; there may be no useful concurrency to add.",
      why: "Network or asynchronous file/database I/O spends time waiting. Awaiting lets the event loop run other ready tasks during that wait.",
      example: overlap
        ? "async def load_all(ids: list[int]):\n    async with asyncio.TaskGroup() as group:\n        tasks = [group.create_task(fetch_one(item)) for item in ids]\n    return [task.result() for task in tasks]"
        : "async def load_one(item_id: int):\n    response = await client.get(f\"/items/{item_id}\")\n    return response.json()"
    };
  }

  return {
    choice: "Use def until the function has a clear awaitable dependency.",
    form: "def",
    concurrency: "An unsupported workload/API combination should not be guessed into async semantics.",
    why: "Make the dependency contract explicit before choosing an execution model.",
    example: "def transform(value: int) -> int:\n    return value * 2"
  };
}

export const ASYNC_LESSONS = Object.freeze([
  { title: "async does not mean faster", body: "async def marks a coroutine function. It helps an event loop switch to other work when the current task awaits an awaitable operation." },
  { title: "Concurrency is not parallelism", body: "Concurrency structures overlapping progress. Parallelism executes computation at the same instant on multiple cores. asyncio is primarily about concurrent I/O." },
  { title: "The whole call chain matters", body: "If a function awaits another function, that dependency must provide an awaitable result. A synchronous blocking call inside async def can freeze the event loop." },
  { title: "Use async when the system needs it", body: "Use it for async network/database clients, sockets, and many independent I/O waits. Keep pure calculations and ordinary local transformations as def." }
]);
