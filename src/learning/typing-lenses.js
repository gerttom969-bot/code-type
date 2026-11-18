/** Short prompts make code typing a structural-reading exercise, not only transcription. */
export const TYPING_LENSES = Object.freeze({
  1: {
    concept: "Filter, then transform",
    notice: "Read the expression from left to right: build a new value from each x, but keep only the values that satisfy the predicate.",
    typeFocus: "Brackets define the comprehension; the condition is a filter, not a mutation of the source range.",
    question: "Which part decides what enters the result, and which part decides what each result value becomes?"
  },
  2: {
    concept: "An async boundary",
    notice: "The route function is async because the surrounding application may await asynchronous work. The route declaration itself does not make every operation faster.",
    typeFocus: "Notice decorator → function signature → typed parameter → optional query value → returned mapping.",
    question: "Would this function still need async if it only returned a constant and never awaited an async dependency?"
  },
  3: {
    concept: "Data representation",
    notice: "A model groups fields and their meaning behind a class interface. Callers should use the model's public behavior, not duplicate database details everywhere.",
    typeFocus: "Class body indentation establishes ownership; each field declaration belongs to the model's representation.",
    question: "Which details describe the stored representation, and which operation would a caller use?"
  },
  4: {
    concept: "Independent I/O composition",
    notice: "asyncio.gather coordinates awaitable operations. It is appropriate when the operations are independent and spend time waiting.",
    typeFocus: "async def introduces a coroutine; await suspends it; gather composes multiple awaitables.",
    question: "Are these operations independent, and what would change if the second fetch needed the first result?"
  },
  5: {
    concept: "Names expose intent",
    notice: "Good names reduce the amount of implementation a reader must hold in working memory. Formatting makes the relationship between values visible.",
    typeFocus: "Snake_case, f-string interpolation, and a format specifier all communicate structure.",
    question: "Could you infer each value's role from its name before reading the expression?"
  }
});
