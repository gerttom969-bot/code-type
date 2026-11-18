import { SECURITY, STORAGE_KEYS } from "../config.js";
import { validatePassword, validateUsername } from "../domain/validation.js";
import {
  constantTimeEqualHex,
  derivePasswordHash,
  legacySha256Hash,
  randomHex
} from "../security/password-kdf.js";
import { readJson, writeJson } from "../infrastructure/json-storage.js";

const DUMMY_SALT = "4c7a2d9e6b1f8053a4d8c2e7f9016b5a";
const MAX_STORED_ITERATIONS = 2_000_000;

export class AuthError extends Error {
  constructor(message, code = "AUTH_ERROR") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Browser-only demo authentication. This service is deliberately injectable so
 * the domain behavior can be tested without a browser or real localStorage.
 */
export class AuthService {
  #storage;
  #crypto;
  #now;
  #sleep;
  #failures = new Map();

  constructor({
    storage = globalThis.localStorage,
    cryptoApi = globalThis.crypto,
    now = () => Date.now(),
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
  } = {}) {
    if (!storage) throw new Error("Browser storage is required.");
    this.#storage = storage;
    this.#crypto = cryptoApi;
    this.#now = now;
    this.#sleep = sleep;
  }

  #users() {
    const users = readJson(this.#storage, STORAGE_KEYS.users, {});
    return users && typeof users === "object" && !Array.isArray(users)
      ? Object.assign(Object.create(null), users)
      : Object.create(null);
  }

  #findStoredUsername(users, normalizedUsername) {
    if (Object.hasOwn(users, normalizedUsername)) return normalizedUsername;
    return Object.keys(users).find(key =>
      /^[a-z0-9_]{3,24}$/i.test(key) && key.toLowerCase() === normalizedUsername
    ) ?? null;
  }

  #migrateUsernameKey(users, storedUsername, normalizedUsername, record) {
    if (storedUsername === normalizedUsername) {
      record.username = normalizedUsername;
      return;
    }
    if (Object.hasOwn(users, normalizedUsername)) {
      throw new AuthError("Invalid credentials.", "INVALID_CREDENTIALS");
    }

    const oldProgressKey = `${STORAGE_KEYS.progressPrefix}${encodeURIComponent(storedUsername)}`;
    const newProgressKey = `${STORAGE_KEYS.progressPrefix}${encodeURIComponent(normalizedUsername)}`;
    try {
      const oldProgress = this.#storage.getItem(oldProgressKey);
      if (oldProgress !== null && this.#storage.getItem(newProgressKey) === null) {
        this.#storage.setItem(newProgressKey, oldProgress);
        this.#storage.removeItem(oldProgressKey);
      }
    } catch {
      // Progress remains local; do not weaken account verification if storage migration fails.
    }

