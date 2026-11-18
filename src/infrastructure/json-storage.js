import { STORAGE_KEYS } from "../config.js";
import { createInitialProgress, normalizeProgress } from "../domain/progress.js";

export class StorageError extends Error {
  constructor(message = "Browser storage is unavailable or full.") {
    super(message);
    this.name = "StorageError";
  }
}

export function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    throw new StorageError();
  }
}

export function createProgressRepository(storage = globalThis.localStorage, now = () => new Date()) {
  function keyFor(username) {
    return `${STORAGE_KEYS.progressPrefix}${encodeURIComponent(username)}`;
  }

  return Object.freeze({
    load(username) {
      const raw = readJson(storage, keyFor(username), null);
      return normalizeProgress(raw ?? createInitialProgress(username, now()), username, now());
    },
    save(progress) {
      if (!progress || typeof progress.username !== "string") {
        throw new TypeError("A progress record with a username is required.");
      }
      writeJson(storage, keyFor(progress.username), progress);
    },
    export(progress) {
      return JSON.stringify({
        app: "CodeType",
        schemaVersion: 1,
        exportedAt: now().toISOString(),
        progress
      }, null, 2);
    }
  });
}

export function readUserDirectory(storage = globalThis.localStorage) {
  const users = readJson(storage, STORAGE_KEYS.users, {});
  return users && typeof users === "object" && !Array.isArray(users)
    ? Object.assign(Object.create(null), users)
    : Object.create(null);
}
