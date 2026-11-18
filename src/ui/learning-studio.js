import { BLACK_BOXES, findBlackBox, evaluateBlackBox } from "../learning/black-boxes.js";
import { decideAsync, ASYNC_LESSONS } from "../learning/async-decision.js";
import { inspectPythonStyle, STYLE_PRINCIPLES, STYLE_SAMPLE, STYLE_REWRITE } from "../learning/python-style.js";
import { REVISION_CARDS, getDueCards, gradeReview, createStudyPlan } from "../learning/revision.js";
import { appendCodeBlock, clear, element, setText } from "./dom.js";

const THINK_STEPS = Object.freeze([
  { id: "specify", title: "Specify the contract", question: "What exactly must this procedure do?", prompt: "Write the inputs, output, preconditions, postconditions, and one invariant. Avoid implementation details.", artifact: "A precise contract" },
  { id: "examples", title: "Make examples", question: "What should happen on ordinary and boundary inputs?", prompt: "Write one ordinary example, one boundary example, and one case that should be rejected or handled explicitly.", artifact: "A behavior table" },
  { id: "decompose", title: "Find the black boxes", question: "Which smaller procedures can you trust by contract?", prompt: "Name the smaller operations. For each one, write its input and output contract. Do not open its implementation yet.", artifact: "A decomposition" },
  { id: "compose", title: "Compose the solution", question: "How do outputs become inputs?", prompt: "Describe the data flow from the original input to the final result. Make each transformation explicit.", artifact: "A composition path" },
  { id: "verify", title: "Verify the invariant", question: "What must remain true?", prompt: "Write the invariant and the tests that would falsify your design. Include an edge case and explain why it matters.", artifact: "A verification argument" },
  { id: "reflect", title: "Reflect on representation", question: "What can change without breaking callers?", prompt: "Identify one implementation detail that can change while the public contract stays stable. Explain why callers should not depend on it.", artifact: "An abstraction boundary" }
]);

const TOOL_LABELS = [
  ["blackboxes", "Black-box workbench", "01"],
  ["think", "Thinking protocol", "02"],
  ["async", "Async decision lab", "03"],
  ["style", "Style & detection", "04"],
  ["revision", "Active recall", "05"],
  ["plan", "Study planner", "06"]
];

function makeLearningState(progress) {
  if (!progress.learning || typeof progress.learning !== "object") {
    progress.learning = { notes: {}, completedSteps: [], reviewSchedules: {}, plan: null };
  }
  const learning = progress.learning;
  if (!learning.notes || typeof learning.notes !== "object") learning.notes = {};
  if (!Array.isArray(learning.completedSteps)) learning.completedSteps = [];
  if (!learning.reviewSchedules || typeof learning.reviewSchedules !== "object") learning.reviewSchedules = {};
  return learning;
}

function label(parent, text, className = "") {
  const node = element("label", { className, text });
  parent.append(node);
  return node;
}

function field(parent, { name, title, value, type = "text", hint = "" }) {
  const wrap = element("div", { className: "studio-field" });
  const inputId = `studio-${name}`;
  const lab = element("label", { text: title, attributes: { for: inputId } });
  const input = element("input", { className: "studio-input mono", attributes: { id: inputId, type, value, "data-box-input": name, inputmode: type === "number" ? "decimal" : "text" } });
  wrap.append(lab, input);
  if (hint) wrap.append(element("p", { className: "field-help", text: hint }));
  parent.append(wrap);
  return input;
}

function bulletList(items, className = "studio-bullet-list") {
  const list = element("ul", { className });
  for (const item of items) list.append(element("li", { text: item }));
  return list;
}

function addHeading(parent, eyebrow, title, description = "") {
  const heading = element("div", { className: "studio-heading" });
  heading.append(element("p", { className: "eyebrow", text: eyebrow }));
  heading.append(element("h2", { text: title }));
  if (description) heading.append(element("p", { className: "muted", text: description }));
  parent.append(heading);
  return heading;
}

export class LearningStudio {
  #root;
  #nav;
  #getProgress;
  #saveProgress;
  #notify;
  #activeTool = "blackboxes";
  #selectedBoxId = "sum-squares";
  #boxInputs = Object.create(null);
  #implementationVisible = false;
  #lastEvaluation = null;
  #stepIndex = 0;
  #styleSource = STYLE_SAMPLE;
  #styleReport = null;
  #asyncInputs = { workload: "io", api: "async", independentTasks: "many" };
  #reviewCardId = null;
  #answerVisible = false;

