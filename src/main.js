import { catalog } from "./data/catalog.js";
import { SECURITY, XP } from "./config.js";
import { AuthService } from "./services/auth-service.js";
import { createProgressRepository, readUserDirectory } from "./infrastructure/json-storage.js";
import { PyodideRunner } from "./infrastructure/pyodide-runner.js";
import { validateCode, validateUsername, passwordStrength } from "./domain/validation.js";
import {
  addXp,
  levelForXp,
  markProblemSolved,
  markSnippetCompleted
} from "./domain/progress.js";
import { safeHttpsUrl } from "./security/safe-html.js";
import { TYPING_LENSES } from "./learning/typing-lenses.js";
import { LearningStudio } from "./ui/learning-studio.js";
import { appendCodeBlock, clear, createUserLabel, element, setText } from "./ui/dom.js";

const $ = id => document.getElementById(id);
const auth = new AuthService();
const progressRepository = createProgressRepository();
const python = new PyodideRunner();

// One explicit application state object; persistent data remains behind repositories.
const appState = {
  user: null,
  progress: null,
  page: "studio",
  practiceMode: "typing",
  snippet: null,
  lastSnippetId: null,
  practiceStartedAt: null,
  practiceCompleted: false,
  blankExercise: null,
  blankCompleted: false,
  challenge: null,
  hintsShown: 0
};

const challengeCatalog = [
  ...catalog.problems.map(problem => ({
    ...problem,
    key: `problem:${problem.slug}`,
    kind: "function",
    group: "Algorithm fundamentals",
    xp: problem.difficulty === "medium" ? XP.medium : XP.easy
  })),
  ...catalog.hardProblems.map(problem => ({
    ...problem,
    key: `hard:${problem.slug}`,
    kind: "function",
    group: "Interview patterns",
    difficulty: "medium",
    xp: XP.medium
  })),
  ...catalog.proProblems.map(problem => ({
    ...problem,
    key: `codeforces:${problem.slug}`,
    kind: "stdin",
    group: "stdin / stdout",
    difficulty: `${problem.rating} rating`,
    xp: XP.codeforces
  }))
];

let authMode = "login";
let toastTimerIds = new Set();

// The Learning Studio is a UI black box. It receives progress and effects through
// explicit callbacks; it does not read localStorage or own authentication.
const learningStudio = new LearningStudio({
  root: $("studio-workspace"),
  nav: $("studio-tool-nav"),
  getProgress: () => appState.progress,
  saveProgress,
  notify: showToast
});

function showAuthError(message) {
  const node = $("auth-error");
  setText(node, message);
  node.hidden = false;
}

function clearAuthError() {
  $("auth-error").hidden = true;
  setText($("auth-error"), "");
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "login";
  const signup = authMode === "signup";
  $("login-tab").classList.toggle("active", !signup);
  $("signup-tab").classList.toggle("active", signup);
  $("login-tab").setAttribute("aria-pressed", String(!signup));
  $("signup-tab").setAttribute("aria-pressed", String(signup));
  $("auth-heading").textContent = signup ? "Create a place to improve." : "Build fluency, one line at a time.";
  $("auth-submit").textContent = signup ? "Create account" : "Log in";
  $("auth-password").setAttribute("autocomplete", signup ? "new-password" : "current-password");
  clearAuthError();
}

function updatePasswordMeter() {
  const result = passwordStrength($("auth-password").value);
  const pct = `${(result.score / 5) * 100}%`;
  $("strength-label").textContent = `Strength: ${result.label}`;
  $("strength-fill").style.width = pct;
  $("strength-fill").setAttribute("aria-valuenow", String(result.score));
}

function setAppVisible(visible) {
  $("auth-screen").hidden = visible;
  $("application").hidden = !visible;
}

async function enterApplication(user) {
  appState.user = user;
  appState.progress = progressRepository.load(user.username);
  setAppVisible(true);
  renderHeader();
  renderPracticePage();
  renderChallengeList();
  renderProjects();
  renderLeaderboard();
  renderProfile();
  setPage("studio");
  await initializePython();
}

async function initializePython() {
  setText($("runtime-status"), "Loading Python 3.11…");
  try {
    await python.initialize();
    setText($("runtime-status"), "Python ready");
    $("runtime-status").classList.add("ready");
    if (appState.challenge) $("submit-challenge").disabled = false;
  } catch (error) {
    setText($("runtime-status"), "Python unavailable");
    showToast(`Python could not load: ${error?.message ?? error}`, "error");
  }
}

