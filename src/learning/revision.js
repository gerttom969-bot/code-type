export const REVISION_CARDS = Object.freeze([
  { id: "contract", topic: "Abstraction", prompt: "What belongs in a procedure's contract?", answer: "Its accepted inputs, output meaning, preconditions, postconditions, and relevant invariants. The caller should not depend on hidden implementation details." },
  { id: "abstraction-barrier", topic: "Abstraction", prompt: "What is an abstraction barrier?", answer: "A boundary that separates a representation from the code that uses it. Callers use the public operations; only the implementation layer knows the representation." },
  { id: "composition", topic: "Composition", prompt: "How can a large procedure be understood without opening every small procedure?", answer: "Treat each subprocedure as a black box with a trusted contract. Compose the outputs and inputs of those contracts, then verify the composition." },
  { id: "pure", topic: "Reasoning", prompt: "Why are pure functions easier to test and reason about?", answer: "Their output depends only on explicit inputs and they do not mutate hidden state or cause external effects. The same input gives the same output." },
  { id: "invariant", topic: "Verification", prompt: "What is an invariant?", answer: "A property that must remain true before and after an operation or throughout a process. It helps detect incorrect state transitions." },
  { id: "state", topic: "State", prompt: "How should callers interact with hidden state?", answer: "Through a small set of public operations that preserve the state invariant, not by mutating the internal representation directly." },
  { id: "async", topic: "Concurrency", prompt: "When is async useful in Python?", answer: "When the call chain performs awaitable I/O and can yield while waiting. It supports concurrency; it does not automatically speed up CPU-bound work." },
  { id: "blocking", topic: "Concurrency", prompt: "Why is time.sleep dangerous inside async def?", answer: "time.sleep blocks the event-loop thread. Use await asyncio.sleep for an asynchronous delay." },
  { id: "style", topic: "Python style", prompt: "What is the value of a small, well-named function?", answer: "Its name and contract communicate intent. A caller can reason about the operation without re-reading its implementation." },
  { id: "mutable-default", topic: "Python behavior", prompt: "Why avoid a list as a default function argument?", answer: "The same list object is created once and reused across calls. Use None, then create a fresh list inside the function." }
]);

export function reviewDueAt(cardId, schedules = {}, now = Date.now()) {
  const record = schedules[cardId];
  return record && Number.isFinite(record.dueAt) ? record.dueAt : now;
}

export function getDueCards(cards = REVISION_CARDS, schedules = {}, now = Date.now()) {
  return cards.filter(card => reviewDueAt(card.id, schedules, now) <= now);
}

export function gradeReview(cardId, rating, schedules = {}, now = Date.now()) {
  const delays = { again: 5 * 60_000, hard: 24 * 60 * 60_000, good: 3 * 24 * 60 * 60_000, easy: 7 * 24 * 60 * 60_000 };
  if (!Object.hasOwn(delays, rating)) throw new TypeError("Unknown review rating.");
  const previous = schedules[cardId] ?? { repetitions: 0 };
  const repetitions = rating === "again" ? 0 : previous.repetitions + 1;
  return {
    ...schedules,
    [cardId]: { dueAt: now + delays[rating], lastReviewedAt: now, rating, repetitions }
  };
}

export function createStudyPlan({ minutes = 30, focus = "abstraction", goal = "Understand one idea deeply" } = {}) {
  const available = Math.max(10, Math.min(180, Math.floor(Number(minutes) || 30)));
  const weights = [0.2, 0.35, 0.3, 0.15];
  const blockMinutes = weights.map(weight => Math.floor(available * weight));
  let remainder = available - blockMinutes.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % blockMinutes.length) {
    blockMinutes[index] += 1;
    remainder -= 1;
  }
  const blocks = [
    { title: "Recall without notes", minutes: blockMinutes[0], task: "Write the idea's definition and one example from memory." },
    { title: "Study one black box", minutes: blockMinutes[1], task: "Read the contract first. Predict outputs. Reveal implementation only after you can explain the boundary." },
    { title: "Build and verify", minutes: blockMinutes[2], task: "Implement a small variation, test a normal case and a boundary case, then inspect the invariant." },
    { title: "Record the insight", minutes: blockMinutes[3], task: "Write what changed in your understanding and what to revisit next." }
  ];
  const focusLabels = {
    abstraction: "Abstraction barriers and contracts",
    composition: "Composition and decomposition",
    async: "Choosing async or sync correctly",
    style: "Python readability and code review",
    algorithms: "Algorithm reasoning and invariants"
  };
  return { goal: String(goal).trim().slice(0, 120) || "Understand one idea deeply", focus: focusLabels[focus] ?? focusLabels.abstraction, minutes: available, blocks };
}
