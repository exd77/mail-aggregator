import db from "./db.js";
import { encrypt, decrypt } from "./crypto.js";
import { refreshAccessToken, listMessages, getMessage } from "./googleService.js";
import { listImapMessages, fetchImapMessage } from "./imapService.js";

const REFRESH_SKEW = 120;

/* ================== ACCOUNT CRUD ================== */

/**
 * Save a brand-new OAuth account (or update tokens for an existing one) after OAuth.
 */
export function upsertAccount({ provider = "google", email, displayName, picture, accessToken, refreshToken, scope, expiresIn }) {
  const expiry = Math.floor(Date.now() / 1000) + (expiresIn || 0);
  const encRefresh = encrypt(refreshToken);

  const existing = db.prepare("SELECT id, refresh_token FROM accounts WHERE provider=? AND email=?").get(provider, email);
  if (existing) {
    const refreshToStore = refreshToken ? encRefresh : existing.refresh_token;
    db.prepare(`UPDATE accounts SET auth_type='oauth', display_name=?, picture=?, access_token=?, refresh_token=?, scope=?, expiry=?, status='active', last_error=NULL WHERE id=?`)
      .run(displayName, picture, accessToken, refreshToStore, scope, expiry, existing.id);
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO accounts (provider, auth_type, email, display_name, picture, access_token, refresh_token, scope, expiry) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(provider, "oauth", email, displayName, picture, accessToken, encRefresh, scope, expiry);
  return info.lastInsertRowid;
}

/**
 * Save an IMAP account (email + app password / generic IMAP).
 */
export function upsertImapAccount({ provider, email, password, host, port, secure, displayName }) {
  const encPassword = encrypt(password);
  const existing = db.prepare("SELECT id FROM accounts WHERE provider=? AND email=?").get(provider, email);
  if (existing) {
    db.prepare(`UPDATE accounts SET auth_type='imap', display_name=?, refresh_token=?, imap_host=?, imap_port=?, imap_secure=?, status='active', last_error=NULL WHERE id=?`)
      .run(displayName || email, encPassword, host, port, secure ? 1 : 0, existing.id);
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO accounts (provider, auth_type, email, display_name, refresh_token, imap_host, imap_port, imap_secure) VALUES (?,?,?,?,?,?,?,?)`)
    .run(provider, "imap", email, displayName || email, encPassword, host, port, secure ? 1 : 0);
  return info.lastInsertRowid;
}

export function listAccounts() {
  return db.prepare(`SELECT id, provider, auth_type, email, display_name, picture, label, folder_id, status, last_error, last_sync, expiry, sort_order,
    (SELECT COUNT(*) FROM messages WHERE account_id=accounts.id AND is_unread=1) AS unread_count
    FROM accounts ORDER BY sort_order ASC, created_at ASC`).all();
}

/**
 * Update a user-set label (alias) for an account. Pass empty/null to clear.
 */
export function setAccountLabel(id, label) {
  const trimmed = label && String(label).trim();
  db.prepare("UPDATE accounts SET label=? WHERE id=?").run(trimmed || null, parseInt(id, 10));
  return db.prepare("SELECT id, label FROM accounts WHERE id=?").get(id);
}

/**
 * Reorder accounts by writing the new index of each id into sort_order.
 * Wrapped in a transaction so partial updates can't leave a half-shuffled list.
 * Unknown ids are ignored.
 */
export function reorderAccounts(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new Error("orderedIds must be an array");
  const update = db.prepare("UPDATE accounts SET sort_order=? WHERE id=?");
  const tx = db.transaction((ids) => {
    ids.forEach((id, idx) => update.run(idx, id));
  });
  tx(orderedIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)));
  return listAccounts();
}

export function getAccount(id) {
  return db.prepare("SELECT * FROM accounts WHERE id=?").get(id);
}

export function deleteAccount(id) {
  db.prepare("DELETE FROM accounts WHERE id=?").run(id);
}

/* ================== BACKUP / RESTORE ================== */

/**
 * Export all accounts + folders as a portable backup object.
 *
 * Account rows are exported RAW — including the already-encrypted
 * refresh_token / IMAP password blob. This means a backup is only
 * restorable on a server that shares the same ENCRYPTION_KEY (otherwise
 * the tokens can't be decrypted). We deliberately do NOT export cached
 * messages: they're large and re-fetchable via sync. The backup captures
 * the valuable, hard-to-recreate state — which accounts are connected,
 * their tokens, labels, ordering, and folder organization.
 */
export function exportData() {
  const accounts = db.prepare(`SELECT provider, auth_type, email, display_name, picture,
      access_token, refresh_token, scope, expiry, imap_host, imap_port, imap_secure,
      status, label, folder_id, sort_order, created_at
    FROM accounts ORDER BY sort_order ASC, created_at ASC`).all();
  const folders = db.prepare(`SELECT id, name, sort_order, created_at FROM folders ORDER BY sort_order ASC`).all();
  return {
    type: "mail-aggregator-backup",
    version: 1,
    exportedAt: Date.now(),
    counts: { accounts: accounts.length, folders: folders.length },
    folders,
    accounts,
  };
}

/**
 * Restore accounts + folders from a backup produced by exportData().
 *
 * Strategy:
 *  - Folders are matched by name (re-created if missing) so we can remap
 *    each account's folder_id to the LOCAL folder id, avoiding collisions
 *    with existing folder rows.
 *  - Accounts are upserted by (provider, email): existing accounts get
 *    their tokens/settings refreshed, new ones are inserted. Nothing is
 *    deleted — import is additive/merge, never destructive.
 *
 * Returns a summary of what changed.
 */
export function importData(backup) {
  if (!backup || backup.type !== "mail-aggregator-backup" || !Array.isArray(backup.accounts)) {
    const err = new Error("Invalid backup file");
    err.status = 400;
    throw err;
  }

  const tx = db.transaction(() => {
    // 1. Folders — map old folder id -> local folder id (match by name).
    const folderIdMap = new Map();
    const findFolder = db.prepare("SELECT id FROM folders WHERE name=?");
    const insFolder = db.prepare("INSERT INTO folders (name, sort_order) VALUES (?, ?)");
    for (const f of backup.folders || []) {
      let local = findFolder.get(f.name);
      let localId;
      if (local) {
        localId = local.id;
      } else {
        localId = insFolder.run(f.name, f.sort_order || 0).lastInsertRowid;
      }
      folderIdMap.set(f.id, localId);
    }

    // 2. Accounts — upsert by (provider, email).
    const findAcc = db.prepare("SELECT id FROM accounts WHERE provider=? AND email=?");
    const updAcc = db.prepare(`UPDATE accounts SET auth_type=?, display_name=?, picture=?,
        access_token=?, refresh_token=?, scope=?, expiry=?, imap_host=?, imap_port=?, imap_secure=?,
        status=?, label=?, folder_id=?, sort_order=? WHERE id=?`);
    const insAcc = db.prepare(`INSERT INTO accounts (provider, email, auth_type, display_name, picture,
        access_token, refresh_token, scope, expiry, imap_host, imap_port, imap_secure,
        status, label, folder_id, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    let added = 0, updated = 0;
    for (const a of backup.accounts) {
      if (!a.email || !a.provider) continue;
      const localFolderId = a.folder_id != null ? (folderIdMap.get(a.folder_id) ?? null) : null;
      const existing = findAcc.get(a.provider, a.email);
      const vals = [
        a.auth_type || "oauth", a.display_name || a.email, a.picture || null,
        a.access_token || null, a.refresh_token || null, a.scope || null, a.expiry || 0,
        a.imap_host || null, a.imap_port || null, a.imap_secure != null ? a.imap_secure : 1,
        a.status || "active", a.label || null, localFolderId, a.sort_order || 0,
      ];
      if (existing) {
        updAcc.run(...vals, existing.id);
        updated++;
      } else {
        // INSERT lists provider, email as the first two columns; vals
        // supplies the remaining 14 in matching order.
        insAcc.run(a.provider, a.email, ...vals);
        added++;
      }
    }
    return { added, updated, folders: folderIdMap.size };
  });

  return tx();
}

function getImapCreds(acc) {
  return {
    host: acc.imap_host,
    port: acc.imap_port,
    secure: !!acc.imap_secure,
    email: acc.email,
    password: decrypt(acc.refresh_token),
  };
}

/* ================== OAUTH TOKEN LIFECYCLE ================== */

export async function ensureFreshToken(accountId) {
  const acc = getAccount(accountId);
  if (!acc) throw new Error("Account not found");
  if (acc.auth_type !== "oauth") throw new Error("Account is IMAP, not OAuth");

  const now = Math.floor(Date.now() / 1000);
  if (acc.access_token && acc.expiry > now + REFRESH_SKEW) return acc.access_token;

  const refreshToken = decrypt(acc.refresh_token);
  try {
    const r = await refreshAccessToken(refreshToken);
    const expiry = now + (r.expires_in || 0);
    db.prepare("UPDATE accounts SET access_token=?, expiry=?, status='active', last_error=NULL WHERE id=?")
      .run(r.access_token, expiry, accountId);
    return r.access_token;
  } catch (e) {
    db.prepare("UPDATE accounts SET status='error', last_error=? WHERE id=?").run(String(e.message), accountId);
    throw e;
  }
}

/* ================== SYNC ================== */

export async function syncAccount(accountId, { maxResults = 200 } = {}) {
  const acc = getAccount(accountId);
  if (!acc) throw new Error("Account not found");

  if (acc.auth_type === "oauth") return syncOAuthAccount(accountId, maxResults);
  if (acc.auth_type === "imap") return syncImapAccount(accountId, maxResults);
  throw new Error(`Unknown auth_type: ${acc.auth_type}`);
}

async function syncOAuthAccount(accountId, maxResults) {
  const token = await ensureFreshToken(accountId);
  const ids = await listMessages(token, { maxResults });
  const insert = db.prepare(`INSERT OR IGNORE INTO messages
    (account_id, msg_id, thread_id, from_addr, to_addr, subject, snippet, body_html, body_text, internal_date, is_unread, is_starred, labels)
    VALUES (@account_id, @msg_id, @thread_id, @from_addr, @to_addr, @subject, @snippet, @body_html, @body_text, @internal_date, @is_unread, @is_starred, @labels)`);

  let fetched = 0;
  for (const { id } of ids) {
    const exists = db.prepare("SELECT id FROM messages WHERE account_id=? AND msg_id=?").get(accountId, id);
    if (exists) continue;
    const parsed = await getMessage(token, id);
    insert.run({ account_id: accountId, ...parsed });
    fetched++;
  }
  db.prepare("UPDATE accounts SET last_sync=? WHERE id=?").run(Math.floor(Date.now() / 1000), accountId);
  return { fetched, total: ids.length };
}

async function syncImapAccount(accountId, maxResults) {
  const acc = getAccount(accountId);
  const creds = getImapCreds(acc);
  let messages;
  try {
    messages = await listImapMessages(creds, { maxResults });
  } catch (e) {
    db.prepare("UPDATE accounts SET status='error', last_error=? WHERE id=?").run(String(e.message), accountId);
    throw e;
  }

  const insert = db.prepare(`INSERT OR IGNORE INTO messages
    (account_id, msg_id, thread_id, from_addr, to_addr, subject, snippet, body_html, body_text, internal_date, is_unread, is_starred, labels)
    VALUES (@account_id, @msg_id, @thread_id, @from_addr, @to_addr, @subject, @snippet, @body_html, @body_text, @internal_date, @is_unread, @is_starred, @labels)`);

  let fetched = 0;
  for (const m of messages) {
    const msgId = String(m.uid);
    const exists = db.prepare("SELECT id FROM messages WHERE account_id=? AND msg_id=?").get(accountId, msgId);
    if (exists) continue;

    let body;
    try {
      body = await fetchImapMessage(creds, m.uid);
    } catch {
      continue; // skip unreadable
    }
    if (!body) continue;

    const flags = m.flags || [];
    const starred = flags.some((f) => String(f).toLowerCase().includes("flagged")) ? 1 : 0;
    insert.run({
      account_id: accountId,
      msg_id: msgId,
      thread_id: body.threadId,
      from_addr: body.from || "",
      to_addr: body.to || "",
      subject: body.subject || "",
      snippet: body.snippet || "",
      body_html: body.html || "",
      body_text: body.text || "",
      internal_date: body.date ? new Date(body.date).getTime() : Date.now(),
      is_unread: body.unread ? 1 : 0,
      is_starred: starred,
      labels: JSON.stringify(flags),
    });
    fetched++;
  }
  db.prepare("UPDATE accounts SET last_sync=?, status='active', last_error=NULL WHERE id=?").run(Math.floor(Date.now() / 1000), accountId);
  return { fetched, total: messages.length };
}

export async function syncAllAccounts({ maxResults = 200, concurrency = 10 } = {}) {
  const accounts = db.prepare("SELECT id FROM accounts WHERE status='active'").all();
  const results = [];
  // Process in batches of `concurrency` to avoid rate limits (100 akun
  // × burst sekaligus = bad; 10 paralel × 10 batch = safe & fast).
  for (let i = 0; i < accounts.length; i += concurrency) {
    const batch = accounts.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (a) => {
        try {
          const r = await syncAccount(a.id, { maxResults });
          return { accountId: a.id, ...r };
        } catch (e) {
          return { accountId: a.id, error: e.message };
        }
      })
    );
    for (const r of batchResults) results.push(r.value ?? r.reason);
  }
  return results;
}

