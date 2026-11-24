/**
 * Exact port of the rating-based scheduler in src/learning/revision.js.
 * Behaviour-preserving differences: `now` is required (no hidden Date.now()) and
 * there is no default card list (content lives elsewhere).
 * Known flaw kept on purpose: `repetitions` is stored but never used for spacing.
 */

/** @typedef {"again" | "hard" | "good" | "easy"} Rating */
/** @typedef {{ dueAt: number, lastReviewedAt: number, rating: Rating, repetitions: number }} ReviewRecord */
/** @typedef {Record<string, ReviewRecord>} Schedules */

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** @type {Record<Rating, number>} */
const DELAYS_MS = { again: 5 * MIN, hard: DAY, good: 3 * DAY, easy: 7 * DAY };

/**
 * @param {string} cardId
 * @param {Record<string, { dueAt?: number }>} schedules
 * @param {number} now
 * @returns {number}
 */
export function reviewDueAt(cardId, schedules, now) {
  const record = schedules[cardId];
  return record && Number.isFinite(record.dueAt) ? /** @type {number} */ (record.dueAt) : now;
}

/**
 * @template {{ id: string }} T
 * @param {readonly T[]} cards
 * @param {Record<string, { dueAt?: number }>} schedules
 * @param {number} now
 * @returns {T[]}
 */
export function getDueCards(cards, schedules, now) {
  return cards.filter((card) => reviewDueAt(card.id, schedules, now) <= now);
}

/**
 * Returns a new schedule object; never mutates `schedules`.
 * @param {string} cardId
 * @param {string} rating one of again, hard, good, easy; anything else throws TypeError
 * @param {Schedules} schedules
 * @param {number} now
 * @returns {Schedules}
 */
export function gradeReview(cardId, rating, schedules, now) {
  if (!Object.hasOwn(DELAYS_MS, rating)) throw new TypeError("Unknown review rating.");
  const r = /** @type {Rating} */ (rating);
  const previous = schedules[cardId] ?? { repetitions: 0 };
  const repetitions = r === "again" ? 0 : previous.repetitions + 1;
  return { ...schedules, [cardId]: { dueAt: now + DELAYS_MS[r], lastReviewedAt: now, rating: r, repetitions } };
}
