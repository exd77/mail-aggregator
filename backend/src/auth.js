import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config, TOKEN_EXPIRE } from "./config.js";
import db from "./db.js";

/**
 * Dashboard auth — cloud-mail pattern.
 * Single admin login -> JWT. Token sent in Authorization header (raw, no Bearer).
 *
 * Password resolution order:
 *   1. A scrypt hash stored in the `settings` table (set via the Settings
 *      page "Change password" form). This is authoritative once set.
 *   2. The ADMIN_PASSWORD env var (initial bootstrap password).
 *
 * Storing only a salted scrypt hash means the plaintext password is never
 * persisted to disk, and changing it doesn't require editing .env / restart.
 */

const PW_KEY = "admin_password_hash";

const getSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

/** scrypt hash, encoded as "salt:hash" (both hex). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time compare a plaintext against a stored "salt:hash". */
function verifyHash(password, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = crypto.scryptSync(password, salt, expected.length);
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

/** True if the supplied plaintext is the current admin password. */
function passwordMatches(password) {
  const row = getSetting.get(PW_KEY);
  if (row?.value) return verifyHash(password, row.value);
  // No override stored yet — fall back to the env bootstrap password.
  return password === config.adminPassword;
}

export function login(username, password) {
  if (username !== config.adminUser || !passwordMatches(password)) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }
  return jwt.sign({ sub: "admin", role: "admin" }, config.jwtSecret, { expiresIn: TOKEN_EXPIRE });
}

/**
 * Change the dashboard password. Verifies the current password first,
 * then stores a fresh scrypt hash. Throws (status 400/401) on failure.
 */
export function changePassword(currentPassword, newPassword) {
  if (!passwordMatches(currentPassword)) {
    const err = new Error("Current password is incorrect");
    err.status = 401;
    throw err;
  }
  if (!newPassword || String(newPassword).length < 6) {
    const err = new Error("New password must be at least 6 characters");
    err.status = 400;
    throw err;
  }
  if (newPassword === currentPassword) {
    const err = new Error("New password must be different from the current one");
    err.status = 400;
    throw err;
  }
  upsertSetting.run(PW_KEY, hashPassword(newPassword));
  return { changed: true };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

/**
 * Express middleware: protect routes. Excludes /api/auth/login.
 */
export function authMiddleware(req, res, next) {
  const open = ["/api/auth/login", "/api/health"];
  if (open.includes(req.path) || req.method === "OPTIONS") return next();
  if (!req.path.startsWith("/api/")) return next(); // static assets handled elsewhere

  const token = req.headers["authorization"];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ code: 401, message: "Auth expired or missing" });
  }
  req.user = payload;
  next();
}
