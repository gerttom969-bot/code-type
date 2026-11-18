import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("startup explains file:// module blocking instead of silently showing an inert page", () => {
  assert.match(html, /location\.protocol === "file:"/);
  assert.match(html, /CodeType needs to run from localhost/);
  assert.match(html, /Browsers block this app's JavaScript modules from file:\/\/ URLs/);
});

test("application module is loaded dynamically after the origin checks", () => {
  assert.match(html, /appModule\.type = "module"/);
  assert.match(html, /appModule\.src = "\.\/src\/main\.js"/);
  assert.doesNotMatch(html, /<script\s+type="module"\s+src="\.\/src\/main\.js"/);
});

test("startup provides a visible message if the JavaScript module fails to load", () => {
  assert.match(html, /appModule\.onerror/);
  assert.match(html, /CodeType JavaScript could not load/);
});
