import { createUserLabel } from "../src/ui/dom.js";
import { safeHtml } from "../src/security/safe-html.js";

const status = document.getElementById("status");
const fixture = document.getElementById("fixture");
const attacks = [
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "</span><script>alert(1)</script>"
];

try {
  for (const attack of attacks) {
    const label = createUserLabel(attack);
    fixture.append(label);
    if (label.textContent !== attack || label.querySelector("img, svg, script")) {
      throw new Error(`User content was not treated as text: ${attack}`);
    }
  }

  const template = document.createElement("div");
  template.innerHTML = safeHtml`<span>${attacks[0]}</span>`;
  if (template.querySelector("img") || template.textContent !== attacks[0]) {
    throw new Error("safeHtml interpolation was not escaped.");
  }

  status.textContent = "PASS — hostile labels and template interpolation remain text.";
  status.dataset.result = "pass";
} catch (error) {
  status.textContent = `FAIL — ${error.message}`;
  status.dataset.result = "fail";
  throw error;
}
