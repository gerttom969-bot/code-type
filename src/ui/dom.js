export function element(tagName, { className = "", text = null, attributes = {} } = {}, documentRef = document) {
  const node = documentRef.createElement(tagName);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  return node;
}

export function setText(node, value) {
  node.textContent = String(value ?? "");
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

// SECURITY TEST SEAM: user-controlled labels are always assigned as text nodes.
export function createUserLabel(username, documentRef = document) {
  const label = documentRef.createElement("span");
  label.className = "username-label";
  label.textContent = String(username ?? "");
  return label;
}

export function appendCodeBlock(parent, source, documentRef = document) {
  const pre = documentRef.createElement("pre");
  pre.className = "code-block";
  pre.textContent = String(source ?? "");
  parent.append(pre);
  return pre;
}
