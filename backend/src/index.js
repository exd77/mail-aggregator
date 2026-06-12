import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { login, changePassword, authMiddleware } from "./auth.js";
import { startGoogleFlow, getStatus, submitCode, startCallbackServer } from "./oauthFlow.js";
import {
  listAccounts, deleteAccount, syncAccount, syncAllAccounts,
  getUnifiedInbox, getMessageDetail, markRead, upsertImapAccount,
  getStarred, toggleStar, reorderAccounts, setAccountLabel,
  exportData, importData,
} from "./accountManager.js";
import { getProviderInfo, validateImap } from "./imapService.js";
import {
  listFolders, createFolder, renameFolder, deleteFolder, assignAccountToFolder,
} from "./folderManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const ok = (data) => ({ code: 200, data });
const fail = (message, code = 500) => ({ code, message });

// ===== PUBLIC ROUTES (no auth) =====

// ---- Static frontend (built Vue app) ----
const distDir = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(distDir));

// ---- Health ----
app.get("/api/health", (req, res) => res.json(ok({ status: "up", time: Date.now() })));

// ---- Auth (cloud-mail pattern) ----
app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    const token = login(username, password);
    res.json(ok({ token }));
  } catch (e) {
    res.status(e.status || 401).json(fail(e.message, 401));
  }
});

// ===== PROTECTED ROUTES (require JWT) =====
app.use("/api", authMiddleware);

// ---- Account (dashboard) settings ----
app.post("/api/auth/change-password", (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json(fail("currentPassword and newPassword required", 400));
    }
    const r = changePassword(currentPassword, newPassword);
    res.json(ok(r));
  } catch (e) {
    res.status(e.status || 500).json(fail(e.message, e.status || 500));
  }
});

// ---- Backup: export accounts + folders as a downloadable JSON file ----
app.get("/api/backup/export", (req, res) => {
  try {
    const data = exportData();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="mail-aggregator-backup-${stamp}.json"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});

// ---- Restore: import a previously-exported backup (merge, non-destructive) ----
app.post("/api/backup/import", (req, res) => {
  try {
    const backup = req.body;
    const summary = importData(backup);
    res.json(ok(summary));
  } catch (e) {
    res.status(e.status || 500).json(fail(e.message, e.status || 500));
  }
});

// ---- OAuth: connect Google account (9router server-side + polling) ----
app.post("/api/oauth/google/start", (req, res) => {
  const { authUrl, state, redirectUri } = startGoogleFlow();
  res.json(ok({ authUrl, state, redirectUri }));
});

app.get("/api/oauth/google/status", (req, res) => {
  res.json(ok(getStatus(req.query.state)));
});

app.post("/api/oauth/google/submit", async (req, res) => {
  try {
    const { state, code } = req.body || {};
    const result = await submitCode(state, code);
    res.json(ok(result));
  } catch (e) {
    res.status(400).json(fail(e.message, 400));
  }
});

// ---- IMAP: connect via email + password (App Password) ----
app.post("/api/imap/detect", (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json(fail("email required", 400));
  const info = getProviderInfo(email);
  if (!info) {
    return res.json(ok({
      autodetected: false,
      message: "Domain gak dikenal. Lo harus isi IMAP host + port manual.",
    }));
  }
  if (info.blocked) return res.json(ok({ autodetected: true, blocked: true, reason: info.reason, name: info.name }));
  res.json(ok({
    autodetected: true,
    name: info.name,
    host: info.host,
    port: info.port,
    secure: info.secure,
    requiresAppPassword: info.requiresAppPassword,
  }));
});

app.post("/api/imap/connect", async (req, res) => {
  try {
    const { email, password, host, port, secure } = req.body || {};
    if (!email || !password || !host || !port) {
      return res.status(400).json(fail("email, password, host, port required", 400));
    }
    const provider = (email.split("@")[1] || "imap").toLowerCase();
    const v = await validateImap({ host, port: Number(port), secure: !!secure, email, password });
    if (!v.ok) return res.status(400).json(fail(v.error, 400));
    const id = upsertImapAccount({
      provider, email, password, host,
      port: Number(port), secure: !!secure, displayName: email,
    });

    // Auto-sync newly added IMAP account in the background — user shouldn't
    // have to press Sync manually right after connecting.
    syncAccount(id, { maxResults: 50 }).catch((err) =>
      console.error(`[auto-sync] imap account ${id} failed:`, err.message)
    );

    res.json(ok({ id, email, provider }));
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});

// ---- Accounts ----
app.get("/api/accounts", (req, res) => res.json(ok(listAccounts())));
app.post("/api/accounts/reorder", (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids)) return res.status(400).json(fail("ids must be an array", 400));
    const updated = reorderAccounts(ids);
    res.json(ok(updated));
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});
app.delete("/api/accounts/:id", (req, res) => {
  deleteAccount(parseInt(req.params.id, 10));
  res.json(ok({ deleted: true }));
});

