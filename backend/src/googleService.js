import { GOOGLE, GMAIL_API } from "./oauthConstants.js";

/**
 * Google OAuth Service — 9router pattern.
 * Authorization Code flow with client_secret (Thunderbird public client).
 */

export function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: GOOGLE.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GOOGLE.scopes.join(" "),
    state: state,
    access_type: "offline", // KEY: get refresh_token
    prompt: "consent",       // KEY: always return refresh_token
  });
  return `${GOOGLE.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri) {
  const res = await fetch(GOOGLE.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: GOOGLE.clientId,
      client_secret: GOOGLE.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return await res.json(); // { access_token, refresh_token, expires_in, scope, ... }
}

/**
 * Refresh access_token using refresh_token.
 * Google may NOT return a new refresh_token — caller keeps the old one.
 */
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: GOOGLE.clientId,
      client_secret: GOOGLE.clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${await res.text()}`);
  return await res.json(); // { access_token, expires_in, scope, ... }
}

export async function getUserInfo(accessToken) {
  const res = await fetch(GOOGLE.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to get user info: ${await res.text()}`);
  return await res.json(); // { email, name, picture, ... }
}

// ===== Gmail API =====

/**
 * List recent message IDs from a mailbox.
 * @param {string} accessToken
 * @param {object} opts { maxResults, q, labelIds }
 */
export async function listMessages(accessToken, { maxResults = 25, q = "", labelIds = ["INBOX"] } = {}) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (q) params.set("q", q);
  for (const l of labelIds) params.append("labelIds", l);
  const res = await fetch(`${GMAIL_API}/users/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail list failed: ${await res.text()}`);
  const data = await res.json();
  return data.messages || []; // [{ id, threadId }]
}

/**
 * Get full message detail and parse into a normalized shape.
 */
export async function getMessage(accessToken, msgId) {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${msgId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail get failed: ${await res.text()}`);
  const m = await res.json();
  return parseMessage(m);
}

function header(headers, name) {
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function decodeB64Url(data) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/**
 * Walk MIME parts to extract text/plain and text/html bodies.
 */
function extractBodies(payload) {
  let html = "";
  let text = "";
  function walk(part) {
    if (!part) return;
    const mime = part.mimeType || "";
    if (mime === "text/html" && part.body?.data) html += decodeB64Url(part.body.data);
    else if (mime === "text/plain" && part.body?.data) text += decodeB64Url(part.body.data);
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  }
  walk(payload);
  return { html, text };
}

export function parseMessage(m) {
  const headers = m.payload?.headers || [];
  const { html, text } = extractBodies(m.payload);
  const labels = m.labelIds || [];
  return {
    msg_id: m.id,
    thread_id: m.threadId,
    from_addr: header(headers, "From"),
    to_addr: header(headers, "To"),
    subject: header(headers, "Subject"),
    snippet: m.snippet || "",
    body_html: html,
    body_text: text,
    internal_date: parseInt(m.internalDate || "0", 10),
    is_unread: labels.includes("UNREAD") ? 1 : 0,
    is_starred: labels.includes("STARRED") ? 1 : 0,
    labels: JSON.stringify(labels),
  };
}
