export function thresholdForLevel(level) {
  if (level <= 1) return 0;
  const milestones = [0, 100, 300, 600, 1000];
  if (level <= milestones.length) return milestones[level - 1];
  const n = level - 1;
  return 100 * n * (n + 1) / 2;
}

export function levelForXp(xp) {
  let level = 1;
  while (xp >= thresholdForLevel(level + 1)) level += 1;
  return level;
}

export function createInitialProgress(username, now = new Date()) {
  const timestamp = now.toISOString();
  return {
    username,
    xp: 0,
    level: 1,
    streak: 1,
    solvedProblems: [],
    completedSnippets: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    learning: { notes: {}, completedSteps: [], reviewSchedules: {}, plan: null },
    schemaVersion: 2
  };
}

export function normalizeProgress(raw, username, now = new Date()) {
  const fallback = createInitialProgress(username, now);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const xp = Number.isFinite(raw.xp) && raw.xp >= 0 ? Math.floor(raw.xp) : 0;
  return {
    ...fallback,
    ...raw,
    username,
    xp,
    level: levelForXp(xp),
    solvedProblems: Array.isArray(raw.solvedProblems)
      ? [...new Set(raw.solvedProblems.filter(v => typeof v === "string"))] : [],
    completedSnippets: Array.isArray(raw.completedSnippets)
      ? [...new Set(raw.completedSnippets.filter(v => Number.isFinite(v)))] : [],
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : fallback.createdAt,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : fallback.updatedAt,
    learning: normalizeLearning(raw.learning),
    schemaVersion: 2
  };
}

function normalizeLearning(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const notesSource = source.notes && typeof source.notes === "object" && !Array.isArray(source.notes) ? source.notes : {};
  const notes = Object.create(null);
  for (const [key, value] of Object.entries(notesSource)) {
    if (/^(specify|examples|decompose|compose|verify|reflect)$/.test(key) && typeof value === "string") {
      notes[key] = value.slice(0, 2400);
    }
  }
  const allowedSteps = new Set(["specify", "examples", "decompose", "compose", "verify", "reflect"]);
  const completedSteps = Array.isArray(source.completedSteps)
    ? [...new Set(source.completedSteps.filter(value => allowedSteps.has(value)))] : [];
  const scheduleSource = source.reviewSchedules && typeof source.reviewSchedules === "object" && !Array.isArray(source.reviewSchedules) ? source.reviewSchedules : {};
  const reviewSchedules = Object.create(null);
  for (const [key, value] of Object.entries(scheduleSource)) {
    if (/^[a-z-]{1,40}$/.test(key) && value && typeof value === "object"
      && Number.isFinite(value.dueAt) && Number.isFinite(value.lastReviewedAt)
      && ["again", "hard", "good", "easy"].includes(value.rating)) {
      reviewSchedules[key] = {
        dueAt: value.dueAt,
        lastReviewedAt: value.lastReviewedAt,
        rating: value.rating,
        repetitions: Number.isInteger(value.repetitions) ? Math.max(0, value.repetitions) : 0
      };
    }
  }
  let plan = null;
  if (source.plan && typeof source.plan === "object" && !Array.isArray(source.plan)) {
    const goal = typeof source.plan.goal === "string" ? source.plan.goal.slice(0, 120) : "";
    const minutes = Number.isInteger(source.plan.minutes) ? Math.min(180, Math.max(10, source.plan.minutes)) : null;
    const focusKey = ["abstraction", "composition", "async", "style", "algorithms"].includes(source.plan.focusKey) ? source.plan.focusKey : "abstraction";
    const blocks = Array.isArray(source.plan.blocks)
      ? source.plan.blocks.slice(0, 4).map(block => ({
          title: typeof block?.title === "string" ? block.title.slice(0, 80) : "Study block",
          task: typeof block?.task === "string" ? block.task.slice(0, 300) : "Complete one verifiable learning task.",
          minutes: Number.isInteger(block?.minutes) ? Math.max(0, Math.min(180, block.minutes)) : 0
        }))
      : [];
    const focus = typeof source.plan.focus === "string" ? source.plan.focus.slice(0, 100) : "Abstraction barriers and contracts";
    const generatedAt = typeof source.plan.generatedAt === "string" ? source.plan.generatedAt : null;
    if (goal && minutes && blocks.length === 4) plan = { goal, minutes, focusKey, focus, blocks, generatedAt };
  }
  return { notes, completedSteps, reviewSchedules, plan };
}

export function addXp(progress, amount, now = new Date()) {
  const xp = Math.max(0, Math.floor(Number(amount) || 0));
  const nextXp = progress.xp + xp;
  return { ...progress, xp: nextXp, level: levelForXp(nextXp), updatedAt: now.toISOString() };
}

export function markProblemSolved(progress, slug, now = new Date()) {
  if (progress.solvedProblems.includes(slug)) return progress;
  return {
    ...progress,
    solvedProblems: [...progress.solvedProblems, slug],
    updatedAt: now.toISOString()
  };
}

export function markSnippetCompleted(progress, id, now = new Date()) {
  if (progress.completedSnippets.includes(id)) return progress;
  return {
    ...progress,
    completedSnippets: [...progress.completedSnippets, id],
    updatedAt: now.toISOString()
  };
}
