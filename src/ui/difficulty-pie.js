import { conicGradient, describeMix } from "../learning/difficulty-mix.js";
import { initialPie, pieReduce } from "../learning/pie-state.js";
import { element } from "./dom.js";

export const HOLD_MS = 5000;

/**
 * A pie button for one topic.
 *  - Resting: one solid colour, the colour of the most common difficulty.
 *  - Press or tap (Enter or Space on the keyboard): shows the three colours with counts. Press again to hide.
 *  - Hold for 5 seconds: the slices start to turn. Let go and they stop.
 * The mix is always readable as text, so colour is never the only signal.
 */
export function mountDifficultyPie(root, { label, mix, holdMs = HOLD_MS, setTimer = setTimeout, clearTimer = clearTimeout, documentRef = document }) {
  let state = initialPie;
  let timer = null;

  const disc = element("span", { className: "pie-disc", attributes: { "aria-hidden": "true" } }, documentRef);
  disc.append(element("span", { className: "pie-hole", text: String(mix.total) }, documentRef));
  const button = element("button", { className: "pie", attributes: { type: "button", "aria-pressed": "false" } }, documentRef);
  button.append(disc);
  const caption = element("span", { className: "pie-caption" }, documentRef);
  const legend = element("span", { className: "pie-legend", attributes: { "aria-live": "polite" } }, documentRef);
  root.replaceChildren(button, caption, legend);
  root.classList.add("pie-wrap");

  const stopTimer = () => { if (timer !== null) { clearTimer(timer); timer = null; } };
  function send(event) { state = pieReduce(state, event); paint(); }

  function paint() {
    disc.style.setProperty("--pie", conicGradient(mix, state.revealed));
    disc.classList.toggle("is-spinning", state.spinning);
    button.setAttribute("aria-pressed", String(state.revealed));
    button.setAttribute("aria-label", `${label}: ${mix.total} problems${mix.dominant ? `, mostly ${mix.dominant}` : ""}. ${state.revealed ? "Press to hide the mix." : "Press to show the mix."}`);
    caption.textContent = label;
    legend.textContent = state.revealed ? describeMix(mix) : mix.dominant ? `mostly ${mix.dominant}` : "empty";
    root.dataset.state = state.spinning ? "spinning" : state.revealed ? "revealed" : "rest";
  }

  button.addEventListener("pointerdown", () => { stopTimer(); send("press"); timer = setTimer(() => { timer = null; send("hold"); }, holdMs); });
  const release = () => { stopTimer(); if (state.pressed) send("release"); };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
  // detail is 0 for keyboard and programmatic clicks, 1 or more for the mouse and touch.
  button.addEventListener("click", (event) => send(event.detail === 0 ? "toggle" : "click"));
  button.addEventListener("contextmenu", (event) => event.preventDefault());

  paint();
  return { get state() { return root.dataset.state; }, destroy() { stopTimer(); root.replaceChildren(); } };
}
