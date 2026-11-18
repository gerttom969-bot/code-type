export const STORAGE_KEYS = Object.freeze({
  users: "codetype:users",
  session: "codetype:session",
  progressPrefix: "codetype:user:"
});

export const SECURITY = Object.freeze({
  passwordAlgorithm: "PBKDF2-SHA-256",
  passwordIterations: 600_000,
  passwordSaltBytes: 16,
  sessionTokenBytes: 24,
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  maxCodeBytes: 20 * 1024,
  maxPasswordLength: 256,
  minPasswordLength: 8,
  minUsernameLength: 3,
  maxUsernameLength: 24
});

export const XP = Object.freeze({
  typingDrill: 5,
  fillBlanks: 8,
  easy: 50,
  medium: 100,
  hard: 200,
  codeforces: 80
});
