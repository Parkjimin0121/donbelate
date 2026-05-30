import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const KEY_LENGTH = 64;

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function normalizeLoginName(name) {
  return String(name).trim().toLowerCase();
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const actual = Buffer.from(hash, "hex");
  const expected = scryptSync(password, salt, KEY_LENGTH);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
