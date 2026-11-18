import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { SECURITY, STORAGE_KEYS } from "../src/config.js";
import { validateUsername, validatePassword, validateCode, passwordStrength } from "../src/domain/validation.js";
import { sanitize, safeHtml } from "../src/security/safe-html.js";
import { derivePasswordHash, legacySha256Hash } from "../src/security/password-kdf.js";
import { AuthService } from "../src/services/auth-service.js";
import { createUserLabel } from "../src/ui/dom.js";

class MemoryStorage {
  #data = new Map();
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null; }
  setItem(key, value) { this.#data.set(key, String(value)); }
  removeItem(key) { this.#data.delete(key); }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.className = "";
    this._textContent = "";
  }
  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }
  get textContent() { return this._textContent; }
}

const fakeDocument = { createElement: tagName => new FakeElement(tagName) };
const quietSleep = async () => {};

function makeAuth(storage = new MemoryStorage(), nowRef = { value: 1_800_000_000_000 }) {
  return {
    storage,
    auth: new AuthService({
      storage,
      cryptoApi: webcrypto,
      now: () => nowRef.value,
      sleep: quietSleep
    }),
    nowRef
  };
}

test("HTML escaping handles all five significant characters", () => {
  assert.equal(sanitize(`&<>"'`), "&amp;&lt;&gt;\u001c&quot;&#39;");
  assert.equal(safeHtml`<span>${`<img src=x onerror=alert(1)>`}</span>`,
    "<span>&lt;img src=x onerror=alert(1)&gt;</span>");
});

test("signup rejects the exact markup username attack", async () => {
  const { auth } = makeAuth();
  await assert.rejects(
    auth.signup("<img src=x onerror=alert(1)>", "Strong-Password-2026!"),
    error => error.code === "INVALID_INPUT"
  );
});

test("hostile username is stored as text, not parsed as an HTML element", () => {
  const payload = '<img src=x onerror=alert(1)>';
  const label = createUserLabel(payload, fakeDocument);
  assert.equal(label.tagName, "span");
  assert.equal(label.textContent, payload);
  assert.equal(label.children.length, 0);
});