function showToast(message, kind = "success") {
  const toast = element("div", { className: `toast ${kind}`, text: message });
  $("toast-region").append(toast);
  const timerId = setTimeout(() => {
    toast.remove();
    toastTimerIds.delete(timerId);
  }, 3200);
  toastTimerIds.add(timerId);
  while ($("toast-region").children.length > 4) {
    $("toast-region").firstElementChild.remove();
  }
}

function saveProgress() {
  if (!appState.progress) return false;
  try {
    progressRepository.save(appState.progress);
    return true;
  } catch (error) {
    showToast(error?.message ?? "Progress could not be saved.", "error");
    return false;
  }
}

function awardExperience(amount, reason) {
  if (!appState.progress) return;
  const oldLevel = appState.progress.level;
  appState.progress = addXp(appState.progress, amount);
  saveProgress();
  renderHeader();
  renderProfile();
  const levelUp = appState.progress.level > oldLevel;
  showToast(levelUp ? `Level ${appState.progress.level} reached · +${amount} XP` : `+${amount} XP · ${reason}`);
}

function renderHeader() {
  if (!appState.user || !appState.progress) return;
  setText($("nav-level"), `Lv ${appState.progress.level}`);
  setText($("nav-xp"), `${appState.progress.xp} XP`);
  setText($("avatar-button"), appState.user.username.slice(0, 1).toUpperCase());
  $("avatar-button").setAttribute("aria-label", `Open profile for ${appState.user.username}`);
}

