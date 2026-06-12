import { config } from "./config.js";

// Google OAuth endpoints (9router/Antigravity pattern)
export const GOOGLE = {
  clientId: config.google.clientId,
  clientSecret: config.google.clientSecret,
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  // Full mail scope — Thunderbird client is authorized for this.
  // Use gmail.readonly if you only need read; full scope supports read + modify (mark read).
  scopes: [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};

export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

// OAuth flow timeout (5 min, like 9router)
export const OAUTH_TIMEOUT = 300000;
