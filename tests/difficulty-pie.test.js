import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conicGradient, describeMix, difficultyMix } from "../src/learning/difficulty-mix.js";
import { initialPie, pieReduce } from "../src/learning/pie-state.js";

const probs = (e, m, h) => [...Array(e).fill("easy"), ...Array(m).fill("medium"), ...Array(h).fill("hard")].map((difficulty) => ({ difficulty }));
const run = (events, s = initialPie) => events.reduce(pieReduce, s);

test("dominant is the most common difficulty; a tie goes to the harder one", () => {
  assert.equal(difficultyMix(probs(9, 12, 3)).dominant, "medium");
  assert.equal(difficultyMix(probs(5, 1, 1)).dominant, "easy");
  assert.equal(difficultyMix(probs(1, 1, 4)).dominant, "hard");
  assert.equal(difficultyMix(probs(3, 3, 0)).dominant, "medium");
  assert.equal(difficultyMix(probs(2, 2, 2)).dominant, "hard");
  assert.equal(difficultyMix([]).dominant, null);
});

test("slices cover 360 degrees in order, skip empty difficulties, and sum to the total", () => {
  for (const [e, m, h] of [[9, 12, 3], [2, 3, 0], [0, 2, 2], [1, 0, 0], [40, 92, 18]]) {
    const mix = difficultyMix(probs(e, m, h));
    assert.equal(mix.total, e + m + h);
    assert.ok(Math.abs(mix.segments.at(-1).to - 360) < 1e-9);
    assert.deepEqual(mix.segments.map((s) => s.key), ["easy", "medium", "hard"].filter((k) => mix[k] > 0));
    for (let i = 1; i < mix.segments.length; i += 1) assert.equal(mix.segments[i].from, mix.segments[i - 1].to);
  }
});

test("gradient: solid dominant colour at rest, three slices when revealed, grey when empty", () => {
  const mix = difficultyMix(probs(9, 12, 3));
  assert.equal(conicGradient(mix, false), "conic-gradient(var(--diff-medium) 0deg 360deg)");
  const open = conicGradient(mix, true);
  for (const k of ["easy", "medium", "hard"]) assert.ok(open.includes(`var(--diff-${k})`));
  assert.equal(conicGradient(difficultyMix([]), true), "conic-gradient(var(--diff-none) 0deg 360deg)");
});

test("an unknown difficulty is rejected instead of being counted silently", () => {
  assert.throws(() => difficultyMix([{ difficulty: "extreme" }]), TypeError);
  assert.equal(describeMix(difficultyMix(probs(9, 12, 3))), "9 easy, 12 medium, 3 hard");
});

test("press shows the mix, a quick tap on a shown pie hides it again", () => {
  let s = run(["press", "release", "click"]);
  assert.equal(s.revealed, true);
  s = run(["press", "release", "click"], s);
  assert.equal(s.revealed, false);
});

test("holding for five seconds starts the spin; letting go stops it and keeps the mix shown", () => {
  let s = run(["press", "hold"]);
  assert.deepEqual([s.revealed, s.spinning], [true, true]);
  s = run(["release", "click"], s);
  assert.deepEqual([s.revealed, s.spinning], [true, false]);
});

test("a hold that was cancelled before five seconds never spins, and a late hold event is ignored", () => {
  assert.equal(run(["press", "release"]).spinning, false);
  assert.equal(run(["press", "release", "hold"]).spinning, false);
});

test("the keyboard toggles and never spins", () => {
  let s = run(["toggle"]);
  assert.equal(s.revealed, true);
  s = run(["toggle"], s);
  assert.equal(s.revealed, false);
  assert.throws(() => pieReduce(initialPie, "wiggle"), TypeError);
});

test("the shipped data gives the section totals of the official list", () => {
  const { problems } = JSON.parse(readFileSync(new URL("../content/problem-index.json", import.meta.url), "utf8"));
  assert.equal(problems.length, 150);
  const arr = difficultyMix(problems.filter((p) => p.section === "Array / String"));
  assert.deepEqual([arr.easy, arr.medium, arr.hard], [9, 12, 3]);
  const all = difficultyMix(problems);
  assert.deepEqual([all.easy, all.medium, all.hard], [40, 92, 18]);
});
