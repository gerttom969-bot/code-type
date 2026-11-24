// Port of the learning rules (src/learning/core) must behave exactly like the originals.
// Two nets: (1) recorded goldens in tests/goldens, (2) a direct comparison with the real original
// modules. Delete (2) when src/domain/progress.js re-exports the core; keep (1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { XP, levelFor, thresholdForLevel, reviewDueAt, getDueCards, gradeReview } from "../src/learning/core/index.js";
import { XP as ORIGINAL_XP } from "../src/config.js";
import { levelForXp as originalLevelForXp, thresholdForLevel as originalThreshold } from "../src/domain/progress.js";
import * as originalReview from "../src/learning/revision.js";

const load = (name) => JSON.parse(readFileSync(new URL(`./goldens/${name}.json`, import.meta.url), "utf8"));
const nanify = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.dueAt === "NaN" ? { dueAt: Number.NaN } : v]));

test("XP: every value in the real src/config.js is the same", () => {
  for (const [key, value] of Object.entries(ORIGINAL_XP)) assert.equal(XP[key], value, key);
  for (const [key, value] of Object.entries(load("xp").XP)) assert.equal(XP[key], value, key);
});

test("XP: prediction and complexity are pinned (from the prototype, not checkable in this repo)", () => {
  assert.equal(XP.prediction, 15);
  assert.equal(XP.complexity, 10);
});

test("levels match the goldens at every recorded input", () => {
  const g = load("levels");
  for (const { xp, level } of g.levelForXp) assert.equal(levelFor(xp), level, `xp=${xp}`);
  for (const { level, threshold } of g.thresholdForLevel) assert.equal(thresholdForLevel(level), threshold, `level=${level}`);
});

test("levels match the real original on a sweep of 0..6000 XP and levels -2..40", () => {
  for (let xp = 0; xp <= 6000; xp += 1) assert.equal(levelFor(xp), originalLevelForXp(xp), `xp=${xp}`);
  for (let level = -2; level <= 40; level += 1) assert.equal(thresholdForLevel(level), originalThreshold(level), `level=${level}`);
});

test("gradeReview matches the goldens (including throws and untouched sibling cards)", () => {
  for (const c of load("review").grade) {
    const label = `${c.priorName}/${c.cardId}/${JSON.stringify(c.rating)}`;
    if (c.throws) assert.throws(() => gradeReview(c.cardId, c.rating, c.prior, c.now), { name: c.throws, message: c.message }, label);
    else assert.deepEqual(gradeReview(c.cardId, c.rating, c.prior, c.now), c.returns, label);
  }
});

test("gradeReview matches the real original for every rating and prior", () => {
  const now = 1_700_000_000_000;
  const priors = [{}, { a: { dueAt: 1, lastReviewedAt: 0, rating: "good", repetitions: 3 } }];
  for (const prior of priors) {
    for (const rating of ["again", "hard", "good", "easy"]) {
      assert.deepEqual(gradeReview("a", rating, prior, now), originalReview.gradeReview("a", rating, prior, now), rating);
    }
  }
});

test("gradeReview never mutates its input", () => {
  const prior = { a: { dueAt: 1, lastReviewedAt: 0, rating: "good", repetitions: 2 } };
  const snapshot = structuredClone(prior);
  gradeReview("a", "easy", prior, 1000);
  assert.deepEqual(prior, snapshot);
});

test("reviewDueAt and getDueCards match the goldens and the real original", () => {
  const g = load("review");
  for (const c of g.dueAt) {
    const schedules = nanify(c.schedules);
    assert.equal(reviewDueAt(c.cardId, schedules, c.now), c.dueAt, c.cardId);
    assert.equal(reviewDueAt(c.cardId, schedules, c.now), originalReview.reviewDueAt(c.cardId, schedules, c.now), c.cardId);
  }
  const cards = g.cards.map((id) => ({ id }));
  const due = nanify({ a: { dueAt: g.now - 1 }, b: { dueAt: g.now }, c: { dueAt: g.now + 1 }, d: { dueAt: "NaN" } });
  assert.deepEqual(getDueCards(cards, {}, g.now).map((c) => c.id), g.dueCards[0].ids);
  assert.deepEqual(getDueCards(cards, due, g.now).map((c) => c.id), g.dueCards[1].ids);
  assert.deepEqual(getDueCards(cards, due, g.now), originalReview.getDueCards(cards, due, g.now));
});
