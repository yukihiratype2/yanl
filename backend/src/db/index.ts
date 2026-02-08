import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdirSync } from "fs";

const dataDir = join(import.meta.dir, "..", "..", "data");
mkdirSync(dataDir, { recursive: true });
const DB_PATH = join(dataDir, "nas-tools.db");

const db = new Database(DB_PATH, { create: true });

// Enable WAL mode for better performance
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

export default db;

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      resolutions TEXT,
      qualities TEXT,
      formats TEXT,
      encoders TEXT,
      min_size_mb REAL,
      max_size_mb REAL,
      preferred_keywords TEXT,
      excluded_keywords TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL CHECK(media_type IN ('anime', 'tv', 'movie')),
      title TEXT NOT NULL,
      title_original TEXT,
      overview TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      first_air_date TEXT,
      vote_average REAL,
      season_number INTEGER,
      total_episodes INTEGER,
      status TEXT DEFAULT 'active',
      folder_path TEXT,
      profile_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tmdb_id, media_type, season_number),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      air_date TEXT,
      overview TEXT,
      still_path TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'downloading', 'downloaded', 'moved')),
      torrent_hash TEXT,
      file_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS torrents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      episode_id INTEGER,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      hash TEXT,
      size TEXT,
      source TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'downloading', 'completed', 'moved', 'failed')),
      download_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
    );

  `);

  const columnsFor = (table: string): string[] =>
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row: any) => row.name);

  const ensureColumn = (table: string, column: string, ddl: string) => {
    const columns = columnsFor(table);
    if (!columns.includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  };

  ensureColumn("profiles", "is_default", "is_default INTEGER NOT NULL DEFAULT 0");
  ensureColumn("subscriptions", "profile_id", "profile_id INTEGER");

  console.log("Database initialized successfully");
}
