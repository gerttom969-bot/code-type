import test from "node:test";
import assert from "node:assert/strict";
import {
  ROLES, binarySearchSteps, insertionSortSteps, parseValues, quickSortSteps, slidingWindowSteps
} from "../src/learning/visualizers/steps.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function randomArray(next) {
  const n = 1 + Math.floor(next() * 12);
  return Array.from({ length: n }, () => 1 + Math.floor(next() * 20));
}
const sortedCopy = (a) => [...a].sort((x, y) => x - y);

function assertWellFormed(run) {
  const n = run.values.length;
  assert.ok(run.steps.length >= 2);
  for (const step of run.steps) {
    assert.deepEqual([...step.order].sort((a, b) => a - b), run.values.map((_, i) => i), "order is a permutation of ids");
    assert.equal(typeof step.note, "string");
    for (const [pos, role] of Object.entries(step.marks)) {
      assert.ok(Number(pos) >= 0 && Number(pos) < n, "mark inside the list");
      assert.ok(ROLES.includes(role), `known role ${role}`);
    }
  }
}

test("sorting builders end sorted, keep every value, and are deterministic", () => {
  const next = rng(7);
  for (let i = 0; i < 200; i += 1) {
    const input = randomArray(next);
    for (const build of [insertionSortSteps, quickSortSteps]) {
      const run = build(input);
      assertWellFormed(run);
      assert.deepEqual(run.result, sortedCopy(input));
      assert.deepEqual(build(input).steps, run.steps);
      const last = run.steps.at(-1);
      assert.deepEqual(last.order.map((id) => run.values[id]), sortedCopy(input));
    }
  }
});

test("sorting handles one item, duplicates and an already sorted list", () => {
  for (const input of [[5], [3, 3, 3], [1, 2, 3, 4], [4, 3, 2, 1]]) {
    assert.deepEqual(insertionSortSteps(input).result, sortedCopy(input));
    assert.deepEqual(quickSortSteps(input).result, sortedCopy(input));
  }
});

test("binary search agrees with indexOf on the sorted list", () => {
  const next = rng(11);
  for (let i = 0; i < 200; i += 1) {
    const input = randomArray(next);
    const target = 1 + Math.floor(next() * 22);
    const run = binarySearchSteps(input, target);
    assertWellFormed(run);
    const sorted = sortedCopy(input);
    if (run.result === -1) assert.ok(!sorted.includes(target));
    else assert.equal(sorted[run.result], target);
    assert.ok(run.steps.length <= 3 * (Math.ceil(Math.log2(input.length + 1)) + 2), "logarithmic number of looks");
  }
});

test("sliding window equals a brute-force longest run under the limit", () => {
  const next = rng(23);
  for (let i = 0; i < 300; i += 1) {
    const input = randomArray(next);
    const limit = 1 + Math.floor(next() * 40);
    let best = 0;
    for (let a = 0; a < input.length; a += 1) {
      let sum = 0;
      for (let b = a; b < input.length; b += 1) {
        sum += input[b];
        if (sum <= limit) best = Math.max(best, b - a + 1);
      }
    }
    const run = slidingWindowSteps(input, limit);
    assertWellFormed(run);
    assert.equal(run.result, best);
  }
});

test("the invariant text is left for the owner to write", () => {
  for (const run of [insertionSortSteps([2, 1]), quickSortSteps([2, 1]), binarySearchSteps([1, 2], 1), slidingWindowSteps([1, 2], 2)]) {
    assert.equal(run.meta.invariant, null);
  }
});

test("parseValues rejects bad input with a message and accepts good input", () => {
  assert.deepEqual(parseValues("5, 3 9").values, [5, 3, 9]);
  for (const bad of ["", "   ", "1,a", "0", "100", "1.5", "-3", Array(17).fill("1").join(",")]) {
    const r = parseValues(bad);
    assert.equal(r.ok, false);
    assert.ok(r.error.length > 0);
  }
});
