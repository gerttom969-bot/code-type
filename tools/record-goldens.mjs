// Records what the ORIGINAL repo functions do and writes tests/goldens/*.json.
// Imports the real files, so there are no copies that can drift.
// Re-run only if the originals change on purpose:  node tools/record-goldens.mjs
import { writeFileSync } from "node:fs";
import { thresholdForLevel, levelForXp } from "../src/domain/progress.js";
import { XP } from "../src/config.js";
import { reviewDueAt, getDueCards, gradeReview } from "../src/learning/revision.js";

const out = (name, data) => writeFileSync(new URL(`../tests/goldens/${name}.json`, import.meta.url), JSON.stringify(data, null, 2) + "\n");
const attempt = (fn) => { try { return { returns: fn() }; } catch (e) { return { throws: e.name, message: e.message }; } };

out("xp", { XP });

// Infinity is excluded on purpose: the original loops forever on it.
const xps = [-5, 0, 1, 12.5, 99, 100, 101, 299, 300, 301, 599, 600, 601, 999, 1000, 1001,
  1240, 1499, 1500, 1501, 2099, 2100, 5000, 10000];
const levels = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 20];
out("levels", {
  levelForXp: xps.map((xp) => ({ xp, level: levelForXp(xp) })),
  thresholdForLevel: levels.map((level) => ({ level, threshold: thresholdForLevel(level) }))
});

const NOW = 1_700_000_000_000;
const cards = ["a", "b", "c", "d"].map((id) => ({ id }));
const ratings = ["again", "hard", "good", "easy", "medium", "", "GOOD", "toString"];
const priors = {
  none: {},
  fresh: { a: { dueAt: NOW, lastReviewedAt: NOW - 1, rating: "good", repetitions: 0 } },
  veteran: { a: { dueAt: NOW + 5, lastReviewedAt: NOW - 9, rating: "easy", repetitions: 4 }, b: { dueAt: NOW - 1, lastReviewedAt: NOW - 99, rating: "hard", repetitions: 1 } }
};
const grade = [];
for (const [priorName, prior] of Object.entries(priors))
  for (const rating of ratings)
    grade.push({ priorName, prior, cardId: "a", rating, now: NOW, ...attempt(() => gradeReview("a", rating, prior, NOW)) });
grade.push({ priorName: "veteran", prior: priors.veteran, cardId: "z", rating: "good", now: NOW, ...attempt(() => gradeReview("z", "good", priors.veteran, NOW)) });

const dueSchedules = { a: { dueAt: NOW - 1 }, b: { dueAt: NOW }, c: { dueAt: NOW + 1 }, d: { dueAt: Number.NaN } };
const dueAtCases = [["a", dueSchedules], ["b", dueSchedules], ["c", dueSchedules], ["d", dueSchedules], ["e", dueSchedules], ["a", {}]]
  .map(([cardId, schedules]) => ({ cardId, schedules: JSON.parse(JSON.stringify(schedules, (_k, v) => (Number.isNaN(v) ? "NaN" : v))), now: NOW, dueAt: reviewDueAt(cardId, schedules, NOW) }));
const dueCards = [
  { schedules: {}, ids: getDueCards(cards, {}, NOW).map((c) => c.id) },
  { schedules: "dueSchedules", ids: getDueCards(cards, dueSchedules, NOW).map((c) => c.id) }
];
out("review", { now: NOW, cards: cards.map((c) => c.id), grade, dueAt: dueAtCases, dueCards });
console.log("goldens written");
