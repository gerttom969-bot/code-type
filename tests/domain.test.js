import test from "node:test";
import assert from "node:assert/strict";
import {
  addXp,
  createInitialProgress,
  levelForXp,
  markProblemSolved,
  markSnippetCompleted,
  normalizeProgress,
  thresholdForLevel
} from "../src/domain/progress.js";

test("XP thresholds and levels are deterministic", () => {
  assert.equal(thresholdForLevel(1), 0);
  assert.equal(thresholdForLevel(2), 100);
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(300), 3);
});

test("progress updates are immutable and idempotent", () => {
  const initial = createInitialProgress("student_1", new Date("2026-01-01T00:00:00.000Z"));
  const earned = addXp(initial, 100, new Date("2026-01-02T00:00:00.000Z"));
  const solved = markProblemSolved(earned, "two-sum");
  const sameSolved = markProblemSolved(solved, "two-sum");
  const completed = markSnippetCompleted(solved, 1);
  assert.equal(initial.xp, 0);
  assert.equal(earned.xp, 100);
  assert.equal(solved.solvedProblems.length, 1);
  assert.equal(sameSolved.solvedProblems.length, 1);
  assert.deepEqual(completed.completedSnippets, [1]);
});

test("stored progress is normalized at the repository boundary", () => {
  const normalized = normalizeProgress({ xp: -20, solvedProblems: ["a", "a", 2], completedSnippets: "bad" }, "safe_user");
  assert.equal(normalized.xp, 0);
  assert.equal(normalized.level, 1);
  assert.deepEqual(normalized.solvedProblems, ["a"]);
  assert.deepEqual(normalized.completedSnippets, []);
  assert.equal(normalized.username, "safe_user");
});


test("learning notes, revision schedules, and plans survive progress normalization", () => {
  const raw = {
    xp: 25,
    learning: {
      notes: { specify: "input → output", malicious: "ignore this key", reflect: "representation can change" },
      completedSteps: ["specify", "verify", "bad-step"],
      reviewSchedules: { contract: { dueAt: 5000, lastReviewedAt: 1000, rating: "good", repetitions: 2 }, bad: { dueAt: "soon" } },
      plan: { goal: "Understand composition", minutes: 30, focusKey: "composition", focus: "Composition and decomposition", generatedAt: "2026-01-01T00:00:00.000Z", blocks: [
        { title: "Recall", task: "Recall the concept", minutes: 6 },
        { title: "Black box", task: "Read the contract", minutes: 10 },
        { title: "Verify", task: "Test boundaries", minutes: 9 },
        { title: "Reflect", task: "Record insight", minutes: 5 }
      ] }
    }
  };
  const normalized = normalizeProgress(raw, "learner_1");
  assert.equal(normalized.learning.notes.specify, "input → output");
  assert.equal(normalized.learning.notes.malicious, undefined);
  assert.deepEqual(normalized.learning.completedSteps, ["specify", "verify"]);
  assert.equal(normalized.learning.reviewSchedules.contract.rating, "good");
  assert.equal(normalized.learning.reviewSchedules.bad, undefined);
  assert.equal(normalized.learning.plan.blocks.reduce((sum, block) => sum + block.minutes, 0), 30);
  assert.equal(normalized.schemaVersion, 2);
});