app.put("/api/accounts/:id/label", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { label } = req.body || {};
    const r = setAccountLabel(id, label);
    res.json(ok(r));
  } catch (e) {
    res.status(500).json(fail(e.message));
  }
});
app.post("/api/accounts/:id/sync", async (req, res) => {
  try {
    const r = await syncAccount(parseInt(req.params.id, 10), { maxResults: req.body?.maxResults || 200 });
    res.json(ok(r));
  } catch (e) { res.status(500).json(fail(e.message)); }
});
app.post("/api/sync", async (req, res) => {
  const r = await syncAllAccounts({ maxResults: req.body?.maxResults || 200 });
  res.json(ok(r));
});

// ---- Mail ----
app.get("/api/inbox", (req, res) => {
  const limit = parseInt(req.query.limit || "50", 10);
  const offset = parseInt(req.query.offset || "0", 10);
  const accountId = req.query.accountId ? parseInt(req.query.accountId, 10) : null;
  const folderId = req.query.folderId ? parseInt(req.query.folderId, 10) : null;
  res.json(ok(getUnifiedInbox({ limit, offset, accountId, folderId })));
});
app.get("/api/mail/:id", (req, res) => {
  const m = getMessageDetail(parseInt(req.params.id, 10));
  if (!m) return res.status(404).json(fail("Not found", 404));
  markRead(m.id);
  res.json(ok(m));
});

// ---- Starred ----
app.get("/api/starred", (req, res) => {
  const limit = parseInt(req.query.limit || "100", 10);
  const offset = parseInt(req.query.offset || "0", 10);
  const accountId = req.query.accountId ? parseInt(req.query.accountId, 10) : null;
  res.json(ok(getStarred({ limit, offset, accountId })));
});
app.post("/api/mail/:id/star", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const value = req.body && typeof req.body.value !== "undefined" ? req.body.value : null;
  const next = toggleStar(id, value);
  if (next === null) return res.status(404).json(fail("Not found", 404));
  res.json(ok({ id, is_starred: next }));
});

// ---- Folders ----
app.get("/api/folders", (req, res) => res.json(ok(listFolders())));

app.post("/api/folders", (req, res) => {
  try {
    const { name } = req.body || {};
    res.json(ok(createFolder(name)));
  } catch (e) { res.status(400).json(fail(e.message, 400)); }
});

app.put("/api/folders/:id", (req, res) => {
  try {
    const { name } = req.body || {};
    res.json(ok(renameFolder(parseInt(req.params.id, 10), name)));
  } catch (e) { res.status(400).json(fail(e.message, 400)); }
});

app.delete("/api/folders/:id", (req, res) => {
  deleteFolder(parseInt(req.params.id, 10));
  res.json(ok({ deleted: true }));
});

/**
 * Assign an account to a folder (drag-drop). Pass folderId=null in the
 * URL via :id="0" to mean "remove from folder".
 */
app.put("/api/folders/:id/accounts/:accountId", (req, res) => {
  try {
    const fid = parseInt(req.params.id, 10);
    const aid = parseInt(req.params.accountId, 10);
    const folderId = fid === 0 ? null : fid;
    res.json(ok(assignAccountToFolder(folderId, aid)));
  } catch (e) { res.status(400).json(fail(e.message, 400)); }
});

// ---- SPA fallback ---- catch-all AFTER API routes but served WITHOUT auth
// Vue router handles client-side auth (redirect to /login if no token)
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) res.status(404).send("Frontend not built yet. Run: cd frontend && npm run build");
  });
});

// ---- Boot ----
startCallbackServer();
app.listen(config.port, "0.0.0.0", () => {
  console.log(`[mail-aggregator] backend on http://0.0.0.0:${config.port}`);
});

// ---- Background auto-sync loop ----
// Keep the local cache fresh server-side so new mail shows up without the
// user pressing Sync. Parallel batches of 10 accounts at a time keep
// Gmail API rate limits safe even at 100+ accounts.
const AUTO_SYNC_INTERVAL_MS = parseInt(process.env.AUTO_SYNC_INTERVAL_MS || "30000", 10);
const AUTO_SYNC_CONCURRENCY = parseInt(process.env.AUTO_SYNC_CONCURRENCY || "10", 10);
let autoSyncRunning = false;
async function autoSyncTick() {
  if (autoSyncRunning) return; // prevent overlap if a sync runs long
  autoSyncRunning = true;
  try {
    const results = await syncAllAccounts({ maxResults: 25, concurrency: AUTO_SYNC_CONCURRENCY });
    const fetched = results.reduce((s, r) => s + (r?.fetched || 0), 0);
    if (fetched > 0) console.log(`[auto-sync] ${fetched} new message(s) across ${results.length} account(s)`);
  } catch (e) {
    console.error("[auto-sync] tick failed:", e.message);
  } finally {
    autoSyncRunning = false;
  }
}
setInterval(autoSyncTick, AUTO_SYNC_INTERVAL_MS);
// Kick one off shortly after boot.
setTimeout(autoSyncTick, 3000);
