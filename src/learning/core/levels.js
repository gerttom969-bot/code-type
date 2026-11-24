/**
 * Exact port of thresholdForLevel from src/domain/progress.js.
 * @param {number} level
 * @returns {number} XP needed to reach `level`
 */
export function thresholdForLevel(level) {
  if (level <= 1) return 0;
  const milestones = [0, 100, 300, 600, 1000];
  if (level <= milestones.length) return milestones[level - 1];
  const n = level - 1;
  return (100 * n * (n + 1)) / 2;
}

/**
 * Exact port of levelForXp from src/domain/progress.js.
 * Callers must pass a finite number: Infinity never terminates (same as the original).
 * @param {number} xp
 * @returns {number}
 */
export function levelFor(xp) {
  let level = 1;
  while (xp >= thresholdForLevel(level + 1)) level += 1;
  return level;
}
