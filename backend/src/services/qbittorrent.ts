import { normalize } from "path";
import { getSetting } from "../db/settings";
import { logger } from "./logger";

let sid: string | null = null;
let sidBaseUrl: string | null = null;
let loginPromise: Promise<string> | null = null;

export interface QbitPathMapEntry {
  from: string;
  to: string;
}

function normalizePathForMatch(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripTrailingSlashes(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  if (trimmed.length === 0) return "/";
  if (/^[A-Za-z]:$/.test(trimmed)) return `${trimmed}/`;
  return trimmed;
}

export function getQbitPathMap(): QbitPathMapEntry[] {
  const raw = (getSetting("qbit_path_map") || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        from: typeof entry?.from === "string" ? entry.from : "",
        to: typeof entry?.to === "string" ? entry.to : "",
      }))
      .filter((entry) => entry.from && entry.to);
  } catch {
    return [];
  }
}

export function mapQbitPathToLocal(path: string): string {
  if (!path) return path;

  const mapEntries = getQbitPathMap();
  if (mapEntries.length === 0) return path;

  const normalizedPath = normalizePathForMatch(path);
  const sorted = [...mapEntries].sort((a, b) => {
    const aLen = stripTrailingSlashes(normalizePathForMatch(a.from)).length;
    const bLen = stripTrailingSlashes(normalizePathForMatch(b.from)).length;
    return bLen - aLen;
  });

  for (const entry of sorted) {
    const from = stripTrailingSlashes(normalizePathForMatch(entry.from));
    const to = stripTrailingSlashes(normalizePathForMatch(entry.to));
    if (!from || !to) continue;

    if (normalizedPath === from || normalizedPath.startsWith(`${from}/`)) {
      const suffix = normalizedPath.slice(from.length);
      const mapped = `${to}${suffix}`;
      return normalize(mapped);
    }
  }

  return path;
}

function getBaseUrl(): string {
  const url = getSetting("qbit_url");
  if (!url) throw new Error("qBittorrent URL not configured");
  return url.replace(/\/$/, "");
}

function appendOptionalBoolean(
  params: URLSearchParams,
  key: string,
  value: boolean | undefined
) {
  if (value !== undefined) {
    params.append(key, String(value));
  }
}

function appendOptionalNumber(
  params: URLSearchParams,
  key: string,
  value: number | undefined
) {
  if (typeof value === "number") {
    params.append(key, String(value));
  }
}

function encodeHashes(hashes: string | string[]): string {
  const hashList = Array.isArray(hashes) ? hashes.join("|") : hashes;
  const params = new URLSearchParams();
  params.append("hashes", hashList);
  return params.toString();
}

async function login(baseUrl: string): Promise<string> {
  const username = getSetting("qbit_username") || "admin";
  const password = getSetting("qbit_password") || "";

  logger.info(
    { path: "/api/v2/auth/login", method: "POST" },
    "qBittorrent API request"
  );
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Referer is required by some qBittorrent versions/configurations (CSRF protection)
        "Referer": baseUrl,
      },
      body: params.toString(),
    });
  } catch (err) {
    logger.error(
      { path: "/api/v2/auth/login", method: "POST", err },
      "qBittorrent request failed"
    );
    throw err;
  }

  logger.info(
    { path: "/api/v2/auth/login", method: "POST", status: response.status },
    "qBittorrent API response"
  );

  if (!response.ok) {
    logger.error(
      { path: "/api/v2/auth/login", method: "POST", status: response.status },
      "qBittorrent login failed"
    );
    // qBittorrent returns 403 for banned IP
    throw new Error(
      `qBittorrent login failed: ${response.status} ${response.statusText}`
    );
  }

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    // Handle multiple cookies or single string
    // "SID=...; path=/; HttpOnly, other=..."
    const match = setCookie.match(/SID=([^;]+)/);
    if (match) {
      sid = match[1];
      sidBaseUrl = baseUrl;
      return sid;
    }
  }

  const text = await response.text();
  if (text === "Ok.") {
    // Some versions don't return SID cookie in body but in header, 
    // if we missed it header check or it wasn't there but auth succeeded (unlikely for WebUI)
    // stick with empty string or throw? 
    // Usually invalid creds return 200 OK but with text "Fails." in older versions?
    // Docs say: 200 OK.
    
    // If we didn't get a cookie, we probably can't make authenticated requests. 
    // But let's check if the 'Ok.' meant we are authenticated (e.g. localhost bypass).
    // If bypass_local_auth is on, we might not need SID.
    if (!sid) sid = "";
    sidBaseUrl = baseUrl;
    return sid;
  }

  throw new Error("qBittorrent login failed: no SID returned");
}

