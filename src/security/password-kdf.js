import { SECURITY } from "../config.js";

export const PASSWORD_ALGORITHM = SECURITY.passwordAlgorithm;

export function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new TypeError("Invalid hexadecimal input.");
  }
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
}

export function randomHex(byteLength, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.getRandomValues) throw new Error("A cryptographically secure random source is required.");
  const bytes = new Uint8Array(byteLength);
  cryptoApi.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function derivePasswordHash(password, saltHex, {
  iterations = SECURITY.passwordIterations,
  cryptoApi = globalThis.crypto
} = {}) {
  if (!cryptoApi?.subtle) throw new Error("Web Crypto is unavailable. Use HTTPS or localhost.");
  if (!Number.isInteger(iterations) || iterations < SECURITY.passwordIterations) {
    throw new RangeError(`PBKDF2 iterations must be at least ${SECURITY.passwordIterations}.`);
  }
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await cryptoApi.subtle.deriveBits({
    name: "PBKDF2",
    salt: hexToBytes(saltHex),
    iterations,
    hash: "SHA-256"
  }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

export async function legacySha256Hash(password, saltHex, cryptoApi = globalThis.crypto) {
  const input = new TextEncoder().encode(`${saltHex}:${password}`);
  const digest = await cryptoApi.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest));
}

export function constantTimeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const maxLength = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let i = 0; i < maxLength; i += 1) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return difference === 0;
}
