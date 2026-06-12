import db from "./db.js";

/**
 * Folders are simple categories users can drop accounts into.
 * One folder may hold many accounts; an account belongs to at most one
 * folder (relationship encoded as accounts.folder_id, NULL means
 * "ungrouped"). Deleting a folder cascades to NULL on its accounts —
 * we never actually delete cached messages.
 */

export function listFolders() {
  const folders = db.prepare(
    "SELECT id, name, sort_order FROM folders ORDER BY sort_order ASC, created_at ASC"
  ).all();

  // Embed each folder's account ids so the UI can render the tree
  // without an extra round-trip.
  const accountsStmt = db.prepare(
    "SELECT id, email, label, folder_id FROM accounts WHERE folder_id=? ORDER BY sort_order ASC, created_at ASC"
  );
  return folders.map((f) => ({ ...f, accounts: accountsStmt.all(f.id) }));
}

export function createFolder(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("name required");

  const maxSort = db.prepare("SELECT MAX(sort_order) AS m FROM folders").get().m ?? -1;
  const info = db.prepare(
    "INSERT INTO folders (name, sort_order) VALUES (?, ?)"
  ).run(trimmed, maxSort + 1);
  return db.prepare("SELECT id, name, sort_order FROM folders WHERE id=?").get(info.lastInsertRowid);
}

export function renameFolder(id, name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("name required");
  db.prepare("UPDATE folders SET name=? WHERE id=?").run(trimmed, parseInt(id, 10));
  return db.prepare("SELECT id, name, sort_order FROM folders WHERE id=?").get(id);
}

export function deleteFolder(id) {
  // Foreign key on accounts.folder_id has ON DELETE SET NULL, but our
  // legacy ALTER TABLE migration adds the column without enforcing FK
  // semantics. Be explicit: clear the column first, then delete.
  db.prepare("UPDATE accounts SET folder_id=NULL WHERE folder_id=?").run(parseInt(id, 10));
  db.prepare("DELETE FROM folders WHERE id=?").run(parseInt(id, 10));
}

/**
 * Move an account into a folder, or out of it if folderId is null.
 */
export function assignAccountToFolder(folderId, accountId) {
  const fid = folderId === null || folderId === undefined ? null : parseInt(folderId, 10);
  db.prepare("UPDATE accounts SET folder_id=? WHERE id=?").run(fid, parseInt(accountId, 10));
  return db.prepare("SELECT id, folder_id FROM accounts WHERE id=?").get(accountId);
}

export function getAccountIdsInFolder(folderId) {
  return db.prepare("SELECT id FROM accounts WHERE folder_id=?")
    .all(parseInt(folderId, 10))
    .map((r) => r.id);
}
