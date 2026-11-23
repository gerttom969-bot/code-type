// Pure step builders for the algorithm visualizers (Phase 03, Step 03.7).
//
// Every builder takes plain numbers and returns { title, mode, values, steps, result, meta }.
// A step is { order, marks, note, pointers?, window? }:
//   order[pos]  = id of the item standing at position `pos` (ids are the original indexes,
//                 so a renderer can move one element instead of redrawing it)
//   marks[pos]  = role of the item at that position (see ROLES)
//   pointers    = { name: pos } labels drawn under cells (lo, mid, hi, l, r ...)
//   window      = [from, to] inclusive range to outline
// No DOM, no clock, no randomness: the same input always gives the same steps.

export const MAX_ITEMS = 16;
export const MIN_VALUE = 1;
export const MAX_VALUE = 99;

export const ROLES = Object.freeze([
  "compare", "pick", "pivot", "move", "sorted", "found", "dim", "window"
]);

export function parseValues(text, { limit = MAX_ITEMS } = {}) {
  const parts = String(text ?? "").split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter at least one number." };
  if (parts.length > limit) return { ok: false, error: `Use at most ${limit} numbers.` };
  const values = [];
  for (const part of parts) {
    if (!/^\d{1,2}$/.test(part)) return { ok: false, error: `"${part.slice(0, 12)}" is not a whole number from ${MIN_VALUE} to ${MAX_VALUE}.` };
    const n = Number(part);
    if (n < MIN_VALUE || n > MAX_VALUE) return { ok: false, error: `${n} is outside ${MIN_VALUE} to ${MAX_VALUE}.` };
    values.push(n);
  }
  return { ok: true, values };
}

function snap(ids, marks, note, extra = {}) {
  return { order: [...ids], marks: { ...marks }, note, ...extra };
}

function allMarked(n, role) {
  const marks = {};
  for (let i = 0; i < n; i += 1) marks[i] = role;
  return marks;
}

export function insertionSortSteps(input) {
  const values = [...input];
  const ids = values.map((_, i) => i);
  const val = (pos) => values[ids[pos]];
  const steps = [snap(ids, {}, "Start. The first item is a sorted prefix of length 1.")];
  for (let i = 1; i < ids.length; i += 1) {
    const prefix = {};
    for (let p = 0; p < i; p += 1) prefix[p] = "sorted";
    steps.push(snap(ids, { ...prefix, [i]: "pick" }, `Pick ${val(i)}. Slide it left until the item before it is not larger.`));
    let j = i;
    while (j > 0) {
      steps.push(snap(ids, { ...prefix, [j]: "pick", [j - 1]: "compare" }, `Compare ${val(j - 1)} with ${val(j)}.`));
      if (val(j - 1) <= val(j)) break;
      [ids[j - 1], ids[j]] = [ids[j], ids[j - 1]];
      steps.push(snap(ids, { ...prefix, [j - 1]: "pick", [j]: "move" }, `${val(j)} is larger, so it moves right.`));
      j -= 1;
    }
    const done = {};
    for (let p = 0; p <= i; p += 1) done[p] = "sorted";
    steps.push(snap(ids, done, `The first ${i + 1} items are sorted.`));
  }
  steps.push(snap(ids, allMarked(ids.length, "sorted"), "Done. Every item is in order."));
  return { title: "Insertion sort", mode: "bars", values, steps, result: ids.map((id) => values[id]), meta: { invariant: null } };
}

export function quickSortSteps(input) {
  const values = [...input];
  const ids = values.map((_, i) => i);
  const val = (pos) => values[ids[pos]];
  const fixed = new Set();
  const steps = [snap(ids, {}, "Start. Pick the last item of a range as the pivot.")];

  function base(lo, hi) {
    const marks = {};
    for (let p = 0; p < ids.length; p += 1) {
      if (fixed.has(p)) marks[p] = "sorted";
      else if (p < lo || p > hi) marks[p] = "dim";
    }
    return marks;
  }

  function sort(lo, hi) {
    if (lo > hi) return;
    if (lo === hi) {
      fixed.add(lo);
      steps.push(snap(ids, base(lo, hi), `${val(lo)} is alone in its range, so it is in place.`));
      return;
    }
    const pivot = val(hi);
    let boundary = lo - 1;
    steps.push(snap(ids, { ...base(lo, hi), [hi]: "pivot" }, `Range ${lo} to ${hi}. The pivot is ${pivot}.`, { window: [lo, hi] }));
    for (let j = lo; j < hi; j += 1) {
      steps.push(snap(ids, { ...base(lo, hi), [hi]: "pivot", [j]: "compare" }, `Is ${val(j)} smaller than ${pivot}?`, { window: [lo, hi] }));
      if (val(j) < pivot) {
        boundary += 1;
        if (boundary !== j) {
          [ids[boundary], ids[j]] = [ids[j], ids[boundary]];
          steps.push(snap(ids, { ...base(lo, hi), [hi]: "pivot", [boundary]: "move", [j]: "move" }, `Yes. Swap it into the left group.`, { window: [lo, hi] }));
        }
      }
    }
    const home = boundary + 1;
    if (home !== hi) [ids[home], ids[hi]] = [ids[hi], ids[home]];
    fixed.add(home);
    steps.push(snap(ids, { ...base(lo, hi), [home]: "sorted" }, `Place the pivot ${pivot} at position ${home}. Smaller items are on its left, the rest on its right.`, { window: [lo, hi] }));
    sort(lo, home - 1);
    sort(home + 1, hi);
  }

  sort(0, ids.length - 1);
  steps.push(snap(ids, allMarked(ids.length, "sorted"), "Done. Every item is in order."));
  return { title: "Quicksort", mode: "bars", values, steps, result: ids.map((id) => values[id]), meta: { invariant: null } };
}

