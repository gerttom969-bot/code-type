// SECURITY BOUNDARY: interpolated values are text, never trusted HTML.
export function sanitize(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Use only for templates with developer-authored markup and escaped interpolations.
// Never pass user-created HTML as a template string.
export function safeHtml(strings, ...values) {
  return strings.reduce((result, part, index) =>
    result + part + (index < values.length ? sanitize(values[index]) : ""), "");
}

export function safeHttpsUrl(value, baseUrl = "https://localhost/") {
  try {
    const url = new URL(String(value), baseUrl);
    return url.protocol === "https:" ? url.href : "#";
  } catch {
    return "#";
  }
}