async function ensureLoggedIn(baseUrl: string): Promise<string> {
  if (sid !== null && sidBaseUrl === baseUrl) {
    return sid;
  }

  if (!loginPromise) {
    loginPromise = login(baseUrl).finally(() => {
      loginPromise = null;
    });
  }

  return loginPromise;
}

async function qbitFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = getBaseUrl();
  if (sidBaseUrl && sidBaseUrl !== baseUrl) {
    sid = null;
    sidBaseUrl = null;
  }
  await ensureLoggedIn(baseUrl);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const method = (options.method || "GET").toString().toUpperCase();
  headers.Referer = baseUrl;

  if (sid) {
    headers["Cookie"] = `SID=${sid}`;
  }

  logger.info({ path, method }, "qBittorrent API request");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    logger.error({ path, method, err }, "qBittorrent request failed");
    throw err;
  }

  // If 403, try re-login. 
  // Note: 403 can also mean "Forbidden" for other reasons, but commonly it's session expiry.
  if (response.status === 403) {
    logger.warn(
      { path, method },
      "qBittorrent returned 403, refreshing session"
    );
    sid = null;
    sidBaseUrl = null;
    await ensureLoggedIn(baseUrl);
    if (sid) {
      headers["Cookie"] = `SID=${sid}`;
    } else {
      delete headers["Cookie"];
    }
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch (err) {
      logger.error({ path, method, err }, "qBittorrent retry failed");
      throw err;
    }
  }

  logger.info({ path, method, status: response.status }, "qBittorrent API response");
  if (!response.ok) {
    logger.error({ path, method, status: response.status }, "qBittorrent API error");
  }
  return response;
}

export interface AddTorrentOptions {
  savepath?: string;
  category?: string;
  tags?: string;
  skip_checking?: boolean;
  paused?: boolean;
  root_folder?: boolean;
  rename?: string;
  upLimit?: number;
  dlLimit?: number;
  ratioLimit?: number;
  seedingTimeLimit?: number;
  autoTMM?: boolean;
  sequentialDownload?: boolean;
  firstLastPiecePrio?: boolean;
}

export function getQbitDownloadDir(
  mediaType: "anime" | "tv" | "movie"
): string | undefined {
  const dir = (getSetting(`qbit_download_dir_${mediaType}`) || "").trim();
  return dir ? dir : undefined;
}

/**
 * Add a torrent by URL
 * @param torrentUrl URL to the torrent file or magnet link
 * @param optionsOrSavePath Options object or save path (string) for backward compatibility
 * @param category Category (if optionsOrSavePath is string)
 */
