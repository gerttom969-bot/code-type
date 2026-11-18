/**
 * Small, explainable static heuristics for teaching code review.
 * This is not a Python parser, linter, type checker, or proof of correctness.
 */
const RULES = [
  {
    id: "mutable-default",
    severity: "high",
    title: "Mutable default argument",
    pattern: /^\s*def\s+\w+\s*\([^\n]*=\s*(\[\]|\{\}|set\(\))/m,
    explain: "A mutable default object is created once when the function is defined and can be shared by later calls.",
    fix: "Use None as the default, then create a new list or dictionary inside the function."
  },
  {
    id: "bare-except",
    severity: "medium",
    title: "Bare except clause",
    pattern: /^\s*except\s*:\s*$/m,
    explain: "A bare except can catch exceptions you did not intend to handle, including interruption signals.",
    fix: "Catch the narrow exception type you can recover from, such as ValueError or OSError."
  },
  {
    id: "global-state",
    severity: "medium",
    title: "Global mutable state",
    pattern: /^\s*global\s+\w+/m,
    explain: "The function changes a name outside its local scope. This makes behavior depend on hidden shared state.",
    fix: "Prefer returning a new value, passing state explicitly, or encapsulating state behind a small interface."
  }
]

export function inspectPythonStyle(source) {
  const code = String(source ?? "");
  const lines = code.split("\n");
  const findings = [];

  for (const rule of RULES) {
    const matcher = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    for (const match of code.matchAll(matcher)) {
      const line = code.slice(0, match.index).split("\n").length;
      findings.push({ id: rule.id, severity: rule.severity, title: rule.title, line, explain: rule.explain, fix: rule.fix });
    }
  }

  // A deliberately small indentation-based scan for simple async def blocks.
  // It is pedagogical only; a real linter should parse Python's AST.
  for (let index = 0; index < lines.length; index += 1) {
    const declaration = lines[index].match(/^(\s*)async\s+def\s+(\w+)\s*\(/);
    if (!declaration) continue;
    const baseIndent = declaration[1].length;
    const bodyLines = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const current = lines[cursor];
      if (current.trim() === "") { bodyLines.push(current); continue; }
      const indent = current.match(/^\s*/)[0].length;
      if (indent <= baseIndent) break;
      bodyLines.push(current);
    }
    const body = bodyLines.join("\n");
    if (!/\bawait\b/.test(body)) {
      findings.push({
        id: "async-no-await", severity: "low", title: "Async function without await", line: index + 1,
        explain: `The coroutine ${declaration[2]} has no await in its indented body. It may not need coroutine semantics.`,
        fix: "Use def unless the function must satisfy an async interface or will await an async dependency."
      });
    }
    const sleepLine = bodyLines.findIndex(line => /\btime\.sleep\s*\(|^\s*sleep\s*\(/.test(line));
    if (sleepLine >= 0) {
      findings.push({
        id: "blocking-sleep", severity: "high", title: "Blocking sleep in async code", line: index + 2 + sleepLine,
        explain: "time.sleep blocks the thread and can stall the event loop when called from an async function.",
        fix: "Use await asyncio.sleep(...) for an asynchronous delay. This scanner only checks simple indentation-based function bodies."
      });
    }
  }

  lines.forEach((line, index) => {
    if (line.length > 88) {
      findings.push({
        id: "line-length", severity: "low", title: "Long line", line: index + 1,
        explain: `This line has ${line.length} characters. Long lines can make code harder to scan on split screens.`,
        fix: "Consider extracting a named intermediate value or wrapping the expression. CodeType uses 88 columns as a review guideline, not a parser-enforced rule."
      });
    }
    if (/\s+$/.test(line)) {
      findings.push({ id: "trailing-whitespace", severity: "low", title: "Trailing whitespace", line: index + 1, explain: "Whitespace at the end of a line adds noise to diffs.", fix: "Remove spaces and tabs at the end of the line." });
    }
  });

  const severityOrder = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => a.line - b.line || severityOrder[a.severity] - severityOrder[b.severity]);
  return {
    findings,
    summary: findings.length === 0 ? "No configured style signals found." : `${findings.length} review signal${findings.length === 1 ? "" : "s"} found.`,
    caveat: "This is a teaching heuristic, not a Python AST analysis. It can miss issues and can flag code that is valid in context. Verify every finding yourself."
  };
}

export const STYLE_PRINCIPLES = Object.freeze([
  { name: "Names reveal intent", example: "total_price = subtotal + tax", principle: "Use snake_case for functions and variables. Prefer a name that exposes the role of a value." },
  { name: "One function, one contract", example: "def area(width: float, height: float) -> float:", principle: "State inputs and output. Keep one coherent responsibility and make preconditions visible." },
  { name: "Separate pure work from effects", example: "def normalize(raw: str) -> str:\n    return raw.strip().lower()", principle: "Pure transformations are easier to test. Put network, files, UI, and storage at explicit boundaries." },
  { name: "Compose small procedures", example: "def invoice_total(items):\n    return sum(line_total(item) for item in items)", principle: "A larger procedure should use the contracts of smaller procedures instead of duplicating their internals." },
  { name: "Make state explicit", example: "def add_item(cart, item):\n    return [*cart, item]", principle: "Prefer explicit inputs and outputs. When state is required, encapsulate it behind a narrow interface." },
  { name: "Format for visual structure", example: "if is_valid(user):\n    save(user)\nelse:\n    report_error()", principle: "Consistent indentation and whitespace reveal control flow. Do not make formatting carry hidden semantics." }
]);

export const STYLE_SAMPLE = `def collect_names(names=[]):
    global last_result
    try:
        for Name in names:
            print(Name)
        return names
    except:
        return []

async def wait_for_data():
    time.sleep(1)
    return {"ok": True}`;

export const STYLE_REWRITE = `import asyncio

def collect_names(names: list[str] | None = None) -> list[str]:
    """Return a new list containing the supplied names."""
    if names is None:
        names = []
    return [name.strip() for name in names if name.strip()]

async def wait_for_data() -> dict[str, bool]:
    await asyncio.sleep(1)
    return {"ok": True}`;
