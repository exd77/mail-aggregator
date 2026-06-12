import http from "http";
import { URL } from "url";
import { config } from "./config.js";
import { generateState } from "./crypto.js";
import { buildAuthUrl, exchangeCode, getUserInfo } from "./googleService.js";
import { upsertAccount, syncAccount } from "./accountManager.js";

/**
 * OAuth flow manager — 9router server-side exchange + polling pattern.
 *
 * Flow:
 *  1. frontend POST /api/oauth/google/start  -> we register a session (state), return { authUrl, state }
 *  2. user opens authUrl in browser, logs in, consents
 *  3. Google redirects to our loopback server (fixed port) /callback?code=&state=
 *  4. server auto-exchanges code -> tokens, fetches userinfo, saves account
 *  5. frontend polls GET /api/oauth/google/status?state=  until status=done
 *
 * Headless fallback: frontend can submit the pasted code/url to
 *  POST /api/oauth/google/submit { state, code }  -> same exchange path.
 */

const sessions = new Map(); // state -> { redirectUri, status, createdAt, accountId, email, error }
const SESSION_TTL = 10 * 60 * 1000;

let callbackServer = null;

function redirectUri() {
  // If PUBLIC_BASE_URL is set (remote/headless), Google must redirect there.
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/oauth/google/callback`;
  }
  return `http://localhost:${config.oauthCallbackPort}/callback`;
}

function cleanup() {
  const now = Date.now();
  for (const [state, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL) sessions.delete(state);
  }
}

/**
 * Core: given a code+state, exchange and persist. Used by both loopback and manual submit.
 */
async function completeExchange(code, state) {
  const session = sessions.get(state);
  if (!session) throw new Error("Unknown or expired OAuth state");
  try {
    const tokens = await exchangeCode(code, session.redirectUri);

    // Validate granted scope — Google's granular consent lets users
    // unckeck individual permissions, which silently breaks API calls.
    const grantedScopes = (tokens.scope || "").split(/\s+/);
    const requiredApiScope = "https://www.googleapis.com/auth/gmail.readonly";
    const requiredFullScope = "https://mail.google.com/";
    const hasGmail = grantedScopes.includes(requiredApiScope) || grantedScopes.includes(requiredFullScope);
    if (!hasGmail) {
      throw new Error(
        "Gmail permission tidak ke-grant. Saat consent, lo harus tick checkbox 'Read your email messages and settings'. Coba ulang Add Account."
      );
    }

    const userInfo = await getUserInfo(tokens.access_token);
    const accountId = upsertAccount({
      provider: "google",
      email: userInfo.email,
      displayName: userInfo.name,
      picture: userInfo.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      expiresIn: tokens.expires_in,
    });
    session.status = "done";
    session.accountId = accountId;
    session.email = userInfo.email;

    // Auto-sync the new account in the background so the user doesn't have
    // to click Sync manually. Errors are swallowed — the account is already
    // saved, and the user can retry from the UI.
    syncAccount(accountId, { maxResults: 50 }).catch((err) =>
      console.error(`[auto-sync] account ${accountId} failed:`, err.message)
    );

    return { accountId, email: userInfo.email };
  } catch (e) {
    session.status = "error";
    session.error = e.message;
    throw e;
  }
}

/**
 * Start the loopback callback server (idempotent).
 */
export function startCallbackServer() {
  if (callbackServer || config.publicBaseUrl) return; // skip loopback in remote mode
  callbackServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    try {
      if (error) throw new Error(error);
      if (!code || !state) throw new Error("Missing code/state");
      await completeExchange(code, state);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(resultPage(true, "Akun tersambung. Tutup tab ini dan kembali ke dashboard."));
    } catch (e) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(resultPage(false, e.message));
    }
  });
  callbackServer.listen(config.oauthCallbackPort, "127.0.0.1", () => {
    console.log(`[oauth] loopback callback server on http://localhost:${config.oauthCallbackPort}/callback`);
  });
  callbackServer.on("error", (e) => console.error("[oauth] callback server error:", e.message));
}

export function startGoogleFlow() {
  cleanup();
  const state = generateState();
  const ru = redirectUri();
  sessions.set(state, { redirectUri: ru, status: "pending", createdAt: Date.now() });
  const authUrl = buildAuthUrl(ru, state);
  return { authUrl, state, redirectUri: ru };
}

export function getStatus(state) {
  const s = sessions.get(state);
  if (!s) return { status: "unknown" };
  return { status: s.status, email: s.email, accountId: s.accountId, error: s.error };
}

/**
 * Manual submit for headless: user pastes the full redirect URL or just the code.
 */
export async function submitCode(state, codeOrUrl) {
  let code = codeOrUrl;
  if (codeOrUrl.startsWith("http")) {
    try {
      const u = new URL(codeOrUrl);
      code = u.searchParams.get("code") || codeOrUrl;
    } catch {
      /* keep as-is */
    }
  }
  return await completeExchange(code, state);
}

function resultPage(success, message) {
  const color = success ? "#22c55e" : "#ef4444";
  const icon = success ? "&#10003;" : "&#10007;";
  const title = success ? "Authorization Successful" : "Authorization Failed";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5}.c{text-align:center;padding:2rem;background:#fff;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,.08)}.i{color:${color};font-size:3rem}h1{margin:1rem 0;font-size:1.25rem}p{color:#666;max-width:360px}</style>
</head><body><div class="c"><div class="i">${icon}</div><h1>${title}</h1><p>${message}</p>
<script>setTimeout(()=>{try{window.close()}catch(e){}},2500)</script></div></body></html>`;
}
