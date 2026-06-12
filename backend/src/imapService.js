/**
 * IMAP service — for "email + password" auth (App Password, generic IMAP).
 * Wraps imapflow + mailparser for connect, validate, list, and fetch messages.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

// Provider IMAP defaults — autodetect based on email domain
const IMAP_PRESETS = {
  "gmail.com":      { host: "imap.gmail.com", port: 993, secure: true, requiresAppPassword: true, name: "Gmail" },
  "googlemail.com": { host: "imap.gmail.com", port: 993, secure: true, requiresAppPassword: true, name: "Gmail" },
  "yahoo.com":      { host: "imap.mail.yahoo.com", port: 993, secure: true, requiresAppPassword: true, name: "Yahoo" },
  "ymail.com":      { host: "imap.mail.yahoo.com", port: 993, secure: true, requiresAppPassword: true, name: "Yahoo" },
  "icloud.com":     { host: "imap.mail.me.com", port: 993, secure: true, requiresAppPassword: true, name: "iCloud" },
  "me.com":         { host: "imap.mail.me.com", port: 993, secure: true, requiresAppPassword: true, name: "iCloud" },
  "aol.com":        { host: "imap.aol.com", port: 993, secure: true, requiresAppPassword: true, name: "AOL" },
  "zoho.com":       { host: "imap.zoho.com", port: 993, secure: true, requiresAppPassword: false, name: "Zoho" },
  "protonmail.com": { host: "127.0.0.1", port: 1143, secure: false, requiresAppPassword: true, name: "ProtonMail (Bridge)" },
  // Outlook/Hotmail BLOCKED — basic auth disabled by Microsoft Sept 2024
  "outlook.com":    { blocked: true, reason: "Microsoft matiin basic auth IMAP Sept 2024. Pakai OAuth flow di tab atas (belum di-implement, coming soon)." },
  "hotmail.com":    { blocked: true, reason: "Microsoft matiin basic auth IMAP Sept 2024. Pakai OAuth flow." },
  "live.com":       { blocked: true, reason: "Microsoft matiin basic auth IMAP Sept 2024. Pakai OAuth flow." },
  "msn.com":        { blocked: true, reason: "Microsoft matiin basic auth IMAP Sept 2024. Pakai OAuth flow." },
};

export function getProviderInfo(email) {
  const domain = (email || "").toLowerCase().split("@")[1];
  return IMAP_PRESETS[domain] || null;
}

/**
 * Open an IMAP connection. Always close it via client.logout() when done.
 */
export async function connectImap({ host, port, secure, email, password }) {
  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user: email, pass: password },
    logger: false,
    tls: { rejectUnauthorized: true },
  });
  await client.connect();
  return client;
}

/**
 * Validate credentials by connecting + checking INBOX exists.
 * Returns { ok, error } — never throws.
 */
export async function validateImap({ host, port, secure, email, password }) {
  let client;
  try {
    client = await connectImap({ host, port, secure, email, password });
    await client.mailboxOpen("INBOX", { readOnly: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: humanizeImapError(e) };
  } finally {
    if (client) try { await client.logout(); } catch {}
  }
}

function humanizeImapError(e) {
  const msg = String(e?.message || e);
  if (/535|AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed/i.test(msg)) {
    return "Login ditolak. Cek email + password. Untuk Gmail/Yahoo/iCloud, password biasa GAK BISA — wajib App Password.";
  }
  if (/ENOTFOUND|getaddrinfo/i.test(msg)) return "Host IMAP gak ketemu. Cek server name.";
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(msg)) return "Gak bisa konek ke IMAP server. Cek port + firewall.";
  if (/Application-specific password required/i.test(msg)) {
    return "Akun pake 2FA. Wajib generate App Password di myaccount.google.com/apppasswords.";
  }
  return msg;
}

/**
 * List recent message UIDs from INBOX (newest first).
 */
export async function listImapMessages({ host, port, secure, email, password }, { maxResults = 200 } = {}) {
  const client = await connectImap({ host, port, secure, email, password });
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages || 0;
      if (!total) return [];
      const startSeq = Math.max(1, total - maxResults + 1);
      const range = `${startSeq}:${total}`;
      const out = [];
      for await (const msg of client.fetch(range, { uid: true, envelope: true, internalDate: true, flags: true })) {
        out.push({
          uid: msg.uid,
          envelope: msg.envelope,
          internalDate: msg.internalDate,
          flags: [...(msg.flags || [])],
        });
      }
      return out.sort((a, b) => (b.internalDate?.getTime?.() || 0) - (a.internalDate?.getTime?.() || 0));
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

/**
 * Fetch full message body for a single UID.
 */
export async function fetchImapMessage({ host, port, secure, email, password }, uid) {
  const client = await connectImap({ host, port, secure, email, password });
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(uid, { source: true, envelope: true, internalDate: true, flags: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source);
      return {
        uid: msg.uid,
        from: parsed.from?.text || msg.envelope?.from?.[0] ? formatAddress(msg.envelope?.from?.[0]) : "",
        to: parsed.to?.text || "",
        subject: parsed.subject || msg.envelope?.subject || "",
        date: parsed.date || msg.internalDate,
        text: parsed.text || "",
        html: parsed.html || "",
        snippet: (parsed.text || "").slice(0, 200).replace(/\s+/g, " ").trim(),
        unread: !msg.flags?.has?.("\\Seen"),
        threadId: msg.envelope?.messageId || null,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

function formatAddress(a) {
  if (!a) return "";
  if (a.name) return `"${a.name}" <${a.address}>`;
  return a.address || "";
}
