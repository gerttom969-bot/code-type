/**
 * SICP-inspired learning objects.
 * Each item defines a public contract separately from its hidden representation.
 * The small evaluators below are deterministic teaching models, not Python execution.
 */
export const BLACK_BOXES = Object.freeze([
  Object.freeze({
    id: "square",
    family: "Pure procedure",
    level: "01",
    title: "Square a value",
    signature: "square(x: float) -> float",
    purpose: "Turn one numeric value into its square. The caller depends on the result, not on the multiplication used inside.",
    contract: {
      inputs: "One finite number x.",
      output: "A number equal to x × x.",
      precondition: "x is a finite number.",
      postcondition: "result >= 0 and result === x * x."
    },
    callerKnows: ["The procedure name", "The input type", "The output meaning"],
    callerDoesNotKnow: ["How multiplication is implemented", "Whether the implementation uses a temporary variable"],
    implementation: "def square(x: float) -> float:\n    \"\"\"Return x multiplied by itself.\"\"\"\n    return x * x",
    composition: "sum_of_squares(a, b) can use square(a) and square(b) without knowing how square works.",
    flow: ["x", "multiply x by x", "result"],
    fields: [{ name: "x", label: "Input x", value: "5" }],
    evaluate(values) {
      if (String(values.x ?? "").trim() === "") throw new Error("x is required.");
      const x = Number(values.x);
      if (!Number.isFinite(x)) throw new Error("x must be a finite number.");
      return { value: x * x, trace: [`Receive x = ${x}`, `Apply the contract: x × x`, `Return ${x * x}`] };
    },
    boundaryExamples: ["square(0) → 0", "square(-3) → 9", "square(2.5) → 6.25"]
  }),
  Object.freeze({
    id: "sum-squares",
    family: "Composition",
    level: "02",
    title: "Compose two black boxes",
    signature: "sum_of_squares(a: float, b: float) -> float",
    purpose: "A higher-level procedure combines two lower-level procedures. It should reason in terms of square's contract, not its internals.",
    contract: {
      inputs: "Two finite numbers a and b.",
      output: "The sum of their squares.",
      precondition: "a and b are finite numbers.",
      postcondition: "result === square(a) + square(b)."
    },
    callerKnows: ["Two numbers go in", "One sum of squares comes out"],
    callerDoesNotKnow: ["How square is represented", "Whether square uses x * x or another correct method"],
    implementation: "def square(x: float) -> float:\n    return x * x\n\ndef sum_of_squares(a: float, b: float) -> float:\n    return square(a) + square(b)",
    composition: "sum_of_squares → square(a) + square(b) → numeric result.",
    flow: ["(a, b)", "square(a)", "square(b)", "add results", "number"],
    fields: [{ name: "a", label: "Input a", value: "3" }, { name: "b", label: "Input b", value: "4" }],
    evaluate(values) {
      if (String(values.a ?? "").trim() === "" || String(values.b ?? "").trim() === "") throw new Error("Both a and b are required.");
      const a = Number(values.a);
      const b = Number(values.b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("a and b must be finite numbers.");
      const left = a * a;
      const right = b * b;
      return { value: left + right, trace: [`sum_of_squares receives (${a}, ${b})`, `square(${a}) returns ${left}`, `square(${b}) returns ${right}`, `Add the two results → ${left + right}`] };
    },
    boundaryExamples: ["sum_of_squares(0, 0) → 0", "sum_of_squares(3, 4) → 25", "sum_of_squares(-2, 5) → 29"]
  }),
  Object.freeze({
    id: "withdraw",
    family: "State abstraction",
    level: "03",
    title: "Hide changing state",
    signature: "make_withdraw(balance: int) -> withdraw(amount) -> int",
    purpose: "A constructor creates a procedure whose private balance changes over time. Callers use withdraw(amount); they do not edit balance directly.",
    contract: {
      inputs: "A non-negative starting balance, then non-negative withdrawal amounts.",
      output: "The new balance, or a rejection when the amount is unavailable.",
      precondition: "Starting balance and withdrawal amounts are non-negative.",
      postcondition: "A successful withdrawal decreases balance by exactly amount; a rejected withdrawal leaves it unchanged."
    },
    callerKnows: ["How to create a withdrawal operation", "How to request a withdrawal", "The returned balance or rejection"],
    callerDoesNotKnow: ["Where balance is stored", "How the closure remembers the balance", "The internal state representation"],
    implementation: "def make_withdraw(balance: int):\n    def withdraw(amount: int):\n        nonlocal balance\n        if amount > balance:\n            return \"Insufficient funds\"\n        balance -= amount\n        return balance\n    return withdraw",
    composition: "make_withdraw constructs a stateful procedure. Each call is an event that changes the hidden representation only when the contract allows it.",
    flow: ["initial balance", "constructor", "withdraw(amount)", "invariant check", "new balance"],
    fields: [{ name: "balance", label: "Starting balance", value: "100" }, { name: "amounts", label: "Withdrawals (comma separated)", value: "30, 20, 80" }],
    evaluate(values) {
      let balance = Number(values.balance);
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("Starting balance must be a non-negative integer.");
      const tokens = String(values.amounts ?? "").split(",").map(item => item.trim());
      if (!tokens.length || tokens.some(item => item === "")) throw new Error("Enter non-negative whole-number withdrawals separated by commas.");
      const amounts = tokens.map(Number);
      if (amounts.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error("Enter non-negative whole-number withdrawals separated by commas.");
      const trace = [`Constructor creates private balance = ${balance}`];
      for (const amount of amounts) {
        if (amount > balance) trace.push(`withdraw(${amount}) → rejected; balance stays ${balance}`);
        else { balance -= amount; trace.push(`withdraw(${amount}) → new balance ${balance}`); }
      }
      return { value: balance, trace };
    },
    boundaryExamples: ["withdraw(0) leaves state unchanged", "withdraw(balance) reaches 0", "withdraw(balance + 1) is rejected without mutation"]
  }),
  Object.freeze({
    id: "pipeline",
    family: "Data abstraction",
    level: "04",
    title: "Build a data pipeline",
    signature: "average_of_positive(values: Sequence[int]) -> float | None",
    purpose: "Separate filtering, transformation, and aggregation. Each stage has a small contract and can be reasoned about independently.",
    contract: {
      inputs: "A finite sequence of integers.",
      output: "The average of positive values, or None when no positive values exist.",
      precondition: "The sequence contains integer values.",
      postcondition: "Only positive values contribute to the sum and count."
    },
    callerKnows: ["A sequence enters", "Positive values are selected", "An average or None is returned"],
    callerDoesNotKnow: ["The container representation", "Whether filtering uses a loop or comprehension", "Whether a running total is used"],
    implementation: "def average_of_positive(values: list[int]) -> float | None:\n    positives = [value for value in values if value > 0]\n    if not positives:\n        return None\n    return sum(positives) / len(positives)",
    composition: "Sequence → filter positives → compute sum and count → divide → result.",
    flow: ["sequence", "filter > 0", "sum + count", "divide", "average / None"],
    fields: [{ name: "values", label: "Values (comma separated)", value: "-2, 4, 6, 0, 10" }],
    evaluate(values) {
      const raw = String(values.values ?? "").trim();
      const items = raw === "" ? [] : raw.split(",").map(value => Number(value.trim()));
      if (items.some(value => !Number.isInteger(value))) throw new Error("Enter integers separated by commas.");
      const positives = items.filter(value => value > 0);
      const trace = [`Input sequence: [${items.join(", ")}]`, `Filter value > 0 → [${positives.join(", ")}]`, `Count = ${positives.length}`, positives.length ? `Sum = ${positives.reduce((sum, value) => sum + value, 0)}` : "No positive values remain"];
      const result = positives.length ? positives.reduce((sum, value) => sum + value, 0) / positives.length : null;
      trace.push(`Return ${result === null ? "None" : result}`);
      return { value: result, trace };
    },
    boundaryExamples: ["average_of_positive([]) → None", "average_of_positive([-1, 0]) → None", "average_of_positive([2, 4]) → 3.0"]
  })
]);

export function findBlackBox(id) {
  return BLACK_BOXES.find(item => item.id === id) ?? BLACK_BOXES[0];
}

export function evaluateBlackBox(id, values) {
  const box = findBlackBox(id);
  return box.evaluate(values);
}
