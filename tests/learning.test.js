import test from "node:test";
import assert from "node:assert/strict";
import { BLACK_BOXES, evaluateBlackBox, findBlackBox } from "../src/learning/black-boxes.js";
import { decideAsync } from "../src/learning/async-decision.js";
import { inspectPythonStyle, STYLE_SAMPLE, STYLE_REWRITE } from "../src/learning/python-style.js";
import { REVISION_CARDS, getDueCards, gradeReview, createStudyPlan } from "../src/learning/revision.js";
import { TYPING_LENSES } from "../src/learning/typing-lenses.js";

const NOW = Date.UTC(2026, 0, 1);

test("black-box catalog exposes a contract before a representation", () => {
  assert.equal(BLACK_BOXES.length, 4);
  for (const box of BLACK_BOXES) {
    assert.ok(box.signature.includes("->"));
    assert.ok(box.contract.inputs);
    assert.ok(box.contract.output);
    assert.ok(box.contract.precondition);
    assert.ok(box.contract.postcondition);
    assert.ok(box.implementation.startsWith("def "));
    assert.ok(box.callerKnows.length > 0);
    assert.ok(box.callerDoesNotKnow.length > 0);
    assert.ok(box.flow.length >= 3);
  }
});

test("composition black box produces expected sum of squares and a trace", () => {
  const result = evaluateBlackBox("sum-squares", { a: "3", b: "4" });
  assert.equal(result.value, 25);
  assert.match(result.trace.join(" "), /square\(3\)/);
  assert.match(result.trace.join(" "), /square\(4\)/);
});

test("pure black box rejects missing and non-finite input", () => {
  assert.throws(() => evaluateBlackBox("square", { x: "" }), /required/);
  assert.throws(() => evaluateBlackBox("square", { x: "NaN" }), /finite number/);
});

test("state abstraction preserves the balance invariant on rejected withdrawal", () => {
  const result = evaluateBlackBox("withdraw", { balance: "100", amounts: "30, 20, 80" });
  assert.equal(result.value, 50);
  assert.match(result.trace[3], /rejected; balance stays 50/);
});

test("data pipeline handles no-positive-values boundary", () => {
  const result = evaluateBlackBox("pipeline", { values: "-2, 0, -1" });
  assert.equal(result.value, null);
  assert.match(result.trace.join(" "), /Return None/);
});

test("unknown black-box id resolves to a safe default model", () => {
  assert.equal(findBlackBox("does-not-exist").id, "square");
});

test("async is chosen for awaitable I/O and independent operations", () => {
  const decision = decideAsync({ workload: "io", api: "async", independentTasks: "many" });
  assert.equal(decision.form, "async def");
  assert.match(decision.concurrency, /overlap/);
  assert.match(decision.example, /TaskGroup/);
});

test("async is not recommended for pure work or CPU-heavy work", () => {
  assert.equal(decideAsync({ workload: "pure", api: "async", independentTasks: "many" }).form, "def");
  const cpu = decideAsync({ workload: "cpu", api: "async", independentTasks: "many" });
  assert.equal(cpu.form, "def");
  assert.match(cpu.why, /computation, not waiting/);
});

test("a blocking library is not made non-blocking by async def", () => {
  const decision = decideAsync({ workload: "io", api: "sync", independentTasks: "many" });
  assert.match(decision.form, /blocking-I\/O/);
  assert.match(decision.concurrency, /block the event loop/);
});

test("style detector flags core maintainability and async mistakes in sample", () => {
  const report = inspectPythonStyle(STYLE_SAMPLE);
  const ids = report.findings.map(item => item.id);
  assert.ok(ids.includes("mutable-default"));
  assert.ok(ids.includes("global-state"));
  assert.ok(ids.includes("bare-except"));
  assert.ok(ids.includes("async-no-await"));
  assert.ok(ids.includes("blocking-sleep"));
});

test("style detector gives no warnings for cleaner teaching sample", () => {
  const report = inspectPythonStyle(STYLE_REWRITE);
  assert.equal(report.findings.some(item => ["mutable-default", "bare-except", "global-state", "blocking-sleep", "async-no-await"].includes(item.id)), false);
});

test("active recall starts due and grading schedules future recall", () => {
  assert.equal(getDueCards(REVISION_CARDS, {}, NOW).length, REVISION_CARDS.length);
  const schedules = gradeReview("contract", "good", {}, NOW);
  assert.equal(schedules.contract.dueAt, NOW + 3 * 24 * 60 * 60_000);
  assert.equal(getDueCards(REVISION_CARDS, schedules, NOW).length, REVISION_CARDS.length - 1);
  assert.equal(getDueCards(REVISION_CARDS, schedules, NOW + 3 * 24 * 60 * 60_000).length, REVISION_CARDS.length);
});

test("review rejects unknown rating instead of silently scheduling", () => {
  assert.throws(() => gradeReview("contract", "maybe", {}, NOW), /Unknown review rating/);
});

test("study plan is bounded, totals exactly, and focuses one topic", () => {
  for (const minutes of [1, 10, 15, 30, 45, 180, 999]) {
    const plan = createStudyPlan({ minutes, focus: "async", goal: "Study async decisions" });
    assert.ok(plan.minutes >= 10 && plan.minutes <= 180);
    assert.equal(plan.blocks.reduce((sum, block) => sum + block.minutes, 0), plan.minutes);
    assert.ok(plan.blocks.every(block => block.minutes >= 0));
    assert.match(plan.focus, /async/i);
  }
});

test("typing exercises carry a deliberate reading question for each snippet", () => {
  assert.equal(Object.keys(TYPING_LENSES).length, 5);
  for (const lens of Object.values(TYPING_LENSES)) {
    assert.ok(lens.concept);
    assert.ok(lens.notice);
    assert.ok(lens.question.endsWith("?"));
  }
});

test("studio navigation and workspace are part of the main app shell", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(html, /id="page-studio"/);
  assert.match(html, /data-studio-tool="blackboxes"/);
  assert.match(html, /data-studio-tool="async"/);
  assert.match(html, /challenge-open-thinking/);
  assert.match(html, /snippet-type-focus/);
  assert.match(app, /setPage\("studio"\)/);
  assert.match(app, /TYPING_LENSES/);
});
