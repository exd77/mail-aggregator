import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "mail.db");

// Ensure data dir exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  provider      TEXT NOT NULL DEFAULT 'google',
  auth_type     TEXT NOT NULL DEFAULT 'oauth',  -- 'oauth' | 'imap'
  email         TEXT NOT NULL,
  display_name  TEXT,
  picture       TEXT,
  access_token  TEXT,
  refresh_token TEXT,                 -- ENCRYPTED. For OAuth: refresh_token. For IMAP: password.
  scope         TEXT,
  expiry        INTEGER NOT NULL DEFAULT 0,
  imap_host     TEXT,
  imap_port     INTEGER,
  imap_secure   INTEGER DEFAULT 1,    -- 1=TLS, 0=plain
  status        TEXT NOT NULL DEFAULT 'active',
  last_error    TEXT,
  last_sync     INTEGER DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(provider, email)
);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL,
  msg_id        TEXT NOT NULL,        -- provider message id
  thread_id     TEXT,
  from_addr     TEXT,
  to_addr       TEXT,
  subject       TEXT,
  snippet       TEXT,
  body_html     TEXT,
  body_text     TEXT,
  internal_date INTEGER DEFAULT 0,    -- unix ms from provider
  is_unread     INTEGER DEFAULT 1,
  is_starred    INTEGER DEFAULT 0,
  labels        TEXT,
  fetched_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, msg_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_account_date ON messages(account_id, internal_date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(account_id, is_unread);

CREATE TABLE IF NOT EXISTS folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
`);

// Migration: add new columns to existing DB
function addColumnIfMissing(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}
addColumnIfMissing("accounts", "auth_type", "TEXT NOT NULL DEFAULT 'oauth'");
addColumnIfMissing("accounts", "imap_host", "TEXT");
addColumnIfMissing("accounts", "imap_port", "INTEGER");
addColumnIfMissing("accounts", "imap_secure", "INTEGER DEFAULT 1");
addColumnIfMissing("accounts", "sort_order", "INTEGER DEFAULT 0");
addColumnIfMissing("accounts", "label", "TEXT");
addColumnIfMissing("accounts", "folder_id", "INTEGER REFERENCES folders(id) ON DELETE SET NULL");
addColumnIfMissing("messages", "is_starred", "INTEGER DEFAULT 0");

export default db;