export async function addTorrentByUrl(
  torrentUrl: string,
  optionsOrSavePath?: string | AddTorrentOptions,
  category?: string
): Promise<boolean> {
  const formData = new URLSearchParams();
  formData.append("urls", torrentUrl);

  let options: AddTorrentOptions = {};

  if (typeof optionsOrSavePath === "string") {
    options.savepath = optionsOrSavePath;
    if (category) options.category = category;
  } else if (typeof optionsOrSavePath === "object") {
    options = optionsOrSavePath;
  }

  const defaultTag = (getSetting("qbit_tag") || "").trim();
  if (defaultTag) {
    if (options.tags) {
      const existing = options.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (!existing.includes(defaultTag)) {
        existing.push(defaultTag);
      }
      options.tags = existing.join(",");
    } else {
      options.tags = defaultTag;
    }
  }

  if (options.savepath) formData.append("savepath", options.savepath);
  if (options.category) formData.append("category", options.category);
  if (options.tags) formData.append("tags", options.tags);
  appendOptionalBoolean(formData, "skip_checking", options.skip_checking);
  appendOptionalBoolean(formData, "paused", options.paused);
  appendOptionalBoolean(formData, "root_folder", options.root_folder);
  if (options.rename) formData.append("rename", options.rename);
  appendOptionalNumber(formData, "upLimit", options.upLimit);
  appendOptionalNumber(formData, "dlLimit", options.dlLimit);
  appendOptionalNumber(formData, "ratioLimit", options.ratioLimit);
  appendOptionalNumber(formData, "seedingTimeLimit", options.seedingTimeLimit);
  appendOptionalBoolean(formData, "autoTMM", options.autoTMM);
  appendOptionalBoolean(formData, "sequentialDownload", options.sequentialDownload);
  appendOptionalBoolean(formData, "firstLastPiecePrio", options.firstLastPiecePrio);

  const response = await qbitFetch("/api/v2/torrents/add", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  return response.ok;
}

export interface QBitTorrentInfo {
  /** Unix timestamp when torrent was added. */
  added_on: number;
  /** Bytes left to download. */
  amount_left: number;
  /** Whether automatic torrent management is enabled. */
  auto_tmm: boolean;
  /** Estimated availability in swarm (>= 1 means full copy likely available). */
  availability: number;
  /** qB category string. */
  category: string;
  /** Bytes completed on disk. */
  completed: number;
  /** Unix timestamp when download completed (0 if incomplete). */
  completion_on: number;
  /** Full path to content root/file in qB download area. */
  content_path: string;
  /** Download speed limit in bytes/sec (-1 usually means unlimited). */
  dl_limit: number;
  /** Current download speed in bytes/sec. */
  dlspeed: number;
  /** Total downloaded bytes. */
  downloaded: number;
  /** Downloaded bytes for current session. */
  downloaded_session: number;
  /** ETA in seconds. */
  eta: number;
  /** Whether first/last piece priority is enabled. */
  f_l_piece_prio: boolean;
  /** Whether force start is enabled (ignores queue). */
  force_start: boolean;
  /** Torrent hash. */
  hash: string;
  /** True when torrent is marked private by tracker metadata. */
  isPrivate: boolean;
  /** Unix timestamp for last activity. */
  last_activity: number;
  /** Magnet URI for this torrent (if available). */
  magnet_uri: string;
  /** Per-torrent max ratio setting. */
  max_ratio: number;
  /** Per-torrent max seeding time in seconds. */
  max_seeding_time: number;
  /** Torrent display name. */
  name: string;
  /** Complete peers in swarm. */
  num_complete: number;
  /** Incomplete peers in swarm. */
  num_incomplete: number;
  /** Leechers connected to this torrent. */
  num_leechs: number;
  /** Seeders connected to this torrent. */
  num_seeds: number;
  /** Queue priority/order. */
  priority: number;
  /** Progress in [0, 1]. */
  progress: number;
  /** Share ratio (uploaded/downloaded). */
  ratio: number;
  /** Ratio limit setting for torrent. */
  ratio_limit: number;
  /** Seconds until next tracker announce. */
  reannounce: number;
  /** Configured save path in qB. */
  save_path: string;
  /** Time spent seeding in seconds. */
  seeding_time: number;
  /** Seeding time limit for torrent in seconds. */
  seeding_time_limit: number;
  /** Last time torrent reached 100% (Unix timestamp). */
  seen_complete: number;
  /** Whether sequential download is enabled. */
  seq_dl: boolean;
  /** Selected size in bytes (can differ from total for partial selection). */
  size: number;
  /** qB state machine value. */
  state: QBitTorrentState;
  /** Whether super seeding mode is enabled. */
  super_seeding: boolean;
  /** Comma-separated tag list. */
  tags: string;
  /** Active time in seconds since add/start. */
  time_active: number;
  /** Total size in bytes. */
  total_size: number;
  /** Main tracker URL. */
  tracker: string;
  /** Upload speed limit in bytes/sec (-1 usually means unlimited). */
  up_limit: number;
  /** Total uploaded bytes. */
  uploaded: number;
  /** Uploaded bytes in current session. */
  uploaded_session: number;
  /** Current upload speed in bytes/sec. */
  upspeed: number;
}

export type QBitTorrentState =
  /** Generic error state. */
  | "error"
  /** Data missing from disk. */
  | "missingFiles"
  /** Seeding/uploading. */
  | "uploading"
  /** Upload paused. */
  | "pausedUP"
  /** Queued for uploading. */
  | "queuedUP"
  /** Stalled while uploading (no peers). */
  | "stalledUP"
  /** Rechecking data while in upload phase. */
  | "checkingUP"
  /** Force-started upload state. */
  | "forcedUP"
  /** Allocating disk space. */
  | "allocating"
  /** Downloading payload. */
  | "downloading"
  /** Downloading metadata (magnet prefetch). */
  | "metaDL"
  /** Download paused. */
  | "pausedDL"
  /** Queued for download. */
  | "queuedDL"
  /** Stalled while downloading. */
  | "stalledDL"
  /** Rechecking data while in download phase. */
  | "checkingDL"
  /** Force-started download state. */
  | "forcedDL"
  /** Checking resume data on startup. */
  | "checkingResumeData"
  /** Moving files. */
  | "moving"
  /** Unknown/unsupported state from server. */
  | "unknown";

export type QBitTorrentListFilter =
  /** No filter. */
  | "all"
  /** Only downloading states. */
  | "downloading"
  /** Only seeding states. */
  | "seeding"
  /** Completed torrents. */
  | "completed"
  /** Stopped/paused torrents. */
  | "stopped"
  /** Currently active (non-idle) torrents. */
  | "active"
  /** Inactive/idle torrents. */
  | "inactive"
  /** Running torrents (not stopped). */
  | "running"
  /** Stalled torrents (both directions). */
  | "stalled"
  /** Specifically stalled while uploading. */
  | "stalled_uploading"
  /** Specifically stalled while downloading. */
  | "stalled_downloading"
  /** Errored torrents. */
  | "errored";

export interface GetTorrentsOptions {
  filter?: QBitTorrentListFilter;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
  hashes?: string;
}

export interface QBitTorrentFile {
  /** File index in torrent. */
  index: number;
  /** Relative file path/name in torrent. */
  name: string;
  /** File size in bytes. */
  size: number;
  /** File progress in [0, 1]. */
  progress: number;
  /** File priority: 0=do not download, 1=normal, 6=high, 7=maximal. */
  priority: 0 | 1 | 6 | 7;
  /** Whether file is marked as seed-only in piece availability logic. */
  is_seed: boolean;
  /** Inclusive piece index range for this file. */
  piece_range: [number, number];
  /** Availability for this file across peers. */
  availability: number;
}

export async function getTorrents(
  options: GetTorrentsOptions = {}
): Promise<QBitTorrentInfo[]> {
  const params = new URLSearchParams();
  if (options.filter) params.append("filter", options.filter);
  if (options.category) params.append("category", options.category);
  if (options.tag) params.append("tag", options.tag);
  if (options.sort) params.append("sort", options.sort);
  if (options.reverse) params.append("reverse", "true");
  if (options.limit) params.append("limit", String(options.limit));
  if (options.offset) params.append("offset", String(options.offset));
  if (options.hashes) params.append("hashes", options.hashes);

  const query = params.toString();
  const path = query ? `/api/v2/torrents/info?${query}` : "/api/v2/torrents/info";
  const response = await qbitFetch(path);
  if (!response.ok) {
    throw new Error(`Failed to get torrents: ${response.status}`);
  }
  return response.json() as Promise<QBitTorrentInfo[]>;
}

export function getManagedQbitTags(): Set<string> {
  const raw = (getSetting("qbit_tag") || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

export async function getManagedQbitTorrents(): Promise<QBitTorrentInfo[]> {
  const managedTags = getManagedQbitTags();
  if (managedTags.size === 0) {
    return getTorrents();
  }

  const byHash = new Map<string, QBitTorrentInfo>();
  const torrentsByTag = await Promise.all(
    Array.from(managedTags).map((tag) => getTorrents({ tag }))
  );

  for (const torrents of torrentsByTag) {
    for (const torrent of torrents) {
      byHash.set(torrent.hash.toLowerCase(), torrent);
    }
  }

  return Array.from(byHash.values());
}

export function hasManagedQbitTag(
  torrent: Pick<QBitTorrentInfo, "tags">,
  managedTags: Set<string>
): boolean {
  if (managedTags.size === 0) return false;
  const torrentTags = (torrent.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return torrentTags.some((tag) => managedTags.has(tag));
}

export function isDownloadComplete(
  torrent: Pick<QBitTorrentInfo, "progress" | "state">
): boolean {
  return (
    torrent.progress === 1 ||
    torrent.state === "uploading" ||
    torrent.state === "stalledUP" ||
    torrent.state === "pausedUP" ||
    torrent.state === "queuedUP" ||
    torrent.state === "checkingUP" ||
    torrent.state === "forcedUP"
  );
}

function isSeedingStopped(torrent: Pick<QBitTorrentInfo, "state">): boolean {
  return torrent.state === "pausedUP" || torrent.state === "pausedDL";
}

export async function cleanupQbitTorrent(
  torrent: Pick<QBitTorrentInfo, "hash" | "tags" | "state">,
  managedTags: Set<string>,
  context: Record<string, unknown>
): Promise<void> {
  if (!hasManagedQbitTag(torrent, managedTags)) return;
  if (!isSeedingStopped(torrent)) return;

  const ok = await deleteTorrents(torrent.hash, true);
  if (ok) {
    logger.info({ ...context, hash: torrent.hash }, "Removed qBittorrent torrent and files");
  } else {
    logger.warn({ ...context, hash: torrent.hash }, "Failed to remove qBittorrent torrent");
  }
}

export async function pauseTorrents(hashes: string | string[]): Promise<boolean> {
  const response = await qbitFetch("/api/v2/torrents/stop", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encodeHashes(hashes),
  });
  return response.ok;
}

export async function resumeTorrents(hashes: string | string[]): Promise<boolean> {
  const response = await qbitFetch("/api/v2/torrents/start", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encodeHashes(hashes),
  });
  return response.ok;
}

export async function deleteTorrents(
  hashes: string | string[],
  deleteFiles: boolean = false
): Promise<boolean> {
  const params = new URLSearchParams();
  params.append("hashes", Array.isArray(hashes) ? hashes.join("|") : hashes);
  params.append("deleteFiles", String(deleteFiles));
  const response = await qbitFetch("/api/v2/torrents/delete", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return response.ok;
}


export async function getTorrentFiles(
  hash: string
): Promise<QBitTorrentFile[]> {
  const params = new URLSearchParams();
  params.append("hash", hash);
  const response = await qbitFetch(`/api/v2/torrents/files?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to get torrent files: ${response.status}`);
  }
  return response.json();
}

export async function testConnection(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const baseUrl = getBaseUrl();
    await ensureLoggedIn(baseUrl);
    const response = await qbitFetch("/api/v2/app/version");
    if (response.ok) {
      const version = await response.text();
      return { ok: true, version };
    }
    return { ok: false, error: `HTTP ${response.status}` };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
