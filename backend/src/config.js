import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function req(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const config = {
  port: parseInt(req("PORT", "8787"), 10),
  jwtSecret: req("JWT_SECRET"),
  adminUser: req("ADMIN_USER", "admin"),
  adminPassword: req("ADMIN_PASSWORD"),
  encryptionKey: req("ENCRYPTION_KEY"),
  oauthCallbackPort: parseInt(req("OAUTH_CALLBACK_PORT", "8788"), 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  google: {
    clientId: req("GOOGLE_CLIENT_ID"),
    clientSecret: req("GOOGLE_CLIENT_SECRET"),
  },
};

export const TOKEN_HEADER = "Authorization";
export const TOKEN_EXPIRE = 60 * 60 * 24 * 30; // 30 days, cloud-mail style
