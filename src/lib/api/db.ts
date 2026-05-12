import Database from "better-sqlite3";
import path from "path";

function resolveDbPath() {
  if (process.env.FREQUENCII_DB_PATH) {
    return process.env.FREQUENCII_DB_PATH;
  }

  // Vercel/Lambda/serverless: only /tmp is writable
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.cwd() === "/var/task" ||
    process.cwd().startsWith("/var/task")
  ) {
    return path.join("/tmp", "frequencii.db");
  }

  return path.join(process.cwd(), "data", "frequencii.db");
}

const DB_PATH = resolveDbPath();

let db: Database.Database | null = null;

/**
 * Get the SQLite database instance (singleton).
 */
export function getDb(): Database.Database {
  if (!db) {
    // Ensure the data directory exists
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Initialize tables
    initTables(db);
  }
  return db;
}

/**
 * Create tables if they don't exist.
 */
function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      pubkey TEXT PRIMARY KEY,
      display_name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pubkey TEXT NOT NULL,
      event_id TEXT NOT NULL,
      added_at TEXT DEFAULT (datetime('now')),
      UNIQUE(pubkey, event_id),
      FOREIGN KEY (pubkey) REFERENCES users(pubkey) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pubkey TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL CHECK(platform IN ('android', 'ios')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pubkey) REFERENCES users(pubkey) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_watchlist_pubkey ON watchlist(pubkey);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_pubkey ON push_tokens(pubkey);
  `);
}

// ============================================
// User queries
// ============================================

export interface UserRow {
  pubkey: string;
  display_name: string;
  avatar: string;
  created_at: string;
  updated_at: string;
}

export function getUser(pubkey: string): UserRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE pubkey = ?").get(pubkey) as UserRow | null;
}

export function upsertUser(pubkey: string): UserRow {
  const db = getDb();
  db.prepare(
    "INSERT INTO users (pubkey) VALUES (?) ON CONFLICT(pubkey) DO NOTHING"
  ).run(pubkey);
  return getUser(pubkey)!;
}

export function updateUser(
  pubkey: string,
  data: { displayName?: string; avatar?: string }
): UserRow | null {
  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];

  if (data.displayName !== undefined) {
    sets.push("display_name = ?");
    params.push(data.displayName);
  }
  if (data.avatar !== undefined) {
    sets.push("avatar = ?");
    params.push(data.avatar);
  }

  if (sets.length === 0) return getUser(pubkey);

  sets.push("updated_at = datetime('now')");
  params.push(pubkey);

  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE pubkey = ?`).run(...params);
  return getUser(pubkey);
}

// ============================================
// Watchlist queries
// ============================================

export interface WatchlistRow {
  id: number;
  pubkey: string;
  event_id: string;
  added_at: string;
}

export function getWatchlist(pubkey: string): WatchlistRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM watchlist WHERE pubkey = ? ORDER BY added_at DESC")
    .all(pubkey) as WatchlistRow[];
}

export function addToWatchlist(pubkey: string, eventId: string): boolean {
  const db = getDb();
  try {
    db.prepare(
      "INSERT INTO watchlist (pubkey, event_id) VALUES (?, ?)"
    ).run(pubkey, eventId);
    return true;
  } catch {
    // Already exists (UNIQUE constraint)
    return false;
  }
}

export function removeFromWatchlist(pubkey: string, eventId: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM watchlist WHERE pubkey = ? AND event_id = ?")
    .run(pubkey, eventId);
  return result.changes > 0;
}

// ============================================
// Push token queries
// ============================================

export interface PushTokenRow {
  id: number;
  pubkey: string;
  token: string;
  platform: string;
  created_at: string;
}

export function registerPushToken(
  pubkey: string,
  token: string,
  platform: "android" | "ios"
): boolean {
  const db = getDb();
  try {
    db.prepare(
      "INSERT INTO push_tokens (pubkey, token, platform) VALUES (?, ?, ?)"
    ).run(pubkey, token, platform);
    return true;
  } catch {
    // Token already registered
    return false;
  }
}

export function removePushToken(token: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM push_tokens WHERE token = ?").run(token);
  return result.changes > 0;
}

export function getPushTokens(pubkey: string): PushTokenRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM push_tokens WHERE pubkey = ?")
    .all(pubkey) as PushTokenRow[];
}
