/**
 * XP awarded per activity.
 * The first six values are src/config.js (checked by tests/learning-core.test.js against the real file).
 * `prediction` and `complexity` are inline literals in the single-file prototype
 * (award(15, "Correct prediction") and award(10, "Complexity nailed")), not in config.js.
 * They are pinned here by a test but cannot be checked against code inside this repo.
 */
export const XP = Object.freeze({
  typingDrill: 5,
  fillBlanks: 8,
  easy: 50,
  medium: 100,
  hard: 200,
  codeforces: 80,
  prediction: 15,
  complexity: 10
});

/** @typedef {keyof typeof XP} XpKey */