function setPage(pageName) {
  const validPages = ["studio", "practice", "challenges", "projects", "leaderboard", "profile"];
  const page = validPages.includes(pageName) ? pageName : "studio";
  appState.page = page;
  for (const name of validPages) {
    $(`page-${name}`).hidden = name !== page;
  }
  document.querySelectorAll("[data-page]").forEach(button => {
    const active = button.dataset.page === page;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  if (page === "studio") learningStudio.render();
  if (page === "leaderboard") renderLeaderboard();
  if (page === "profile") renderProfile();
}

function setPracticeMode(mode) {
  appState.practiceMode = mode === "blanks" ? "blanks" : "typing";
  const typing = appState.practiceMode === "typing";
  $("typing-mode").hidden = !typing;
  $("blanks-mode").hidden = typing;
  document.querySelectorAll("[data-practice-mode]").forEach(button => {
    const active = button.dataset.practiceMode === appState.practiceMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (!typing && !appState.blankExercise) pickBlankExercise();
}

function renderTypingTarget(typed = "") {
  const target = appState.snippet?.code ?? "";
  const container = $("typing-target");
  clear(container);
  for (let index = 0; index < target.length; index += 1) {
    const character = target[index];
    if (character === "\n") {
      container.append(document.createElement("br"));
      continue;
    }
    const span = element("span", {
      className: index < typed.length
        ? (typed[index] === character ? "char-correct" : "char-wrong")
        : (index === typed.length ? "char-current" : "char-pending"),
      text: character
    });
    container.append(span);
  }
}

function pickSnippet() {
  const pool = catalog.snippets.filter(snippet => snippet.id !== appState.lastSnippetId);
  appState.snippet = pool[Math.floor(Math.random() * pool.length)] ?? catalog.snippets[0];
  appState.lastSnippetId = appState.snippet.id;
  appState.practiceStartedAt = null;
  appState.practiceCompleted = false;
  setText($("snippet-name"), appState.snippet.file);
  setText($("snippet-topic"), appState.snippet.topic);
  const lens = TYPING_LENSES[appState.snippet.id] ?? {
    concept: "One expression, one purpose",
    notice: "Identify the data flow and the responsibility of each part before typing.",
    typeFocus: "Use indentation and punctuation to reveal the structure.",
    question: "What is the contract of this code?"
  };
  setText($("snippet-concept"), lens.concept);
  setText($("snippet-notice"), lens.notice);
  setText($("snippet-type-focus"), `TYPE FOCUS: ${lens.typeFocus}`);
  setText($("snippet-question"), lens.question);
  $("snippet-docs").href = safeHttpsUrl(appState.snippet.docs);
  $("typing-input").value = "";
  $("typing-output-panel").hidden = true;
  setText($("typing-wpm"), "0");
  setText($("typing-accuracy"), "100%");
  setText($("typing-errors"), "0");
  renderTypingTarget("");
  $("typing-input").focus();
}

function renderPracticePage() {
  if (!appState.snippet) pickSnippet();
  if (!appState.blankExercise) pickBlankExercise();
}

async function updateTypingProgress() {
  if (!appState.snippet || appState.practiceCompleted) return;
  const typed = $("typing-input").value;
  if (typed && !appState.practiceStartedAt) appState.practiceStartedAt = Date.now();
  let errors = 0;
  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] !== appState.snippet.code[index]) errors += 1;
  }
  const minutes = appState.practiceStartedAt ? Math.max((Date.now() - appState.practiceStartedAt) / 60_000, 1 / 600) : 0;
  const wpm = minutes > 0 ? Math.round((typed.length / 5) / minutes) : 0;
  const accuracy = typed.length > 0 ? Math.max(0, Math.round((1 - errors / typed.length) * 100)) : 100;
  setText($("typing-wpm"), wpm);
  setText($("typing-accuracy"), `${accuracy}%`);
  setText($("typing-errors"), errors);
  renderTypingTarget(typed);

  if (typed === appState.snippet.code) {
    appState.practiceCompleted = true;
    const result = await python.run(appState.snippet.code);
    setText($("typing-output"), result.output);
    $("typing-output").classList.toggle("error", result.error);
    $("typing-output-panel").hidden = false;
    if (!appState.progress.completedSnippets.includes(appState.snippet.id)) {
      appState.progress = markSnippetCompleted(appState.progress, appState.snippet.id);
      saveProgress();
      awardExperience(XP.typingDrill, `${wpm} WPM · ${accuracy}% accuracy`);
    } else {
      showToast(`Drill complete · ${wpm} WPM`);
    }
  }
}

function pickBlankExercise() {
  appState.blankExercise = catalog.midSnippets[Math.floor(Math.random() * catalog.midSnippets.length)];
  appState.blankCompleted = false;
  setText($("blank-file"), appState.blankExercise.file);
  setText($("blank-title"), appState.blankExercise.title);
  $("blank-output-panel").hidden = true;
  renderBlankTemplate();
  updateBlankProgress();
}

function renderBlankTemplate() {
  const workspace = $("blank-workspace");
  clear(workspace);
  const segments = appState.blankExercise.template.split(/@@(\d+)@@/);
  for (let index = 0; index < segments.length; index += 1) {
    if (index % 2 === 0) {
      workspace.append(document.createTextNode(segments[index]));
      continue;
    }
    const blankIndex = Number(segments[index]) - 1;
    const expected = appState.blankExercise.blanks[blankIndex] ?? "";
    const input = element("input", {
      className: "inline-blank",
      attributes: {
        type: "text",
        "data-blank-index": blankIndex,
        "aria-label": `Blank ${blankIndex + 1}`,
        autocomplete: "off",
        spellcheck: "false"
      }
    });
    input.style.width = `${Math.max(60, expected.length * 10)}px`;
    input.addEventListener("input", handleBlankInput);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        const inputs = [...workspace.querySelectorAll("input.inline-blank")];
        const next = inputs[inputs.indexOf(input) + 1];
        (next ?? input).focus();
      }
    });
    workspace.append(input);
  }
}

function handleBlankInput(event) {
  const input = event.currentTarget;
  const index = Number(input.dataset.blankIndex);
  const expected = appState.blankExercise.blanks[index];
  input.classList.toggle("correct", input.value === expected);
  input.classList.toggle("wrong", input.value.length > 0 && input.value !== expected);
  updateBlankProgress();
}

function updateBlankProgress() {
  const inputs = [...$("blank-workspace").querySelectorAll("input.inline-blank")];
  const correct = inputs.filter(input => input.value === appState.blankExercise.blanks[Number(input.dataset.blankIndex)]).length;
  setText($("blank-progress"), `${correct} / ${inputs.length}`);
  if (inputs.length > 0 && correct === inputs.length && !appState.blankCompleted) {
    appState.blankCompleted = true;
    const values = appState.blankExercise.blanks;
    const completedCode = appState.blankExercise.template.replace(/@@(\d+)@@/g, (_match, number) => values[Number(number) - 1]);
    python.run(completedCode).then(result => {
      setText($("blank-output"), result.output);
      $("blank-output").classList.toggle("error", result.error);
      $("blank-output-panel").hidden = false;
    });
    awardExperience(XP.fillBlanks, appState.blankExercise.title);
  }
}

