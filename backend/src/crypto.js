import crypto from "crypto";
import { config } from "./config.js";

// Derive a stable 32-byte key from the master encryption key
const KEY = crypto.createHash("sha256").update(config.encryptionKey).digest();
const ALGO = "aes-256-gcm";

/**
 * Encrypt a plaintext string (e.g. refresh_token) for at-rest storage.
 * Returns: base64(iv).base64(authTag).base64(ciphertext)
 */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

/**
 * Decrypt a string produced by encrypt().
 */
export function decrypt(payload) {
  if (!payload) return null;
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// PKCE helpers (9router pattern) — kept for providers that need it
export function generateCodeVerifier(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
export function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
export function generateState() {
  return crypto.randomBytes(32).toString("base64url");
}
export function generatePKCE(bytes = 32) {
  const codeVerifier = generateCodeVerifier(bytes);
  return { codeVerifier, codeChallenge: generateCodeChallenge(codeVerifier), state: generateState() };
}
