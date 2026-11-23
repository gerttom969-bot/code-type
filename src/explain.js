import { binarySearchSteps, insertionSortSteps, parseValues, quickSortSteps, slidingWindowSteps } from "./learning/visualizers/steps.js";
import { mountVisualizer } from "./ui/visualizer.js";
import { element } from "./ui/dom.js";

const LESSONS = [
  {
    id: "sliding-window",
    heading: "Sliding window",
    idea: "Keep a range of neighbours. Grow it on the right, shrink it from the left. Each item enters once and leaves once, so the work is linear.",
    cost: "Time O(n). Space O(1).",
    values: "4 2 1 7 8 1 2 8 1 3",
    extra: { label: "Sum limit", value: 16, min: 1, max: 999 },
    build: (values, extra) => slidingWindowSteps(values, extra)
  },
  {
    id: "binary-search",
    heading: "Binary search",
    idea: "On a sorted list, look at the middle. That one comparison lets you throw away half of what is left.",
    cost: "Time O(log n). Space O(1). The list must be sorted; this page sorts it for you.",
    values: "2 5 8 12 16 23 38 56 72",
    extra: { label: "Find", value: 23, min: 1, max: 99 },
    build: (values, extra) => binarySearchSteps(values, extra)
  },
  {
    id: "insertion-sort",
    heading: "Insertion sort",
    idea: "Grow a sorted prefix one item at a time. Pick the next item and slide it left past every larger item.",
    cost: "Time O(n²) worst case, O(n) on a nearly sorted list. Space O(1).",
    values: "7 3 9 2 5 1",
    build: (values) => insertionSortSteps(values)
  },
  {
    id: "quicksort",
    heading: "Quicksort",
    idea: "Pick a pivot, move smaller items to its left and the rest to its right. The pivot is now in its final place. Repeat on each side.",
    cost: "Time O(n log n) on average, O(n²) when the pivot is always the smallest or largest. Space O(log n) for the recursion.",
    values: "8 3 7 1 9 4 6 2",
    build: (values) => quickSortSteps(values)
  }
];

function lessonSection(lesson, documentRef = document) {
  const section = element("section", { className: "lesson", attributes: { id: lesson.id } }, documentRef);
  section.append(
    element("h2", { text: lesson.heading }, documentRef),
    element("p", { className: "lesson-idea", text: lesson.idea }, documentRef),
    element("p", { className: "lesson-cost", text: lesson.cost }, documentRef)
  );

  const form = element("form", { className: "lesson-form" }, documentRef);
  const valuesInput = element("input", { className: "studio-input mono", attributes: { type: "text", value: lesson.values, "aria-label": `${lesson.heading} numbers`, autocomplete: "off", spellcheck: "false" } }, documentRef);
  const valuesLabel = element("label", { className: "lesson-field" }, documentRef);
  valuesLabel.append(element("span", { text: "Numbers (1 to 99, up to 16)" }, documentRef), valuesInput);
  form.append(valuesLabel);

  let extraInput = null;
  if (lesson.extra) {
    extraInput = element("input", { className: "studio-input mono", attributes: { type: "number", value: lesson.extra.value, min: lesson.extra.min, max: lesson.extra.max, step: 1, "aria-label": lesson.extra.label } }, documentRef);
    const extraLabel = element("label", { className: "lesson-field lesson-field-small" }, documentRef);
    extraLabel.append(element("span", { text: lesson.extra.label }, documentRef), extraInput);
    form.append(extraLabel);
  }
  const submit = element("button", { className: "viz-btn", text: "Run on my numbers", attributes: { type: "submit" } }, documentRef);
  form.append(submit);

  const status = element("p", { className: "lesson-status", attributes: { role: "status" } }, documentRef);
  const player = element("div", {}, documentRef);
  const invariant = element("p", { className: "lesson-invariant" }, documentRef);
  section.append(form, status, player, invariant);

  let current = null;
  function run() {
    const parsed = parseValues(valuesInput.value);
    if (!parsed.ok) { status.textContent = parsed.error; return; }
    let extra;
    if (extraInput) {
      extra = Number(extraInput.value);
      if (!Number.isInteger(extra) || extra < lesson.extra.min || extra > lesson.extra.max) {
        status.textContent = `${lesson.extra.label} must be a whole number from ${lesson.extra.min} to ${lesson.extra.max}.`;
        return;
      }
    }
    status.textContent = "";
    current?.destroy();
    const result = lesson.build(parsed.values, extra);
    current = mountVisualizer(player, result, { documentRef });
    invariant.textContent = result.meta.invariant ?? "Invariant: not written yet. Write it in your own words before this lesson ships.";
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); run(); });
  run();
  return section;
}

const root = document.getElementById("lessons");
for (const lesson of LESSONS) root.append(lessonSection(lesson));