function renderChallengeList() {
  const list = $("challenge-list");
  clear(list);
  const groups = [...new Set(challengeCatalog.map(challenge => challenge.group))];
  for (const group of groups) {
    list.append(element("p", { className: "challenge-group", text: group }));
    const items = challengeCatalog.filter(challenge => challenge.group === group);
    for (const challenge of items) {
      const button = element("button", {
        className: `challenge-item${appState.challenge?.key === challenge.key ? " active" : ""}`,
        attributes: { type: "button", "data-challenge-key": challenge.key }
      });
      const solved = appState.progress?.solvedProblems.includes(challenge.key) ?? false;
      button.append(element("span", { className: "solved-mark", text: solved ? "✓" : "·" }));
      button.append(element("span", { text: challenge.title }));
      button.append(element("span", { className: "challenge-kind", text: challenge.kind === "stdin" ? "I/O" : "FN" }));
      button.addEventListener("click", () => openChallenge(challenge.key));
      list.append(button);
    }
  }
}

function openChallenge(key) {
  appState.challenge = challengeCatalog.find(challenge => challenge.key === key) ?? null;
  appState.hintsShown = 0;
  if (!appState.challenge) return;
  $("challenge-empty").hidden = true;
  $("challenge-content").hidden = false;
  setText($("challenge-title"), appState.challenge.title);
  setText($("challenge-meta"), `${appState.challenge.kind === "stdin" ? "STDIN / STDOUT" : "PYTHON FUNCTION"} · ${appState.challenge.group}`);
  setText($("challenge-difficulty"), appState.challenge.difficulty ?? "Practice");
  setText($("challenge-description"), appState.challenge.description);
  const hasIo = appState.challenge.kind === "stdin";
  $("challenge-io-spec").hidden = !hasIo;
  if (hasIo) {
    setText($("challenge-input-spec"), appState.challenge.input_spec);
    setText($("challenge-output-spec"), appState.challenge.output_spec);
  }
  renderExamples(appState.challenge.examples ?? []);
  clear($("challenge-hints"));
  setText($("hint-count"), `0 / ${appState.challenge.hints.length}`);
  $("challenge-code").value = appState.challenge.starter;
  updateCodeByteCount();
  $("challenge-result").hidden = true;
  $("submit-challenge").disabled = !python.ready;
  renderChallengeList();
}

function renderExamples(examples) {
  const container = $("challenge-examples");
  clear(container);
  examples.forEach((example, index) => {
    const card = element("article", { className: "example-card" });
    card.append(element("h3", { text: `Example ${index + 1} · Input` }));
    const input = element("pre", { text: example.input });
    card.append(input);
    card.append(element("h3", { text: "Expected output" }));
    card.append(element("pre", { text: example.output }));
    if (example.explanation) card.append(element("p", { className: "muted small", text: example.explanation }));
    container.append(card);
  });
}

function revealHint() {
  const challenge = appState.challenge;
  if (!challenge || appState.hintsShown >= challenge.hints.length) return;
  const hint = challenge.hints[appState.hintsShown];
  appState.hintsShown += 1;
  $("challenge-hints").append(element("p", { className: "hint-item", text: hint }));
  setText($("hint-count"), `${appState.hintsShown} / ${challenge.hints.length}`);
  if (appState.hintsShown >= challenge.hints.length) $("show-hint").disabled = true;
}

function updateCodeByteCount() {
  const result = validateCode($("challenge-code").value);
  setText($("code-byte-count"), `${result.bytes.toLocaleString()} / ${result.maxBytes.toLocaleString()} bytes`);
  $("code-byte-count").classList.toggle("over-limit", !result.valid);
  $("submit-challenge").disabled = !python.ready || !result.valid || !appState.challenge;
}

