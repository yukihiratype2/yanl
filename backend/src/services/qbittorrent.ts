import { getSetting } from "../db/settings";
import { logger } from "./logger";

let sid: string | null = null;

async function getBaseUrl(): Promise<string> {
  const url = getSetting("qbit_url");
  if (!url) throw new Error("qBittorrent URL not configured");
  return url.replace(/\/$/, "");
}

async function login(): Promise<string> {
  const baseUrl = await getBaseUrl();
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
    return sid;
  }

  throw new Error("qBittorrent login failed: no SID returned");
}

async function qbitFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  if (sid === null) {
    await login();
  }

  const baseUrl = await getBaseUrl();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const method = (options.method || "GET").toString().toUpperCase();
  
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
    await login();
    if (sid) {
      headers["Cookie"] = `SID=${sid}`;
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
  if (options.skip_checking) formData.append("skip_checking", "true");
  if (options.paused) formData.append("paused", "true");
  if (options.root_folder !== undefined) formData.append("root_folder", String(options.root_folder));
  if (options.rename) formData.append("rename", options.rename);
  if (options.upLimit) formData.append("upLimit", String(options.upLimit));
  if (options.dlLimit) formData.append("dlLimit", String(options.dlLimit));
  if (options.autoTMM) formData.append("autoTMM", "true");
  if (options.sequentialDownload) formData.append("sequentialDownload", "true");
  if (options.firstLastPiecePrio) formData.append("firstLastPiecePrio", "true");

  const response = await qbitFetch("/api/v2/torrents/add", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  return response.ok;
}

export interface QBitTorrentInfo {
  hash: string;
  name: string;
  size: number;
  total_size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  state: string; // downloading, seeding, pausedDL, etc.
  save_path: string;
  content_path: string;
  category: string;
  tags: string;
  added_on: number;
  completion_on: number;
  eta: number; // seconds
  ratio: number;
  amount_left: number;
  time_active: number;
  magnet_uri: string;
  isPrivate?: boolean;
  seq_dl?: boolean;
  f_l_piece_prio?: boolean;
}

export interface GetTorrentsOptions {
  filter?: string;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
  hashes?: string;
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

  const response = await qbitFetch(
    `/api/v2/torrents/info?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error(`Failed to get torrents: ${response.status}`);
  }
  return response.json() as Promise<QBitTorrentInfo[]>;
}

export async function pauseTorrents(hashes: string | string[]): Promise<boolean> {
  const hashList = Array.isArray(hashes) ? hashes.join("|") : hashes;
  const response = await qbitFetch("/api/v2/torrents/stop", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `hashes=${hashList}`,
  });
  return response.ok;
}

export async function resumeTorrents(hashes: string | string[]): Promise<boolean> {
  const hashList = Array.isArray(hashes) ? hashes.join("|") : hashes;
  const response = await qbitFetch("/api/v2/torrents/start", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `hashes=${hashList}`,
  });
  return response.ok;
}

export async function deleteTorrents(
  hashes: string | string[],
  deleteFiles: boolean = false
): Promise<boolean> {
  const hashList = Array.isArray(hashes) ? hashes.join("|") : hashes;
  const response = await qbitFetch("/api/v2/torrents/delete", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `hashes=${hashList}&deleteFiles=${deleteFiles}`,
  });
  return response.ok;
}


export async function getTorrentFiles(
  hash: string
): Promise<{ name: string; size: number; progress: number }[]> {
  const response = await qbitFetch(
    `/api/v2/torrents/files?hash=${hash}`
  );
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
    await login();
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
