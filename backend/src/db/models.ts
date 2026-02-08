import db from "./index";

export interface Subscription {
  id: number;
  source: "tvdb" | "bgm";
  source_id: number;
  media_type: "anime" | "tv" | "movie";
  title: string;
  title_original: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number | null;
  season_number: number | null;
  total_episodes: number | null;
  status: string;
  folder_path: string | null;
  profile_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Episode {
  id: number;
  subscription_id: number;
  season_number: number | null;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  overview: string | null;
  still_path: string | null;
  status: string;
  torrent_hash: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Torrent {
  id: number;
  subscription_id: number;
  episode_id: number | null;
  title: string;
  link: string;
  hash: string | null;
  size: string | null;
  source: string | null;
  status: string;
  download_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: number;
  name: string;
  description: string | null;
  resolutions: string | null; // JSON array e.g. ["2160p","1080p","720p"]
  qualities: string | null; // JSON array e.g. ["bluray","webdl","webrip"]
  formats: string | null; // JSON array e.g. ["mkv","mp4"]
  encoders: string | null; // JSON array e.g. ["x265","x264","av1"]
  min_size_mb: number | null;
  max_size_mb: number | null;
  preferred_keywords: string | null; // JSON array
  excluded_keywords: string | null; // JSON array
  is_default: number;
  created_at: string;
  updated_at: string;
}

// ---- Subscriptions ----

export function getAllSubscriptions(): Subscription[] {
  return db
    .prepare("SELECT * FROM subscriptions ORDER BY created_at DESC")
    .all() as Subscription[];
}

export function getActiveSubscriptions(): Subscription[] {
  return db
    .prepare(
      "SELECT * FROM subscriptions WHERE status = 'active' ORDER BY created_at DESC"
    )
    .all() as Subscription[];
}

export function getSubscriptionById(id: number): Subscription | undefined {
  return db
    .prepare("SELECT * FROM subscriptions WHERE id = ?")
    .get(id) as Subscription | undefined;
}

export function getSubscriptionBySourceId(
  source: string,
  sourceId: number,
  mediaType: string,
  seasonNumber?: number | null
): Subscription | undefined {
  if (seasonNumber != null) {
    return db
      .prepare(
        "SELECT * FROM subscriptions WHERE source = ? AND source_id = ? AND media_type = ? AND season_number = ?"
      )
      .get(source, sourceId, mediaType, seasonNumber) as Subscription | undefined;
  }
  return db
    .prepare(
      "SELECT * FROM subscriptions WHERE source = ? AND source_id = ? AND media_type = ?"
    )
    .get(source, sourceId, mediaType) as Subscription | undefined;
}

export function createSubscription(
  sub: Omit<Subscription, "id" | "created_at" | "updated_at">
): Subscription {
  const result = db
    .prepare(
      `INSERT INTO subscriptions (source, source_id, media_type, title, title_original, overview, poster_path, backdrop_path, first_air_date, vote_average, season_number, total_episodes, status, folder_path, profile_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sub.source,
      sub.source_id,
      sub.media_type,
      sub.title,
      sub.title_original,
      sub.overview,
      sub.poster_path,
      sub.backdrop_path,
      sub.first_air_date,
      sub.vote_average,
      sub.season_number,
      sub.total_episodes,
      sub.status,
      sub.folder_path,
      sub.profile_id
    );
  return getSubscriptionById(Number(result.lastInsertRowid))!;
}

export function updateSubscription(
  id: number,
  data: Partial<Subscription>
): void {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "created_at") continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE subscriptions SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

export function deleteSubscription(id: number): void {
  db.prepare("DELETE FROM subscriptions WHERE id = ?").run(id);
}

// ---- Episodes ----

export function getEpisodesBySubscription(
  subscriptionId: number
): Episode[] {
  return db
    .prepare(
      "SELECT * FROM episodes WHERE subscription_id = ? ORDER BY episode_number ASC"
    )
    .all(subscriptionId) as Episode[];
}

export function createEpisode(
  ep: Omit<Episode, "id" | "created_at" | "updated_at">
): Episode {
  const result = db
    .prepare(
      `INSERT INTO episodes (subscription_id, season_number, episode_number, title, air_date, overview, still_path, status, torrent_hash, file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ep.subscription_id,
      ep.season_number,
      ep.episode_number,
      ep.title,
      ep.air_date,
      ep.overview,
      ep.still_path,
      ep.status,
      ep.torrent_hash,
      ep.file_path
    );
  return db
    .prepare("SELECT * FROM episodes WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as Episode;
}

export function updateEpisode(id: number, data: Partial<Episode>): void {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "created_at") continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE episodes SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

// ---- Torrents ----

export function getTorrentsBySubscription(subscriptionId: number): Torrent[] {
  return db
    .prepare(
      "SELECT * FROM torrents WHERE subscription_id = ? ORDER BY created_at DESC"
    )
    .all(subscriptionId) as Torrent[];
}

export function getTorrentByHash(hash: string): Torrent | undefined {
  return db
    .prepare("SELECT * FROM torrents WHERE hash = ? LIMIT 1")
    .get(hash) as Torrent | undefined;
}

export function getTorrentByLink(link: string): Torrent | undefined {
  return db
    .prepare("SELECT * FROM torrents WHERE link = ? LIMIT 1")
    .get(link) as Torrent | undefined;
}

export function getTorrentByEpisodeId(episodeId: number): Torrent | undefined {
  return db
    .prepare(
      "SELECT * FROM torrents WHERE episode_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(episodeId) as Torrent | undefined;
}

export function createTorrent(
  t: Omit<Torrent, "id" | "created_at" | "updated_at">
): Torrent {
  const result = db
    .prepare(
      `INSERT INTO torrents (subscription_id, episode_id, title, link, hash, size, source, status, download_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      t.subscription_id,
      t.episode_id,
      t.title,
      t.link,
      t.hash,
      t.size,
      t.source,
      t.status,
      t.download_path
    );
  return db
    .prepare("SELECT * FROM torrents WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as Torrent;
}

export function updateTorrent(id: number, data: Partial<Torrent>): void {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "created_at") continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE torrents SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

export function getEpisodesWithAirDateRange(
  startDate: string,
  endDate: string
): (Episode & { subscription_title: string; media_type: string; poster_path: string | null })[] {
  return db
    .prepare(
      `SELECT e.*, s.title as subscription_title, s.media_type, s.poster_path
       FROM episodes e
       JOIN subscriptions s ON e.subscription_id = s.id
       WHERE e.air_date >= ? AND e.air_date <= ?
       ORDER BY e.air_date ASC`
    )
    .all(startDate, endDate) as (Episode & {
    subscription_title: string;
    media_type: string;
    poster_path: string | null;
  })[];
}

// ---- Profiles ----

export function getAllProfiles(): Profile[] {
  return db
    .prepare("SELECT * FROM profiles ORDER BY is_default DESC, name ASC")
    .all() as Profile[];
}

export function getProfileById(id: number): Profile | undefined {
  return db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as Profile | undefined;
}

export function getDefaultProfile(): Profile | undefined {
  return db
    .prepare("SELECT * FROM profiles WHERE is_default = 1 LIMIT 1")
    .get() as Profile | undefined;
}

export function setDefaultProfile(id: number): void {
  db.prepare(
    "UPDATE profiles SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END, updated_at = datetime('now')"
  ).run(id);
}

export function createProfile(
  profile: Omit<Profile, "id" | "created_at" | "updated_at">
): Profile {
  const result = db
    .prepare(
      `INSERT INTO profiles (name, description, resolutions, qualities, formats, encoders, min_size_mb, max_size_mb, preferred_keywords, excluded_keywords, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      profile.name,
      profile.description,
      profile.resolutions,
      profile.qualities,
      profile.formats,
      profile.encoders,
      profile.min_size_mb,
      profile.max_size_mb,
      profile.preferred_keywords,
      profile.excluded_keywords,
      profile.is_default ?? 0
    );
  return getProfileById(Number(result.lastInsertRowid))!;
}

export function updateProfile(id: number, data: Partial<Profile>): void {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "created_at") continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE profiles SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

export function deleteProfile(id: number): void {
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
}