async function runCurrentChallenge() {
  const challenge = appState.challenge;
  if (!challenge) return;
  const code = $("challenge-code").value;
  const validation = validateCode(code);
  if (!validation.valid) {
    showToast(validation.message, "error");
    return;
  }
  if (!python.ready) {
    showToast("Python is still loading.", "error");
    return;
  }

  const submit = $("submit-challenge");
  submit.disabled = true;
  submit.textContent = "Running tests…";
  let passed = false;
  let output = "";

  try {
    if (challenge.kind === "function") {
      const result = await python.runFunctionTests(code, challenge.tests);
      passed = result.passed;
      output = result.output;
    } else {
      const results = [];
      for (const test of challenge.tests) {
        const result = await python.runStdin(code, test.input);
        const testPassed = !result.error && result.output.trim() === String(test.expected).trim();
        results.push({ passed: testPassed, input: test.input, actual: result.output, expected: test.expected, error: result.error });
      }
      passed = results.length > 0 && results.every(result => result.passed);
      output = results.map((result, index) => {
        const status = result.passed ? "PASS" : "FAIL";
        const actual = result.error || result.actual || "(empty output)";
        return `${status} · Test ${index + 1}\nInput: ${String(result.input).replaceAll("\n", " / ")}\nOutput: ${actual}${result.passed ? "" : `\nExpected: ${result.expected}`}`;
      }).join("\n\n");
    }
  } catch (error) {
    output = String(error?.message ?? error);
    passed = false;
  }

  $("challenge-result").hidden = false;
  setText($("challenge-result-heading"), passed ? "All tests passed" : "Some tests failed");
  $("challenge-result-heading").classList.toggle("failed", !passed);
  setText($("challenge-result-output"), output);
  $("challenge-result-output").classList.toggle("error", !passed);

  if (passed && !appState.progress.solvedProblems.includes(challenge.key)) {
    appState.progress = markProblemSolved(appState.progress, challenge.key);
    saveProgress();
    awardExperience(challenge.xp, challenge.title);
    renderChallengeList();
  } else if (passed) {
    showToast("Already solved. Keep practising.");
  } else {
    showToast("Not quite. Read the failing output and try again.", "error");
  }

  submit.textContent = "Run tests";
  updateCodeByteCount();
}

function renderProjects() {
  const grid = $("projects-grid");
  clear(grid);
  catalog.projects.forEach(project => {
    const card = element("button", {
      className: "project-card",
      attributes: { type: "button", "data-project-slug": project.slug }
    });
    card.append(element("h2", { text: project.title }));
    card.append(element("p", { text: project.description }));
    card.append(element("span", { text: `${project.files.length} source file${project.files.length === 1 ? "" : "s"} · ${project.commands.length} local commands` }));
    card.addEventListener("click", () => openProject(project.slug));
    grid.append(card);
  });
}