test("the app UI contains no innerHTML sinks", async () => {
  const appSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const domSource = await readFile(new URL("../src/ui/dom.js", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /\.innerHTML\s*=/);
  assert.doesNotMatch(domSource, /\.innerHTML\s*=/);
});

test("username, password, and UTF-8 code limits are enforced", () => {
  assert.equal(validateUsername("a1_").valid, true);
  assert.equal(validateUsername("ab").valid, false);
  assert.equal(validateUsername("<img src=x>").valid, false);
  assert.equal(validateUsername("a".repeat(25)).valid, false);
  assert.equal(validatePassword("12345678").valid, true);
  assert.equal(validatePassword("short").valid, false);
  assert.equal(validatePassword("x".repeat(257)).valid, false);
  assert.equal(validateCode("x".repeat(SECURITY.maxCodeBytes)).valid, true);
  assert.equal(validateCode("x".repeat(SECURITY.maxCodeBytes + 1)).valid, false);
  assert.equal(validateCode("😀".repeat(SECURITY.maxCodeBytes / 2)).valid, false);
  assert.ok(passwordStrength("xY8!long-password").score >= 4);
});

test("PBKDF2 uses the configured minimum work factor", async () => {
  const salt = "4c7a2d9e6b1f8053a4d8c2e7f9016b5a";
  const digest = await derivePasswordHash("example-password", salt, { cryptoApi: webcrypto });
  assert.match(digest, /^[0-9a-f]{64}$/);
  await assert.rejects(
    derivePasswordHash("example-password", salt, { iterations: 100_000, cryptoApi: webcrypto }),
    /at least 600000/
  );
});

test("new accounts store PBKDF2 hashes and login succeeds", async () => {
  const { auth, storage } = makeAuth();
  const user = await auth.signup("Alice_Dev", "Good-Password-123!");
  assert.equal(user.username, "alice_dev");
  const users = JSON.parse(storage.getItem(STORAGE_KEYS.users));
  assert.equal(users.alice_dev.kdf, SECURITY.passwordAlgorithm);
  assert.equal(users.alice_dev.iterations, SECURITY.passwordIterations);
  assert.equal(users.alice_dev.salt.length, SECURITY.passwordSaltBytes * 2);
  assert.match(users.alice_dev.hash, /^[0-9a-f]{64}$/);
  assert.notEqual(users.alice_dev.hash, "Good-Password-123!");

  const secondLogin = await auth.login("alice_dev", "Good-Password-123!");
  assert.equal(secondLogin.username, "alice_dev");
});

test("unknown username and wrong password use the same generic error", async () => {
  const { auth } = makeAuth();
  await auth.signup("reader_1", "Another-Password-8!");
  await assert.rejects(auth.login("missing_1", "Another-Password-8!"), error => {
    assert.equal(error.message, "Invalid credentials.");
    assert.equal(error.code, "INVALID_CREDENTIALS");
    return true;
  });
  await assert.rejects(auth.login("reader_1", "Wrong-Password-8!"), error => {
    assert.equal(error.message, "Invalid credentials.");
    assert.equal(error.code, "INVALID_CREDENTIALS");
    return true;
  });
  assert.ok(auth.getBackoffMs("reader_1") > 0);
});

test("legacy SHA-256 account upgrades to PBKDF2 after valid login", async () => {
  const storage = new MemoryStorage();
  const salt = "00112233445566778899aabbccddeeff";
  const password = "Legacy-Password-8!";
  const legacyHash = await legacySha256Hash(password, salt, webcrypto);
  storage.setItem(STORAGE_KEYS.users, JSON.stringify({
    legacy_user: { salt, hash: legacyHash, createdAt: "2024-01-01T00:00:00.000Z" }
  }));
  const { auth } = makeAuth(storage);
  const user = await auth.login("legacy_user", password);
  assert.equal(user.username, "legacy_user");
  const upgraded = JSON.parse(storage.getItem(STORAGE_KEYS.users)).legacy_user;
  assert.equal(upgraded.kdf, SECURITY.passwordAlgorithm);
  assert.equal(upgraded.iterations, SECURITY.passwordIterations);
  assert.notEqual(upgraded.hash, legacyHash);
});

test("previous PBKDF2 metadata and mixed-case local accounts remain compatible", async () => {
  const storage = new MemoryStorage();
  const password = "Previous-App-Password-9!";
  const salt = "11223344556677889900aabbccddeeff";
  const hash = await derivePasswordHash(password, salt, { cryptoApi: webcrypto });
  storage.setItem(STORAGE_KEYS.users, JSON.stringify({
    Alice_Dev: { salt, hash, algorithm: "PBKDF2-SHA256", iterations: 600_000, createdAt: "2025-01-01T00:00:00.000Z" }
  }));
  storage.setItem("codetype:user:Alice_Dev", JSON.stringify({
    username: "Alice_Dev", xp: 150, level: 2, solvedProblems: ["two-sum"], completedSnippets: [1], createdAt: "2025-01-01T00:00:00.000Z"
  }));

  const { auth } = makeAuth(storage);
  const user = await auth.login("Alice_Dev", password);
  assert.equal(user.username, "alice_dev");
  assert.ok(storage.getItem("codetype:user:alice_dev"));
  assert.equal(storage.getItem("codetype:user:Alice_Dev"), null);
  const account = JSON.parse(storage.getItem(STORAGE_KEYS.users)).alice_dev;
  assert.equal(account.kdf, SECURITY.passwordAlgorithm);
  assert.equal(account.username, "alice_dev");
});

test("session restore rotates the token without extending its original expiry", () => {
  const { auth, storage, nowRef } = makeAuth();
  const user = auth.continueAsGuest();
  const first = JSON.parse(storage.getItem(STORAGE_KEYS.session));
  nowRef.value += 60_000;
  const restored = auth.checkSession();
  const second = JSON.parse(storage.getItem(STORAGE_KEYS.session));
  assert.equal(restored.username, user.username);
  assert.notEqual(second.token, first.token);
  assert.equal(second.expiresAt, first.expiresAt);
  nowRef.value = first.expiresAt + 1;
  assert.equal(auth.checkSession(), null);
  assert.equal(storage.getItem(STORAGE_KEYS.session), null);
});
