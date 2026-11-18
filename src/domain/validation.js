import { SECURITY } from "../config.js";

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  const valid = username.length >= SECURITY.minUsernameLength
    && username.length <= SECURITY.maxUsernameLength
    && /^[a-z0-9_]+$/.test(username);
  return {
    valid,
    username,
    message: valid ? "" : "Use 3–24 letters, numbers, or underscores."
  };
}

export function validatePassword(value) {
  const password = String(value ?? "");
  if (password.length < SECURITY.minPasswordLength) {
    return { valid: false, message: "Use at least 8 characters." };
  }
  if (password.length > SECURITY.maxPasswordLength) {
    return { valid: false, message: "Password must be 256 characters or fewer." };
  }
  return { valid: true, message: "" };
}

export function passwordStrength(value) {
  const password = String(value ?? "");
  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const score = checks.filter(Boolean).length;
  const label = password.length < 8 ? "Too short"
    : score <= 2 ? "Weak"
    : score === 3 ? "Fair"
    : score === 4 ? "Good" : "Strong";
  return { score, label, checks };
}

export function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value ?? "")).byteLength;
}

export function validateCode(value) {
  const bytes = utf8ByteLength(value);
  return {
    valid: bytes <= SECURITY.maxCodeBytes,
    bytes,
    maxBytes: SECURITY.maxCodeBytes,
    message: bytes <= SECURITY.maxCodeBytes
      ? ""
      : `Code is ${bytes.toLocaleString()} bytes. The limit is ${SECURITY.maxCodeBytes.toLocaleString()} bytes.`
  };
}