function openProject(slug) {
  const project = catalog.projects.find(item => item.slug === slug);
  if (!project) return;
  const detail = $("project-detail");
  clear(detail);
  detail.hidden = false;

  const header = element("div", { className: "project-detail-header" });
  const intro = element("div");
  intro.append(element("h2", { text: project.title }));
  const docsUrl = safeHttpsUrl(project.docs);
  if (docsUrl !== "#") {
    const link = element("a", { className: "text-link", text: "Official documentation ↗", attributes: { href: docsUrl, target: "_blank", rel: "noopener noreferrer" } });
    intro.append(link);
  }
  const close = element("button", { className: "button button-secondary", text: "Close", attributes: { type: "button" } });
  close.addEventListener("click", () => { detail.hidden = true; });
  header.append(intro, close);
  detail.append(header);

  const filesSection = element("section", { className: "project-file" });
  filesSection.append(element("h3", { text: "SOURCE FILES" }));
  project.files.forEach(file => {
    filesSection.append(element("p", { className: "muted small mono", text: file.path }));
    appendCodeBlock(filesSection, file.code);
  });
  detail.append(filesSection);

  const commands = element("section", { className: "project-file" });
  commands.append(element("h3", { text: "RUN LOCALLY" }));
  const localList = element("div", { className: "command-list" });
  project.commands.forEach(command => localList.append(element("code", { text: `$ ${command}` })));
  commands.append(localList);
  const gitList = element("div", { className: "command-list" });
  gitList.append(element("h3", { text: "PUSH TO GITHUB" }));
  project.gitCommands.forEach(command => gitList.append(element("code", { text: `$ ${command}` })));
  commands.append(gitList);
  detail.append(commands);
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderLeaderboard() {
  const body = $("leaderboard-body");
  clear(body);
  const directory = readUserDirectory();
  const rows = [...catalog.peers];
  for (const username of Object.keys(directory)) {
    const record = directory[username];
    if (!record || record.guest || !validateUsername(username).valid) continue;
    const progress = progressRepository.load(username);
    rows.push({
      username,
      xp: progress.xp,
      level: levelForXp(progress.xp),
      isMe: appState.user?.username === username
    });
  }
  if (appState.user?.guest) {
    rows.push({ username: appState.user.username, xp: appState.progress.xp, level: appState.progress.level, isMe: true });
  }
  rows.sort((a, b) => b.xp - a.xp || a.username.localeCompare(b.username));
  const seen = new Set();
  const uniqueRows = rows.filter(row => {
    if (seen.has(row.username)) return false;
    seen.add(row.username);
    return true;
  });

  uniqueRows.forEach((row, index) => {
    const tr = element("tr", { className: row.isMe ? "current-user-row" : "" });
    tr.append(element("td", { text: index + 1 }));
    const usernameCell = element("td");
    usernameCell.append(createUserLabel(row.username));
    if (row.isMe) usernameCell.append(document.createTextNode(" · you"));
    tr.append(usernameCell);
    tr.append(element("td", { text: `Lv ${row.level}` }));
    tr.append(element("td", { className: "xp-cell", text: row.xp }));
    body.append(tr);
  });
}

function renderProfile() {
  if (!appState.user || !appState.progress) return;
  setText($("profile-avatar"), appState.user.username.slice(0, 1).toUpperCase());
  setText($("profile-username"), `@${appState.user.username}`);
  setText($("profile-created"), `Created ${new Date(appState.user.createdAt).toLocaleDateString()}`);
  setText($("profile-account-type"), appState.user.guest ? "GUEST · LOCAL ONLY" : "LOCAL ACCOUNT");
  setText($("profile-level"), appState.progress.level);
  setText($("profile-xp"), appState.progress.xp);
  setText($("profile-solved"), appState.progress.solvedProblems.length);
  setText($("profile-drills"), appState.progress.completedSnippets.length);
}

function exportProgress() {
  if (!appState.progress) return;
  const json = progressRepository.export(appState.progress);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = element("a", { attributes: { href: url, download: `codetype-progress-${appState.user.username}.json` } });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Progress export created.");
}

function logout() {
  auth.logout();
  appState.user = null;
  appState.progress = null;
  appState.challenge = null;
  $("auth-password").value = "";
  $("typing-input").value = "";
  $("application").hidden = true;
  $("auth-screen").hidden = false;
  clearAuthError();
  showToast("You are logged out.");
}

// ----------------------------- Event wiring -----------------------------
$("login-tab").addEventListener("click", () => setAuthMode("login"));
$("signup-tab").addEventListener("click", () => setAuthMode("signup"));
$("auth-password").addEventListener("input", updatePasswordMeter);

$("auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthError();
  const username = $("auth-username").value;
  const password = $("auth-password").value;
  const submit = $("auth-submit");
  submit.disabled = true;
  submit.textContent = authMode === "signup" ? "Creating account…" : "Checking…";
  try {
    const user = authMode === "signup"
      ? await auth.signup(username, password)
      : await auth.login(username, password);
    await enterApplication(user);
  } catch (error) {
    showAuthError(error?.message === "Invalid credentials."
      ? "Invalid credentials. Check your username and password."
      : (error?.message ?? "Unable to complete sign-in."));
  } finally {
    submit.disabled = false;
    submit.textContent = authMode === "signup" ? "Create account" : "Log in";
  }
});

$("guest-button").addEventListener("click", async () => {
  try {
    await enterApplication(auth.continueAsGuest());
  } catch (error) {
    showAuthError(error?.message ?? "Guest session could not be created.");
  }
});

$("logout-button").addEventListener("click", logout);
$("avatar-button").addEventListener("click", () => setPage("profile"));
$("export-progress").addEventListener("click", exportProgress);
$("challenge-open-thinking").addEventListener("click", () => {
  learningStudio.openTool("think");
  setPage("studio");
});

for (const button of document.querySelectorAll("[data-page]")) {
  button.addEventListener("click", () => setPage(button.dataset.page));
}
for (const button of document.querySelectorAll("[data-practice-mode]")) {
  button.addEventListener("click", () => setPracticeMode(button.dataset.practiceMode));
}

$("typing-input").addEventListener("input", () => { void updateTypingProgress(); });
$("next-snippet").addEventListener("click", pickSnippet);
$("next-blank").addEventListener("click", pickBlankExercise);
$("show-hint").addEventListener("click", revealHint);
$("challenge-code").addEventListener("input", updateCodeByteCount);
$("submit-challenge").addEventListener("click", () => { void runCurrentChallenge(); });
$("reset-challenge").addEventListener("click", () => {
  if (!appState.challenge) return;
  $("challenge-code").value = appState.challenge.starter;
  $("challenge-result").hidden = true;
  updateCodeByteCount();
});

// Startup: restore a 7-day local session and rotate its token, or show sign-in.
try {
  const restoredUser = auth.checkSession();
  if (restoredUser) {
    await enterApplication(restoredUser);
  } else {
    setAppVisible(false);
  }
} catch (error) {
  auth.logout();
  setAppVisible(false);
  showAuthError(error?.message ?? "Session could not be restored.");
}