  constructor({ root, nav, getProgress, saveProgress, notify }) {
    this.#root = root;
    this.#nav = nav;
    this.#getProgress = getProgress;
    this.#saveProgress = saveProgress;
    this.#notify = notify;

    this.#nav.addEventListener("click", event => {
      const button = event.target.closest("[data-studio-tool]");
      if (!button) return;
      this.#activeTool = button.dataset.studioTool;
      this.render();
    });
    this.#root.addEventListener("click", event => this.#handleClick(event));
    this.#root.addEventListener("input", event => this.#handleInput(event));
    this.#root.addEventListener("change", event => this.#handleChange(event));
  }

  openTool(tool) {
    const supported = TOOL_LABELS.some(([id]) => id === tool);
    this.#activeTool = supported ? tool : "blackboxes";
    this.render();
  }

  render() {
    for (const button of this.#nav.querySelectorAll("[data-studio-tool]")) {
      const active = button.dataset.studioTool === this.#activeTool;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    }
    clear(this.#root);
    const progress = this.#getProgress();
    if (!progress) return;
    makeLearningState(progress);
    const renderer = {
      blackboxes: () => this.#renderBlackBoxes(),
      think: () => this.#renderThinkProtocol(),
      async: () => this.#renderAsyncLab(),
      style: () => this.#renderStyleLab(),
      revision: () => this.#renderRevision(),
      plan: () => this.#renderPlanner()
    }[this.#activeTool] ?? (() => this.#renderBlackBoxes());
    renderer();
  }

  #persist() {
    this.#saveProgress();
  }

  #renderBlackBoxes() {
    const box = findBlackBox(this.#selectedBoxId);
    const shell = element("div", { className: "studio-tool-view" });
    addHeading(shell, "SICP / ABSTRACTION BOUNDARIES", "Black-box workbench", "Study what a procedure promises before you inspect how it is built. A caller should depend on the contract, not the representation.");

    const layout = element("div", { className: "blackbox-layout" });
    const index = element("aside", { className: "studio-panel blackbox-index" });
    index.append(element("p", { className: "micro-label", text: "PROCEDURE INDEX" }));
    for (const item of BLACK_BOXES) {
      const button = element("button", { className: `blackbox-choice${item.id === box.id ? " active" : ""}`, attributes: { type: "button", "data-box-id": item.id } });
      button.append(element("span", { className: "blackbox-choice-level", text: item.level }));
      const copy = element("span", { className: "blackbox-choice-copy" });
      copy.append(element("strong", { text: item.title }), element("small", { text: item.family }));
      button.append(copy, element("span", { className: "blackbox-choice-arrow", text: "↗" }));
      index.append(button);
    }
    index.append(element("p", { className: "blackbox-index-note", text: "Choose a procedure. Start at its public interface; the internal representation is deliberately hidden." }));

    const detail = element("article", { className: "studio-panel blackbox-detail" });
    const top = element("div", { className: "blackbox-topline" });
    top.append(element("span", { className: "eyebrow", text: `BLACK BOX ${box.level} / ${box.family.toUpperCase()}` }));
    top.append(element("span", { className: "contract-stamp", text: "CONTRACT FIRST" }));
    detail.append(top, element("h3", { className: "blackbox-title", text: box.title }), element("p", { className: "muted blackbox-purpose", text: box.purpose }));
    const signature = element("div", { className: "signature-bar" });
    signature.append(element("span", { className: "micro-label", text: "PUBLIC SIGNATURE" }), element("code", { text: box.signature }));
    detail.append(signature);

    const contractGrid = element("div", { className: "contract-grid" });
    for (const [name, value] of Object.entries(box.contract)) {
      const card = element("div", { className: "contract-cell" });
      card.append(element("span", { className: "micro-label", text: name.toUpperCase() }), element("p", { text: value }));
      contractGrid.append(card);
    }
    detail.append(contractGrid);

    const knowledgeGrid = element("div", { className: "knowledge-grid" });
    const caller = element("section", { className: "knowledge-card knows" });
    caller.append(element("h4", { text: "CALLER MAY DEPEND ON" }), bulletList(box.callerKnows));
    const hidden = element("section", { className: "knowledge-card hidden-details" });
    hidden.append(element("h4", { text: "CALLER MUST NOT DEPEND ON" }), bulletList(box.callerDoesNotKnow));
    knowledgeGrid.append(caller, hidden);
    detail.append(knowledgeGrid);

    const flow = element("div", { className: "composition-flow" });
    flow.append(element("span", { className: "micro-label", text: "COMPOSITION / DATA FLOW" }));
    const flowTrack = element("div", { className: "composition-flow-track" });
    for (const [index, step] of box.flow.entries()) {
      if (index > 0) flowTrack.append(element("span", { className: "flow-arrow", text: "→" }));
      flowTrack.append(element("span", { className: "flow-node", text: step }));
    }
    flow.append(flowTrack);
    detail.append(flow);

    const experiment = element("section", { className: "contract-experiment" });
    const experimentHead = element("div", { className: "experiment-heading" });
    experimentHead.append(element("div", { text: "INTERACTIVE CONTRACT" }), element("p", { text: "Deterministic contract simulator (not Python execution). Change inputs and observe only the promised output." }));
    experiment.append(experimentHead);
    const fieldGrid = element("div", { className: "studio-fields" });
    for (const definition of box.fields) {
      const value = this.#boxInputs[box.id]?.[definition.name] ?? definition.value;
      field(fieldGrid, { ...definition, value });
    }
    experiment.append(fieldGrid);
    const actions = element("div", { className: "button-row" });
    actions.append(element("button", { className: "button button-primary", text: "Evaluate contract", attributes: { type: "button", "data-action": "evaluate-box" } }));
    actions.append(element("button", { className: "button button-secondary", text: this.#implementationVisible ? "Hide representation" : "Reveal representation", attributes: { type: "button", "data-action": "toggle-implementation", "aria-expanded": String(this.#implementationVisible) } }));
    experiment.append(actions);

    if (this.#lastEvaluation?.boxId === box.id) {
      const output = element("div", { className: "experiment-output" });
      output.append(element("span", { className: "micro-label", text: "OBSERVED RESULT" }), element("strong", { text: this.#lastEvaluation.value === null ? "None" : this.#lastEvaluation.value }));
      const trace = element("ol", { className: "trace-list" });
      for (const step of this.#lastEvaluation.trace) trace.append(element("li", { text: step }));
      output.append(trace);
      experiment.append(output);
    }

    if (this.#implementationVisible) {
      const implementation = element("section", { className: "implementation-reveal" });
      implementation.append(element("div", { className: "micro-label", text: "HIDDEN REPRESENTATION / REVEALED" }));
      appendCodeBlock(implementation, box.implementation);
      implementation.append(element("p", { className: "muted small", text: box.composition }));
      experiment.append(implementation);
    } else {
      experiment.append(element("p", { className: "hidden-representation-note", text: "Implementation hidden. Can you predict the output using only the contract?" }));
    }
    detail.append(experiment);

    const boundary = element("div", { className: "boundary-strip" });
    boundary.append(element("span", { className: "micro-label", text: "BOUNDARY TESTS" }));
    for (const example of box.boundaryExamples) boundary.append(element("code", { text: example }));
    detail.append(boundary);
    layout.append(index, detail);
    shell.append(layout);
    shell.append(this.#principleCallout("The abstraction rule", "A higher layer can call a lower layer through its public contract. Changing the lower layer's internal representation should not force callers to change."));
    this.#root.append(shell);
  }

  #renderThinkProtocol() {
    const shell = element("div", { className: "studio-tool-view" });
    const learning = makeLearningState(this.#getProgress());
    const completed = new Set(learning.completedSteps);
    addHeading(shell, "SICP / PROBLEM SOLVING", "Think before you type.", "Move from a specification to a verified composition. Your notes are saved with your local progress.");

    const layout = element("div", { className: "think-layout" });
    const rail = element("aside", { className: "studio-panel think-step-list" });
    rail.append(element("p", { className: "micro-label", text: "REASONING SEQUENCE" }));
    THINK_STEPS.forEach((step, index) => {
      const button = element("button", { className: `think-step${index === this.#stepIndex ? " active" : ""}${completed.has(step.id) ? " completed" : ""}`, attributes: { type: "button", "data-step-index": index } });
      button.append(element("span", { className: "think-step-number", text: String(index + 1).padStart(2, "0") }));
      const copy = element("span", { className: "think-step-copy" });
      copy.append(element("strong", { text: step.title }), element("small", { text: completed.has(step.id) ? "Recorded" : step.artifact }));
      button.append(copy, element("span", { className: "think-step-mark", text: completed.has(step.id) ? "✓" : "·" }));
      rail.append(button);
    });
    const step = THINK_STEPS[this.#stepIndex] ?? THINK_STEPS[0];
    const workspace = element("article", { className: "studio-panel think-workspace" });
    workspace.append(element("p", { className: "eyebrow", text: `STEP ${String(this.#stepIndex + 1).padStart(2, "0")} / 06` }));
    workspace.append(element("h3", { className: "think-question", text: step.question }));
    workspace.append(element("p", { className: "muted", text: step.prompt }));
    const noteLabel = element("label", { text: "Your reasoning notes", attributes: { for: "think-note" } });
    const note = element("textarea", { className: "studio-textarea", attributes: { id: "think-note", rows: 9, maxlength: 2400, placeholder: "Do not write code yet. Write the reasoning that makes the code inevitable…", "data-think-note": step.id } });
    note.value = String(learning.notes[step.id] ?? "");
    workspace.append(noteLabel, note);
    workspace.append(element("p", { className: "editor-status", text: `${note.value.length} / 2,400 characters · saved when you mark this step` }));
    const actionRow = element("div", { className: "button-row" });
    actionRow.append(element("button", { className: "button button-primary", text: completed.has(step.id) ? "Update completed step" : "Save & complete step", attributes: { type: "button", "data-action": "complete-step", "data-step-id": step.id } }));
    if (this.#stepIndex > 0) actionRow.append(element("button", { className: "button button-secondary", text: "Previous", attributes: { type: "button", "data-action": "previous-step" } }));
    if (this.#stepIndex < THINK_STEPS.length - 1) actionRow.append(element("button", { className: "button button-secondary", text: "Next step →", attributes: { type: "button", "data-action": "next-step" } }));
    workspace.append(actionRow);
    layout.append(rail, workspace);
    shell.append(layout);

    const status = element("div", { className: "think-progress-strip" });
    status.append(element("strong", { text: `${completed.size} / ${THINK_STEPS.length} reasoning artifacts recorded` }));
    const track = element("span", { className: "think-progress-track" });
    const fill = element("span", { attributes: { style: `width:${(completed.size / THINK_STEPS.length) * 100}%` } });
    track.append(fill);
    status.append(track);
    shell.append(status);
    this.#root.append(shell);
  }

  #renderAsyncLab() {
    const shell = element("div", { className: "studio-tool-view" });
    addHeading(shell, "PYTHON / CONCURRENCY", "Should this be async?", "Do not decorate a function with async because it looks advanced. Follow the nature of the work and the APIs it calls.");
    const grid = element("div", { className: "async-layout" });
    const form = element("section", { className: "studio-panel async-controls" });
    form.append(element("p", { className: "micro-label", text: "DESCRIBE THE WORKLOAD" }));
    this.#appendSelect(form, "Workload", "workload", this.#asyncInputs.workload, [
      ["pure", "Pure logic / in-memory work"], ["io", "Network / async I/O wait"], ["cpu", "CPU-heavy computation"]
    ]);
    this.#appendSelect(form, "Library interface", "api", this.#asyncInputs.api, [["async", "Library provides awaitable API"], ["sync", "Library only provides blocking sync API"]]);
    this.#appendSelect(form, "Independent operations", "independentTasks", this.#asyncInputs.independentTasks, [["one", "One operation"], ["many", "Many independent operations"]]);
    form.append(element("p", { className: "field-help", text: "Change a choice to recalculate the recommendation. There is no universal rule based only on the number of lines." }));

    const result = decideAsync(this.#asyncInputs);
    const answer = element("article", { className: "studio-panel async-answer" });
    answer.append(element("span", { className: "contract-stamp", text: `RECOMMENDATION / ${result.form.toUpperCase()}` }));
    answer.append(element("h3", { text: result.choice }));
    const why = element("div", { className: "async-explanation" });
    why.append(element("span", { className: "micro-label", text: "WHY" }), element("p", { text: result.why }));
    const concurrency = element("div", { className: "async-explanation" });
    concurrency.append(element("span", { className: "micro-label", text: "CONCURRENCY CONSEQUENCE" }), element("p", { text: result.concurrency }));
    answer.append(why, concurrency);
    const code = element("section", { className: "async-code" });
    code.append(element("div", { className: "micro-label", text: "EXAMPLE SHAPE" }));
    appendCodeBlock(code, result.example);
    answer.append(code);
    grid.append(form, answer);
    shell.append(grid);

    const lessons = element("div", { className: "async-lesson-grid" });
    ASYNC_LESSONS.forEach((lesson, index) => {
      const card = element("article", { className: "async-lesson-card" });
      card.append(element("span", { className: "lesson-index", text: `0${index + 1}` }), element("h3", { text: lesson.title }), element("p", { text: lesson.body }));
      lessons.append(card);
    });
    shell.append(lessons);
    shell.append(this.#principleCallout("A practical rule", "Use async when you must await async I/O or compose with an async interface. Keep CPU-heavy work out of the event loop. If the library is blocking, async def does not make it non-blocking."));
    this.#root.append(shell);
  }

  #appendSelect(parent, title, name, value, options) {
    const wrap = element("div", { className: "studio-field" });
    const id = `async-${name}`;
    wrap.append(element("label", { text: title, attributes: { for: id } }));
    const select = element("select", { className: "studio-select", attributes: { id, "data-async-input": name } });
    for (const [optionValue, optionLabel] of options) {
      const option = element("option", { text: optionLabel, attributes: { value: optionValue } });
      option.selected = optionValue === value;
      select.append(option);
    }
    wrap.append(select);
    parent.append(wrap);
  }

  #renderStyleLab() {
    const shell = element("div", { className: "studio-tool-view" });
    addHeading(shell, "PYTHON / CODE REVIEW", "Read the shape of the code.", "Style is a reasoning aid: names, boundaries, indentation, and controlled state should make intent visible.");
    const layout = element("div", { className: "style-layout" });
    const editor = element("section", { className: "studio-panel style-editor" });
    editor.append(element("div", { className: "panel-header", text: "REVIEW BUFFER · python" }));
    const textarea = element("textarea", { className: "studio-textarea style-code-input mono", attributes: { id: "style-code", rows: 17, maxlength: 20480, spellcheck: "false", "data-style-code": "true" } });
    textarea.value = this.#styleSource;
    editor.append(textarea);
    const actions = element("div", { className: "button-row" });
    actions.append(element("button", { className: "button button-primary", text: "Inspect code", attributes: { type: "button", "data-action": "inspect-style" } }));
    actions.append(element("button", { className: "button button-secondary", text: "Load flawed sample", attributes: { type: "button", "data-action": "style-sample" } }));
    actions.append(element("button", { className: "button button-secondary", text: "Load cleaner version", attributes: { type: "button", "data-action": "style-rewrite" } }));
    editor.append(actions);
    const results = element("section", { className: "studio-panel style-results" });
    results.append(element("p", { className: "micro-label", text: "DETECTION REPORT" }));
    if (!this.#styleReport) {
      results.append(element("div", { className: "style-empty", text: "Run an inspection to see which design choices deserve a closer look." }));
    } else {
      results.append(element("h3", { text: this.#styleReport.summary }));
      this.#styleReport.findings.forEach(finding => {
        const card = element("article", { className: `finding-card severity-${finding.severity}` });
        const top = element("div", { className: "finding-top" });
        top.append(element("strong", { text: finding.title }), element("span", { text: `LINE ${finding.line} · ${finding.severity.toUpperCase()}` }));
        card.append(top, element("p", { text: finding.explain }), element("p", { className: "finding-fix", text: `Try: ${finding.fix}` }));
        results.append(card);
      });
      if (this.#styleReport.findings.length === 0) results.append(element("p", { className: "style-empty", text: "Good. No configured review signals were found in this sample." }));
      results.append(element("p", { className: "style-caveat", text: this.#styleReport.caveat }));
    }
    layout.append(editor, results);
    shell.append(layout);

    const principles = element("div", { className: "style-principles" });
    STYLE_PRINCIPLES.forEach((principle, index) => {
      const card = element("article", { className: "style-principle-card" });
      card.append(element("span", { className: "lesson-index", text: `0${index + 1}` }), element("h3", { text: principle.name }), element("p", { text: principle.principle }));
      appendCodeBlock(card, principle.example);
      principles.append(card);
    });
    shell.append(principles);
    this.#root.append(shell);
  }

  #renderRevision() {
    const shell = element("div", { className: "studio-tool-view" });
    const learning = makeLearningState(this.#getProgress());
    const due = getDueCards(REVISION_CARDS, learning.reviewSchedules, Date.now());
    const current = due.find(card => card.id === this.#reviewCardId) ?? due[0] ?? null;
    this.#reviewCardId = current?.id ?? null;
    this.#answerVisible = false;
    addHeading(shell, "MEMORY / ACTIVE RECALL", "Retrieve, then reveal.", "Try to explain the concept from memory before looking at the answer. Rate the effort honestly; the next review date is saved locally.");
    const cardShell = element("section", { className: "studio-panel revision-card" });
    if (current) {
      cardShell.append(element("span", { className: "contract-stamp", text: current.topic.toUpperCase() }), element("p", { className: "revision-count", text: `${due.length} DUE NOW · ${REVISION_CARDS.length} TOTAL CARDS` }));
      cardShell.append(element("h3", { text: current.prompt }));
      if (this.#answerVisible) {
        cardShell.append(element("div", { className: "revision-answer", text: current.answer }));
        const ratings = element("div", { className: "revision-ratings" });
        for (const [rating, title, detail] of [["again", "Again", "5 min"], ["hard", "Hard", "1 day"], ["good", "Good", "3 days"], ["easy", "Easy", "7 days"]]) {
          const button = element("button", { className: "review-rating", attributes: { type: "button", "data-grade": rating } });
          button.append(element("strong", { text: title }), element("small", { text: detail }));
          ratings.append(button);
        }
        cardShell.append(ratings);
      } else {
        cardShell.append(element("p", { className: "muted", text: "Say the answer out loud or write it on paper. Then reveal and compare." }));
        cardShell.append(element("button", { className: "button button-primary", text: "Reveal explanation", attributes: { type: "button", "data-action": "reveal-answer" } }));
      }
    } else {
      cardShell.append(element("span", { className: "contract-stamp", text: "REVIEW CLEAR" }), element("h3", { text: "Nothing is due right now." }), element("p", { className: "muted", text: "Your next review is scheduled. Use the Study Planner to work on a new concept." }));
      const future = Object.values(learning.reviewSchedules).filter(record => Number.isFinite(record.dueAt) && record.dueAt > Date.now()).sort((a, b) => a.dueAt - b.dueAt)[0];
      if (future) cardShell.append(element("p", { className: "revision-next", text: `Next review: ${new Date(future.dueAt).toLocaleString()}` }));
    }
    shell.append(cardShell);
    const overview = element("div", { className: "revision-overview" });
    overview.append(element("span", { className: "micro-label", text: "MEMORY SYSTEM" }), element("p", { text: "Again → 5 minutes · Hard → 1 day · Good → 3 days · Easy → 7 days. This is a simple practice schedule, not a scientifically calibrated memory model." }));
    shell.append(overview);
    this.#root.append(shell);
  }

  #renderPlanner() {
    const shell = element("div", { className: "studio-tool-view" });
    const learning = makeLearningState(this.#getProgress());
    addHeading(shell, "INTENTIONAL PRACTICE / PLANNING", "Make the next session concrete.", "A useful plan is small enough to finish and specific enough to evaluate. Do not plan ten topics at once.");
    const layout = element("div", { className: "planner-layout" });
    const form = element("section", { className: "studio-panel planner-form" });
    form.append(element("p", { className: "micro-label", text: "SESSION PARAMETERS" }));
    const goal = element("div", { className: "studio-field" });
    goal.append(element("label", { text: "What do you want to understand?", attributes: { for: "plan-goal" } }));
    const goalInput = element("input", { className: "studio-input", attributes: { id: "plan-goal", maxlength: 120, value: learning.plan?.goal ?? "Understand abstraction and composition" } });
    goal.append(goalInput);
    const duration = element("div", { className: "studio-field" });
    duration.append(element("label", { text: "Available minutes", attributes: { for: "plan-minutes" } }));
    const minutesInput = element("input", { className: "studio-input", attributes: { id: "plan-minutes", type: "number", min: 10, max: 180, value: learning.plan?.minutes ?? 30 } });
    duration.append(minutesInput);
    const focus = element("div", { className: "studio-field" });
    focus.append(element("label", { text: "Focus area", attributes: { for: "plan-focus" } }));
    const select = element("select", { className: "studio-select", attributes: { id: "plan-focus" } });
    for (const [value, text] of [["abstraction", "Abstraction barriers"], ["composition", "Composition"], ["async", "Async or sync"], ["style", "Python style"], ["algorithms", "Algorithms & invariants"]]) {
      const option = element("option", { text, attributes: { value } });
      option.selected = value === (learning.plan?.focusKey ?? "abstraction");
      select.append(option);
    }
    focus.append(select);
    form.append(goal, duration, focus, element("button", { className: "button button-primary", text: "Generate session plan", attributes: { type: "button", "data-action": "generate-plan" } }));
    layout.append(form);

    const result = element("section", { className: "studio-panel planner-result" });
    if (learning.plan?.blocks) {
      result.append(element("p", { className: "micro-label", text: `YOUR ${learning.plan.minutes}-MINUTE SESSION` }), element("h3", { text: learning.plan.goal }), element("p", { className: "muted", text: learning.plan.focus }));
      const list = element("div", { className: "plan-blocks" });
      learning.plan.blocks.forEach((block, index) => {
        const item = element("article", { className: "plan-block" });
        item.append(element("span", { className: "lesson-index", text: `0${index + 1}` }));
        const copy = element("div");
        copy.append(element("strong", { text: block.title }), element("p", { text: block.task }));
        item.append(copy, element("span", { className: "plan-minutes", text: `${block.minutes}m` }));
        list.append(item);
      });
      result.append(list);
    } else {
      result.append(element("p", { className: "micro-label", text: "PLAN OUTPUT" }), element("h3", { text: "A focused session will appear here." }), element("p", { className: "muted", text: "Choose one objective and a realistic amount of time." }));
    }
    layout.append(result);
    shell.append(layout);
    shell.append(this.#principleCallout("The engineering habit", "Planning is decomposition over time. Choose the next smallest verifiable result, not a vague ambition to ‘learn Python’."));
    this.#root.append(shell);
  }

  #principleCallout(title, text) {
    const callout = element("aside", { className: "studio-principle-callout" });
    callout.append(element("span", { className: "callout-glyph", text: "λ" }));
    const copy = element("div");
    copy.append(element("strong", { text: title }), element("p", { text }));
    callout.append(copy);
    return callout;
  }

  #handleInput(event) {
    if (event.target.matches("[data-box-input]")) {
      const values = this.#boxInputs[this.#selectedBoxId] ?? Object.create(null);
      values[event.target.dataset.boxInput] = event.target.value;
      this.#boxInputs[this.#selectedBoxId] = values;
    }
    if (event.target.matches("[data-think-note]")) {
      const progress = this.#getProgress();
      const learning = makeLearningState(progress);
      learning.notes[event.target.dataset.thinkNote] = event.target.value.slice(0, 2400);
      this.#persist();
      const status = event.target.parentElement.querySelector(".editor-status");
      if (status) setText(status, `${event.target.value.length} / 2,400 characters · saved locally`);
    }
    if (event.target.matches("[data-style-code]")) {
      this.#styleSource = event.target.value;
      this.#styleReport = null;
    }
  }

  #handleChange(event) {
    if (event.target.matches("[data-async-input]")) {
      this.#asyncInputs[event.target.dataset.asyncInput] = event.target.value;
      this.render();
    }
  }

  #handleClick(event) {
    const boxButton = event.target.closest("[data-box-id]");
    if (boxButton) {
      this.#selectedBoxId = boxButton.dataset.boxId;
      this.#implementationVisible = false;
      this.#lastEvaluation = null;
      this.render();
      return;
    }
    const stepButton = event.target.closest("[data-step-index]");
    if (stepButton) {
      this.#stepIndex = Number(stepButton.dataset.stepIndex);
      this.render();
      return;
    }
    const gradeButton = event.target.closest("[data-grade]");
    if (gradeButton) {
      this.#gradeCurrentCard(gradeButton.dataset.grade);
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "evaluate-box") {
      const box = findBlackBox(this.#selectedBoxId);
      const values = Object.fromEntries([...this.#root.querySelectorAll("[data-box-input]")].map(input => [input.dataset.boxInput, input.value]));
      try {
        const result = evaluateBlackBox(box.id, values);
        this.#lastEvaluation = { boxId: box.id, value: result.value, trace: result.trace };
      } catch (error) {
        this.#lastEvaluation = { boxId: box.id, value: `Input error: ${error.message}`, trace: [] };
      }
      this.render();
    } else if (action === "toggle-implementation") {
      this.#implementationVisible = !this.#implementationVisible;
      this.render();
    } else if (action === "complete-step") {
      const id = event.target.dataset.stepId;
      const note = this.#root.querySelector("[data-think-note]")?.value ?? "";
      const progress = this.#getProgress();
      const learning = makeLearningState(progress);
      learning.notes[id] = note.slice(0, 2400);
      if (!learning.completedSteps.includes(id)) learning.completedSteps.push(id);
      this.#persist();
      this.#notify("Reasoning artifact saved.", "success");
      this.render();
    } else if (action === "next-step" || action === "previous-step") {
      this.#stepIndex = Math.max(0, Math.min(THINK_STEPS.length - 1, this.#stepIndex + (action === "next-step" ? 1 : -1)));
      this.render();
    } else if (action === "inspect-style") {
      this.#styleSource = this.#root.querySelector("[data-style-code]")?.value ?? this.#styleSource;
      this.#styleReport = inspectPythonStyle(this.#styleSource);
      this.render();
    } else if (action === "style-sample" || action === "style-rewrite") {
      this.#styleSource = action === "style-sample" ? STYLE_SAMPLE : STYLE_REWRITE;
      this.#styleReport = null;
      this.render();
    } else if (action === "reveal-answer") {
      this.#answerVisible = true;
      this.#renderRevisionWithAnswer();
    } else if (action === "generate-plan") {
      const goal = this.#root.querySelector("#plan-goal")?.value ?? "Understand one idea deeply";
      const minutes = Number(this.#root.querySelector("#plan-minutes")?.value ?? 30);
      const focusKey = this.#root.querySelector("#plan-focus")?.value ?? "abstraction";
      const plan = createStudyPlan({ goal, minutes, focus: focusKey });
      const learning = makeLearningState(this.#getProgress());
      learning.plan = { ...plan, focusKey, generatedAt: new Date().toISOString() };
      this.#persist();
      this.#notify("A focused study plan has been saved.", "success");
      this.render();
    }
  }

  #renderRevisionWithAnswer() {
    const learning = makeLearningState(this.#getProgress());
    const due = getDueCards(REVISION_CARDS, learning.reviewSchedules, Date.now());
    const current = due.find(card => card.id === this.#reviewCardId) ?? due[0] ?? null;
    if (!current) return this.render();
    const shell = this.#root.querySelector(".revision-card");
    if (!shell) return this.render();
    clear(shell);
    shell.append(element("span", { className: "contract-stamp", text: current.topic.toUpperCase() }), element("p", { className: "revision-count", text: `${due.length} DUE NOW · ${REVISION_CARDS.length} TOTAL CARDS` }), element("h3", { text: current.prompt }), element("div", { className: "revision-answer", text: current.answer }));
    const ratings = element("div", { className: "revision-ratings" });
    for (const [rating, title, detail] of [["again", "Again", "5 min"], ["hard", "Hard", "1 day"], ["good", "Good", "3 days"], ["easy", "Easy", "7 days"]]) {
      const button = element("button", { className: "review-rating", attributes: { type: "button", "data-grade": rating } });
      button.append(element("strong", { text: title }), element("small", { text: detail }));
      ratings.append(button);
    }
    shell.append(ratings);
  }

  #gradeCurrentCard(rating) {
    const learning = makeLearningState(this.#getProgress());
    const due = getDueCards(REVISION_CARDS, learning.reviewSchedules, Date.now());
    const current = due.find(card => card.id === this.#reviewCardId) ?? due[0];
    if (!current) return;
    learning.reviewSchedules = gradeReview(current.id, rating, learning.reviewSchedules);
    this.#persist();
    this.#reviewCardId = null;
    this.#notify(`Review scheduled: ${rating}.`, "success");
    this.render();
  }
}
