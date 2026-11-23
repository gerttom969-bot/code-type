import { element } from "./dom.js";

const PITCH = 52; // px between item origins; keep in sync with --viz-pitch in visualizer.css
const SPEEDS = [
  { label: "Slow", ms: 1400 },
  { label: "Normal", ms: 800 },
  { label: "Fast", ms: 300 }
];

// Mounts a step player for one run from src/learning/visualizers/steps.js.
// The player only reads the run. It stores nothing; `onEvent` is the seam where
// Phase 04 can record "watched" evidence later.
export function mountVisualizer(root, run, { documentRef = document, onEvent = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const n = run.values.length;
  const maxValue = Math.max(...run.values);
  let index = 0;
  let timer = null;
  let finishedSent = false;

  root.replaceChildren();
  root.classList.add("viz");

  const counter = element("span", { className: "viz-counter" }, documentRef);
  const head = element("div", { className: "viz-head" }, documentRef);
  head.append(element("h3", { className: "viz-title", text: run.title }, documentRef), counter);

  const stage = element("div", {
    className: `viz-stage viz-${run.mode}`,
    attributes: { tabindex: "0", role: "group", "aria-label": `${run.title} animation. Use the left and right arrow keys to step.` }
  }, documentRef);
  stage.style.setProperty("--viz-count", String(n));

  const windowBox = element("div", { className: "viz-window", attributes: { "aria-hidden": "true" } }, documentRef);
  stage.append(windowBox);

  const cells = run.values.map((value, id) => {
    const cell = element("div", { className: "viz-cell", attributes: { "data-id": id } }, documentRef);
    if (run.mode === "bars") cell.style.setProperty("--viz-h", `${Math.round(24 + (value / maxValue) * 120)}px`);
    cell.append(element("span", { className: "viz-value", text: value }, documentRef));
    stage.append(cell);
    return cell;
  });

  const pointerLayer = element("div", { className: "viz-pointers", attributes: { "aria-hidden": "true" } }, documentRef);
  stage.append(pointerLayer);

  const note = element("p", { className: "viz-note", attributes: { "aria-live": "polite" } }, documentRef);

  const makeButton = (label, onClick) => {
    const b = element("button", { className: "viz-btn", text: label, attributes: { type: "button" } }, documentRef);
    b.addEventListener("click", onClick);
    return b;
  };
  const back = makeButton("Back", () => { pause(); go(index - 1); });
  const play = makeButton("Play", () => (timer === null ? start() : pause()));
  const next = makeButton("Next", () => { pause(); go(index + 1); });
  const restart = makeButton("Restart", () => { pause(); go(0); });

  const speed = element("select", { className: "viz-speed", attributes: { "aria-label": "Speed" } }, documentRef);
  SPEEDS.forEach((s, i) => speed.append(element("option", { text: s.label, attributes: { value: i, selected: i === 1 ? "" : null } }, documentRef)));
  speed.value = "1";

  const scrub = element("input", {
    className: "viz-scrub",
    attributes: { type: "range", min: 0, max: run.steps.length - 1, step: 1, value: 0, "aria-label": "Step" }
  }, documentRef);
  scrub.addEventListener("input", () => { pause(); go(Number(scrub.value)); });

  const controls = element("div", { className: "viz-controls" }, documentRef);
  controls.append(back, play, next, restart, speed);
  const scroller = element("div", { className: "viz-scroll" }, documentRef);
  scroller.append(stage);
  root.append(head, scroller, note, scrub, controls);

  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") { event.preventDefault(); pause(); go(index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); pause(); go(index - 1); }
  });

  function render() {
    const step = run.steps[index];
    const posOf = new Array(n);
    step.order.forEach((id, pos) => { posOf[id] = pos; });
    cells.forEach((cell, id) => {
      const pos = posOf[id];
      cell.style.setProperty("--viz-pos", String(pos));
      cell.dataset.role = step.marks[pos] ?? "";
    });
    if (step.window) {
      const [from, to] = step.window;
      windowBox.style.setProperty("--viz-from", String(from));
      windowBox.style.setProperty("--viz-span", String(to - from + 1));
      windowBox.hidden = false;
    } else {
      windowBox.hidden = true;
    }
    const byPos = new Map();
    for (const [name, pos] of Object.entries(step.pointers ?? {})) {
      byPos.set(pos, [...(byPos.get(pos) ?? []), name]);
    }
    pointerLayer.replaceChildren();
    for (const [pos, names] of byPos) {
      const tag = element("span", { className: "viz-pointer", text: names.join(" ") }, documentRef);
      tag.style.setProperty("--viz-pos", String(pos));
      pointerLayer.append(tag);
    }
    note.textContent = step.note;
    counter.textContent = `Step ${index + 1} of ${run.steps.length}`;
    scrub.value = String(index);
    back.disabled = index === 0;
    next.disabled = index === run.steps.length - 1;
    play.textContent = timer === null ? (index === run.steps.length - 1 ? "Replay" : "Play") : "Pause";
    onEvent({ type: "visualizer.step", title: run.title, index });
    if (index === run.steps.length - 1 && !finishedSent) {
      finishedSent = true;
      onEvent({ type: "visualizer.finished", title: run.title });
    }
  }

  function go(target) {
    index = Math.min(run.steps.length - 1, Math.max(0, target));
    render();
  }
  function pause() {
    if (timer !== null) { clearTimer(timer); timer = null; render(); }
  }
  function start() {
    if (index === run.steps.length - 1) index = 0;
    const tick = () => {
      if (index >= run.steps.length - 1) { timer = null; render(); return; }
      index += 1;
      timer = setTimer(tick, SPEEDS[Number(speed.value)].ms);
      render();
    };
    timer = setTimer(tick, 0);
  }

  render();
  return { go, pause, destroy() { pause(); root.replaceChildren(); } };
}
