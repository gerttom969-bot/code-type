// Pure helpers for the difficulty pie. No DOM, no clock.
export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);

/**
 * Count problems by difficulty and find the dominant one.
 * The dominant difficulty is the one with the most problems. On a tie the harder one wins,
 * so a topic never looks easier than it is.
 * @param {ReadonlyArray<{ difficulty: string }>} problems
 */
export function difficultyMix(problems) {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const p of problems) {
    if (!Object.hasOwn(counts, p.difficulty)) throw new TypeError(`Unknown difficulty: ${p.difficulty}`);
    counts[p.difficulty] += 1;
  }
  const total = counts.easy + counts.medium + counts.hard;
  /** @type {"easy" | "medium" | "hard" | null} */
  let dominant = null;
  if (total > 0) for (const key of DIFFICULTIES) if (dominant === null || counts[key] >= counts[dominant]) dominant = key;

  const segments = [];
  let start = 0;
  for (const key of DIFFICULTIES) {
    if (counts[key] === 0) continue;
    const size = (counts[key] / total) * 360;
    segments.push({ key, count: counts[key], from: start, to: start + size });
    start += size;
  }
  return { ...counts, total, dominant, segments };
}

/**
 * CSS conic-gradient for the disc. Resting: one solid colour, the dominant one.
 * Revealed: one slice per difficulty, sized by how many problems it has.
 * @param {ReturnType<typeof difficultyMix>} mix
 * @param {boolean} revealed
 */
export function conicGradient(mix, revealed) {
  if (mix.total === 0) return "conic-gradient(var(--diff-none) 0deg 360deg)";
  if (!revealed) return `conic-gradient(var(--diff-${mix.dominant}) 0deg 360deg)`;
  const stops = mix.segments.map((s) => `var(--diff-${s.key}) ${s.from.toFixed(2)}deg ${s.to.toFixed(2)}deg`);
  return `conic-gradient(${stops.join(", ")})`;
}

export function describeMix(mix) {
  if (mix.total === 0) return "No problems";
  return `${mix.easy} easy, ${mix.medium} medium, ${mix.hard} hard`;
}
