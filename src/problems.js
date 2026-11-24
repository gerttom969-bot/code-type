import { difficultyMix } from "./learning/difficulty-mix.js";
import { mountDifficultyPie } from "./ui/difficulty-pie.js";
import { element } from "./ui/dom.js";

const grid = document.getElementById("topics");
const listBox = document.getElementById("topic-list");
const status = document.getElementById("status");

function showList(section, problems) {
  const ul = element("ul", { className: "plist" });
  for (const p of problems) {
    const li = element("li", { className: "prow" });
    li.append(element("span", { text: p.title }), element("span", { className: `chip ${p.difficulty}`, text: p.difficulty }));
    ul.append(li);
  }
  listBox.replaceChildren(element("h2", { text: section }), ul);
}

try {
  const response = await fetch("./content/problem-index.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { problems } = await response.json();
  const sections = [...new Set(problems.map((p) => p.section))];
  for (const section of sections) {
    const items = problems.filter((p) => p.section === section);
    const cell = element("div", { className: "topic" });
    mountDifficultyPie(cell, { label: section, mix: difficultyMix(items) });
    const open = element("button", { className: "topic-open", text: "Show problems" });
    open.addEventListener("click", () => showList(section, items));
    cell.append(open);
    grid.append(cell);
  }
  status.textContent = "";
} catch (error) {
  status.textContent = `Could not load the problem list (${error.message}). Open this page from a local server: npm run serve.`;
}