    delete users[storedUsername];
    record.username = normalizedUsername;
    users[normalizedUsername] = record;
  }

  #saveUsers(users) {
    writeJson(this.#storage, STORAGE_KEYS.users, users);
  }

  #createSession(username, guest = false) {
    const issuedAt = this.#now();
    writeJson(this.#storage, STORAGE_KEYS.session, {
      username,
      token: randomHex(SECURITY.sessionTokenBytes, this.#crypto),
      issuedAt,
      rotatedAt: issuedAt,
      expiresAt: issuedAt + SECURITY.sessionTtlMs,
      guest
    });
  }

  #recordFailure(username) {
    const failures = (this.#failures.get(username) ?? 0) + 1;
    this.#failures.set(username, Math.min(failures, 16));
  }

  async #waitForBackoff(username) {
    const failures = this.#failures.get(username) ?? 0;
    if (failures === 0) return;
    const delay = Math.min(30_000, 500 * (2 ** Math.min(failures, 6)));
    await this.#sleep(delay);
  }

  getBackoffMs(username) {
    const key = validateUsername(username).username;
    const failures = this.#failures.get(key) ?? 0;
    return failures === 0 ? 0 : Math.min(30_000, 500 * (2 ** Math.min(failures, 6)));
  }

  async signup(rawUsername, rawPassword) {
    const usernameResult = validateUsername(rawUsername);
    const passwordResult = validatePassword(rawPassword);
    if (!usernameResult.valid || !passwordResult.valid) {
      throw new AuthError("Check your username and password.", "INVALID_INPUT");
    }

    const username = usernameResult.username;
    const users = this.#users();
    if (this.#findStoredUsername(users, username) !== null) {
      // Keep account-existence wording generic rather than confirming a username.
      throw new AuthError("Unable to create account. Check the details and try again.", "SIGNUP_FAILED");
    }

    const salt = randomHex(SECURITY.passwordSaltBytes, this.#crypto);
    const hash = await derivePasswordHash(rawPassword, salt, { cryptoApi: this.#crypto });
    const timestamp = new Date(this.#now()).toISOString();
    const user = {
      id: randomHex(16, this.#crypto),
      username,
      salt,
      hash,
      kdf: SECURITY.passwordAlgorithm,
      iterations: SECURITY.passwordIterations,
      guest: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 1
    };
    users[username] = user;
    this.#saveUsers(users);
    this.#createSession(username, false);
    this.#failures.delete(username);
    return this.#publicUser(user);
  }

  async login(rawUsername, rawPassword) {
    const usernameResult = validateUsername(rawUsername);
    const username = usernameResult.username;
    const suppliedPassword = String(rawPassword ?? "");
    const passwordValid = validatePassword(suppliedPassword).valid;
    // Bound work even for callers that bypass the HTML maxlength attribute.
    const password = suppliedPassword.slice(0, SECURITY.maxPasswordLength);
    await this.#waitForBackoff(username);

    const users = this.#users();
    const storedUsername = usernameResult.valid ? this.#findStoredUsername(users, username) : null;
    const record = storedUsername === null ? null : users[storedUsername];
    const storedKdf = record?.kdf ?? record?.algorithm ?? null;
    let matches = false;

    try {
      if (record && !record.guest && typeof record.salt === "string" && typeof record.hash === "string") {
        if (storedKdf === SECURITY.passwordAlgorithm || storedKdf === "PBKDF2-SHA256") {
          const iterations = Number(record.iterations);
          if (!Number.isInteger(iterations)
              || iterations < SECURITY.passwordIterations
              || iterations > MAX_STORED_ITERATIONS) {
            throw new Error("Unsupported password record.");
          }
          const candidate = await derivePasswordHash(password, record.salt, {
            iterations,
            cryptoApi: this.#crypto
          });
          matches = constantTimeEqualHex(candidate, record.hash);
        } else {
          // SECURITY BOUNDARY: compatibility path for the prior SHA-256 demo.
          // Pay the PBKDF2 cost too, reducing the obvious timing gap during migration.
          await derivePasswordHash(password, DUMMY_SALT, { cryptoApi: this.#crypto });
          const candidate = await legacySha256Hash(password, record.salt, this.#crypto);
          matches = constantTimeEqualHex(candidate, record.hash);
        }
      } else {
        // SECURITY BOUNDARY: unknown usernames still perform a password KDF.
        await derivePasswordHash(password, DUMMY_SALT, { cryptoApi: this.#crypto });
      }
    } catch {
      matches = false;
    }

    if (!usernameResult.valid || !passwordValid || !record || record.guest || !matches) {
      this.#recordFailure(username);
      throw new AuthError("Invalid credentials.", "INVALID_CREDENTIALS");
    }

    // Migrate legacy SHA-256 accounts after a successful password verification.
    if (storedKdf !== SECURITY.passwordAlgorithm && storedKdf !== "PBKDF2-SHA256") {
      const salt = randomHex(SECURITY.passwordSaltBytes, this.#crypto);
      record.salt = salt;
      record.hash = await derivePasswordHash(password, salt, { cryptoApi: this.#crypto });
    }
    record.kdf = SECURITY.passwordAlgorithm;
    record.iterations = SECURITY.passwordIterations;
    record.updatedAt = new Date(this.#now()).toISOString();
    record.schemaVersion = 1;
    record.id ??= randomHex(16, this.#crypto);
    this.#migrateUsernameKey(users, storedUsername, username, record);
    this.#saveUsers(users);

    this.#createSession(username, false);
    this.#failures.delete(username);
    return this.#publicUser(record, username);
  }

  continueAsGuest() {
    const username = `guest_${randomHex(6, this.#crypto)}`;
    const timestamp = new Date(this.#now()).toISOString();
    const record = {
      id: randomHex(16, this.#crypto),
      username,
      guest: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 1
    };
    const users = this.#users();
    users[username] = record;
    this.#saveUsers(users);
    this.#createSession(username, true);
    return this.#publicUser(record);
  }

  checkSession() {
    const session = readJson(this.#storage, STORAGE_KEYS.session, null);
    if (!session || typeof session.username !== "string" || typeof session.token !== "string") {
      return null;
    }

    const usernameResult = validateUsername(session.username);
    const users = this.#users();
    const storedUsername = usernameResult.valid
      ? this.#findStoredUsername(users, usernameResult.username)
      : null;
    if (storedUsername === null) {
      this.logout();
      return null;
    }

    const issuedAt = Number(session.issuedAt ?? session.ts);
    const expiresAt = Number(session.expiresAt ?? (issuedAt + SECURITY.sessionTtlMs));
    const now = this.#now();
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || now >= expiresAt) {
      this.logout();
      return null;
    }

    const normalizedUsername = usernameResult.username;
    const record = users[storedUsername];
    this.#migrateUsernameKey(users, storedUsername, normalizedUsername, record);
    this.#saveUsers(users);

    // SECURITY BOUNDARY: rotate the browser-held token on every session check.
    // Rotation cannot protect localStorage from same-origin XSS or developer tools.
    writeJson(this.#storage, STORAGE_KEYS.session, {
      username: normalizedUsername,
      token: randomHex(SECURITY.sessionTokenBytes, this.#crypto),
      issuedAt,
      rotatedAt: now,
      expiresAt,
      guest: !!record.guest || !!session.guest
    });
    return this.#publicUser(record, normalizedUsername);
  }

  logout() {
    try {
      this.#storage.removeItem(STORAGE_KEYS.session);
    } catch {
      // Local logout also clears in-memory application state. Storage may be unavailable.
    }
  }

  #publicUser(record, fallbackUsername = "") {
    const username = record.username ?? fallbackUsername;
    return Object.freeze({
      id: String(record.id ?? username),
      username,
      guest: !!record.guest,
      createdAt: record.createdAt ?? new Date(this.#now()).toISOString()
    });
  }
}
