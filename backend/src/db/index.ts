import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdirSync } from "fs";
import { logger } from "../services/logger";
import { normalizeDateOnly } from "../lib/date";

const dataDir = join(import.meta.dir, "..", "..", "data");
mkdirSync(dataDir, { recursive: true });
const DB_PATH = join(dataDir, "nas-tools.db");
const DB_PATH_OVERRIDE = process.env.NAS_TOOLS_DB_PATH;

const db = new Database(DB_PATH_OVERRIDE || DB_PATH, { create: true });

// Enable WAL mode for better performance
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

export default db;

type DateBackfillTarget = {
  table: "subscriptions" | "episodes";
  column: "first_air_date" | "air_date";
};

type InvalidDateSample = {
  table: DateBackfillTarget["table"];
  column: DateBackfillTarget["column"];
  rowId: number;
  value: string;
};

type DateBackfillStats = {
  scanned: number;
  normalized: number;
  unchanged: number;
  invalid: number;
};

function backfillDateColumn(
  target: DateBackfillTarget,
  invalidSamples: InvalidDateSample[]
): DateBackfillStats {
  const rows = db
    .prepare(
      `SELECT id, ${target.column} AS value
       FROM ${target.table}
       WHERE ${target.column} IS NOT NULL AND TRIM(${target.column}) <> ''`
    )
    .all() as Array<{ id: number; value: unknown }>;

  const update = db.prepare(
    `UPDATE ${target.table}
     SET ${target.column} = ?, updated_at = datetime('now')
     WHERE id = ?`
  );

  const stats: DateBackfillStats = {
    scanned: 0,
    normalized: 0,
    unchanged: 0,
    invalid: 0,
  };

  for (const row of rows) {
    const rawValue = String(row.value);
    const trimmed = rawValue.trim();
    stats.scanned += 1;

    const normalized = normalizeDateOnly(trimmed);
    if (!normalized) {
      stats.invalid += 1;
      if (invalidSamples.length < 10) {
        invalidSamples.push({
          table: target.table,
          column: target.column,
          rowId: row.id,
          value: rawValue,
        });
      }
      continue;
    }

    if (normalized === rawValue) {
      stats.unchanged += 1;
      continue;
    }

    update.run(normalized, row.id);
    stats.normalized += 1;
  }

  return stats;
}

function backfillMediaDateColumns() {
  const targets: DateBackfillTarget[] = [
    { table: "subscriptions", column: "first_air_date" },
    { table: "episodes", column: "air_date" },
  ];
  const summary: DateBackfillStats = {
    scanned: 0,
    normalized: 0,
    unchanged: 0,
    invalid: 0,
  };
  const invalidSamples: InvalidDateSample[] = [];

  for (const target of targets) {
    const stats = backfillDateColumn(target, invalidSamples);
    summary.scanned += stats.scanned;
    summary.normalized += stats.normalized;
    summary.unchanged += stats.unchanged;
    summary.invalid += stats.invalid;
    logger.info(
      {
        table: target.table,
        column: target.column,
        ...stats,
      },
      "Date normalization backfill completed for column"
    );
  }

  logger.info(summary, "Date normalization backfill summary");

  if (summary.invalid > 0) {
    logger.error(
      {
        invalid: summary.invalid,
        sample: invalidSamples,
      },
      "Invalid date values remain after startup normalization backfill"
    );
    throw new Error("Database contains invalid date values");
  }
}

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
      source TEXT NOT NULL DEFAULT 'tvdb',
      source_id INTEGER NOT NULL,
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
      UNIQUE(source, source_id, media_type, season_number),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      season_number INTEGER,
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
  ensureColumn("episodes", "season_number", "season_number INTEGER");

  const subColumns = columnsFor("subscriptions");
  const hasLegacyTmdbId = subColumns.includes("tmdb_id");
  const hasSourceId = subColumns.includes("source_id");
  if (hasLegacyTmdbId && !hasSourceId) {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(`
      CREATE TABLE subscriptions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL DEFAULT 'tvdb',
        source_id INTEGER NOT NULL,
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
        UNIQUE(source, source_id, media_type, season_number),
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
      );
    `);
    db.exec(`
      INSERT INTO subscriptions_new (
        id,
        source,
        source_id,
        media_type,
        title,
        title_original,
        overview,
        poster_path,
        backdrop_path,
        first_air_date,
        vote_average,
        season_number,
        total_episodes,
        status,
        folder_path,
        profile_id,
        created_at,
        updated_at
      )
      SELECT
        id,
        'tvdb',
        tmdb_id,
        media_type,
        title,
        title_original,
        overview,
        poster_path,
        backdrop_path,
        first_air_date,
        vote_average,
        season_number,
        total_episodes,
        status,
        folder_path,
        profile_id,
        created_at,
        updated_at
      FROM subscriptions;
    `);
    db.exec("DROP TABLE subscriptions");
    db.exec("ALTER TABLE subscriptions_new RENAME TO subscriptions");
    db.exec("PRAGMA foreign_keys = ON");
  } else {
    ensureColumn("subscriptions", "source", "source TEXT NOT NULL DEFAULT 'tvdb'");
    ensureColumn("subscriptions", "source_id", "source_id INTEGER");
  }

  if (process.env.NAS_TOOLS_SKIP_DATE_BACKFILL !== "1") {
    backfillMediaDateColumns();
  }
  logger.info("Database initialized successfully");
}