export function binarySearchSteps(input, target) {
  const values = [...input].sort((a, b) => a - b);
  const ids = values.map((_, i) => i);
  let lo = 0;
  let hi = values.length - 1;
  const steps = [snap(ids, {}, `Search for ${target} in the sorted list.`, { pointers: { lo, hi } })];
  let found = -1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const marks = {};
    for (let p = 0; p < values.length; p += 1) if (p < lo || p > hi) marks[p] = "dim";
    marks[mid] = "compare";
    steps.push(snap(ids, marks, `Look at the middle: ${values[mid]}.`, { pointers: { lo, mid, hi }, window: [lo, hi] }));
    if (values[mid] === target) {
      found = mid;
      steps.push(snap(ids, { ...marks, [mid]: "found" }, `${values[mid]} equals ${target}. Found at position ${mid}.`, { pointers: { mid }, window: [lo, hi] }));
      break;
    }
    if (values[mid] < target) {
      lo = mid + 1;
      steps.push(snap(ids, marks, `${values[mid]} is smaller than ${target}, so drop it and everything on its left.`, { pointers: { lo, mid, hi }, window: [lo, hi] }));
    } else {
      hi = mid - 1;
      steps.push(snap(ids, marks, `${values[mid]} is larger than ${target}, so drop it and everything on its right.`, { pointers: { lo, mid, hi }, window: [lo, hi] }));
    }
  }
  if (found === -1) steps.push(snap(ids, allMarked(values.length, "dim"), `The range is empty. ${target} is not in the list.`));
  return { title: "Binary search", mode: "cells", values, steps, result: found, meta: { invariant: null, target } };
}

// Longest contiguous run whose sum is at most `limit` (all values are positive).
export function slidingWindowSteps(input, limit) {
  const values = [...input];
  const ids = values.map((_, i) => i);
  const steps = [snap(ids, {}, `Find the longest run of neighbours that adds up to at most ${limit}.`)];
  let l = 0;
  let sum = 0;
  let best = 0;
  let bestRange = null;
  const windowMarks = (from, to, role = "window") => {
    const marks = {};
    for (let p = from; p <= to; p += 1) marks[p] = role;
    return marks;
  };
  for (let r = 0; r < values.length; r += 1) {
    sum += values[r];
    steps.push(snap(ids, windowMarks(l, r), `Grow: add ${values[r]}. Sum is ${sum}.`, { pointers: { l, r }, window: [l, r] }));
    while (sum > limit && l <= r) {
      sum -= values[l];
      l += 1;
      steps.push(snap(ids, l <= r ? windowMarks(l, r) : {}, `Sum is over ${limit}. Shrink: drop ${values[l - 1]}. Sum is ${sum}.`, { pointers: l <= r ? { l, r } : { r }, ...(l <= r ? { window: [l, r] } : {}) }));
    }
    if (r - l + 1 > best) {
      best = r - l + 1;
      bestRange = [l, r];
      steps.push(snap(ids, windowMarks(l, r), `New best length: ${best}.`, { pointers: { l, r }, window: [l, r] }));
    }
  }
  const final = bestRange ? windowMarks(bestRange[0], bestRange[1], "found") : allMarked(values.length, "dim");
  steps.push(snap(ids, final, bestRange ? `Done. The longest run has length ${best}.` : `Done. No single number fits under ${limit}.`, bestRange ? { window: bestRange } : {}));
  return { title: "Sliding window", mode: "cells", values, steps, result: best, meta: { invariant: null, limit } };
}