/* ================== READ ================== */

export function getUnifiedInbox({ limit = 50, offset = 0, accountId = null, folderId = null } = {}) {
  let where = "";
  const params = { limit, offset };
  if (accountId) {
    where = "WHERE m.account_id=@accountId";
    params.accountId = accountId;
  } else if (folderId) {
    // Resolve folder → list of account ids and inline as IN (...)
    const ids = db.prepare("SELECT id FROM accounts WHERE folder_id=?")
      .all(parseInt(folderId, 10))
      .map((r) => r.id);
    if (!ids.length) return []; // empty folder = empty inbox
    where = `WHERE m.account_id IN (${ids.join(",")})`;
  }
  const rows = db.prepare(`SELECT m.id, m.account_id, m.msg_id, m.from_addr, m.subject, m.snippet, m.internal_date, m.is_unread, m.is_starred,
      a.email AS account_email, a.display_name AS account_name
    FROM messages m JOIN accounts a ON a.id=m.account_id
    ${where}
    ORDER BY m.internal_date DESC LIMIT @limit OFFSET @offset`).all(params);
  return rows;
}

/**
 * Starred messages across all accounts (or filtered by account), newest first.
 */
export function getStarred({ limit = 100, offset = 0, accountId = null } = {}) {
  const extra = accountId ? "AND m.account_id=@accountId" : "";
  const rows = db.prepare(`SELECT m.id, m.account_id, m.msg_id, m.from_addr, m.subject, m.snippet, m.internal_date, m.is_unread, m.is_starred,
      a.email AS account_email, a.display_name AS account_name
    FROM messages m JOIN accounts a ON a.id=m.account_id
    WHERE m.is_starred=1 ${extra}
    ORDER BY m.internal_date DESC LIMIT @limit OFFSET @offset`).all({ limit, offset, accountId });
  return rows;
}

export function getMessageDetail(id) {
  return db.prepare(`SELECT m.*, a.email AS account_email, a.display_name AS account_name
    FROM messages m JOIN accounts a ON a.id=m.account_id WHERE m.id=?`).get(id);
}

export function markRead(id) {
  db.prepare("UPDATE messages SET is_unread=0 WHERE id=?").run(id);
}

/**
 * Toggle (or set) the local starred flag for a cached message.
 * Note: this updates the local cache only; it does not push the change
 * back to Gmail/IMAP (the app is read-only against the providers).
 */
export function toggleStar(id, value = null) {
  const row = db.prepare("SELECT is_starred FROM messages WHERE id=?").get(id);
  if (!row) return null;
  const next = value === null ? (row.is_starred ? 0 : 1) : (value ? 1 : 0);
  db.prepare("UPDATE messages SET is_starred=? WHERE id=?").run(next, id);
  return next;
}
