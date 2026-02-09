const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("nas_tools_token") || "";
}

export function setToken(token: string) {
  localStorage.setItem("nas_tools_token", token);
}

export function getStoredToken(): string {
  return getToken();
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ---- Settings ----

export async function getSettings(): Promise<Record<string, string>> {
  return apiFetch("/api/settings");
}

export async function updateSettings(
  settings: Record<string, string>
): Promise<{ success: boolean }> {
  return apiFetch("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function testQbitConnection(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  return apiFetch("/api/settings/test-qbit", { method: "POST" });
}

export async function testAIConfig(): Promise<{ response: string }> {
  return apiFetch("/api/settings/ai/test", { method: "POST" });
}

export type DirEntry = { name: string; path: string };

export async function listDirectories(
  path: string,
  signal?: AbortSignal
): Promise<{ path: string; dirs: DirEntry[] }> {
  const response = await fetch(`/api/dirs?path=${encodeURIComponent(path)}`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json() as Promise<{ path: string; dirs: DirEntry[] }>;
}

// ---- Search ----

export interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date?: string;
  release_date?: string;
  vote_average: number;
  media_type?: string;
  source: "tvdb" | "bgm";
}

export interface SearchResponse {
  page: number;
  results: SearchResult[];
  total_pages: number;
  total_results: number;
}

export async function searchMedia(
  query: string,
  type?: string,
  source: "tvdb" | "bgm" = "tvdb",
  page = 1
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page) });
  if (type) params.set("type", type);
  params.set("source", source);
  return apiFetch(`/api/search?${params}`);
}

export interface TMDBTVDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: {
    id: number;
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
  }[];
  genres: { id: number; name: string }[];
}

export async function getTVDetail(id: number): Promise<TMDBTVDetail> {
  return apiFetch(`/api/search/tv/${id}`);
}

export async function getMovieDetail(id: number) {
  return apiFetch(`/api/search/movie/${id}`);
}

// ---- Subscriptions ----

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
  episodes?: Episode[];
  torrents?: Torrent[];
}

export interface Episode {
  id: number;
  subscription_id: number;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  overview: string | null;
  still_path: string | null;
  status: string;
  torrent_hash: string | null;
  file_path: string | null;
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
}

export async function getSubscriptions(
  status?: string
): Promise<Subscription[]> {
  const params = status ? `?status=${status}` : "";
  return apiFetch(`/api/subscriptions${params}`);
}

export async function getSubscription(id: number): Promise<Subscription> {
  return apiFetch(`/api/subscriptions/${id}`);
}

export async function subscribe(data: {
  source: "tvdb" | "bgm";
  source_id: number;
  media_type: "anime" | "tv" | "movie";
  season_number?: number;
  profile_id?: number | null;
}): Promise<Subscription> {
  return apiFetch("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSubscription(
  id: number,
  data: { status: "active" | "disabled" }
): Promise<{ success: boolean }> {
  return apiFetch(`/api/subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSubscription(
  id: number,
  options?: { deleteFilesOnDisk?: boolean }
): Promise<{ success: boolean }> {
  const body =
    options?.deleteFilesOnDisk !== undefined
      ? JSON.stringify({ delete_files_on_disk: options.deleteFilesOnDisk })
      : undefined;
  return apiFetch(`/api/subscriptions/${id}`, {
    method: "DELETE",
    ...(body ? { body } : {}),
  });
}

// ---- Torrents ----

export interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  guid?: string;
  guidIsPermaLink?: boolean;
  author?: string;
  category?: string;
  categoryDomain?: string;
  source: string;
  enclosure?: {
    url?: string;
    type?: string;
    length?: string;
  };
  torrent?: {
    link?: string;
    contentLength?: string;
    pubDate?: string;
  };
  ai?: {
    englishTitle?: string;
    chineseTitle?: string;
    resolution?: string;
    subTeam?: string;
    format?: string;
    size?: string;
    episodeNumber?: number;
    seasonNumber?: number;
    subtitleLanguage?: string;
  };
}

export async function searchTorrents(
  keyword: string,
  opts?: { season?: number; episode?: number }
): Promise<RSSItem[]> {
  const params = new URLSearchParams({ q: keyword });
  if (opts?.season != null) params.set("season", String(opts.season));
  if (opts?.episode != null) params.set("episode", String(opts.episode));
  return apiFetch(`/api/torrents/search?${params.toString()}`);
}

export async function downloadTorrent(data: {
  subscription_id: number;
  episode_id?: number;
  title: string;
  link: string;
  source: string;
}): Promise<Torrent> {
  return apiFetch("/api/torrents/download", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---- Calendar ----

export interface CalendarEpisode extends Episode {
  subscription_title: string;
  media_type: string;
  poster_path: string | null;
}

export async function getCalendarEpisodes(
  start: string,
  end: string
): Promise<{
  episodes: CalendarEpisode[];
  grouped: Record<string, CalendarEpisode[]>;
}> {
  return apiFetch(`/api/calendar?start=${start}&end=${end}`);
}

// ---- TMDB Image helper ----

export function tmdbImage(
  path: string | null,
  size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w342"
): string {
  if (!path) return "/placeholder.svg";
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// ---- Monitor Jobs ----

export interface JobStatus {
  name: string;
  description: string;
  schedule: string;
  running: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastRunError: string | null;
  nextRunAt: string | null;
}

export async function getMonitorJobs(): Promise<{ jobs: JobStatus[] }> {
  return apiFetch("/api/monitor/jobs");
}

export async function runMonitorJob(name: string): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/monitor/jobs/${encodeURIComponent(name)}/run`, {
    method: "POST",
  });
}

// ---- Profiles ----

export interface Profile {
  id: number;
  name: string;
  description: string | null;
  resolutions: string | null;
  qualities: string | null;
  formats: string | null;
  encoders: string | null;
  min_size_mb: number | null;
  max_size_mb: number | null;
  preferred_keywords: string | null;
  excluded_keywords: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileInput {
  name: string;
  description?: string;
  resolutions?: string[];
  qualities?: string[];
  formats?: string[];
  encoders?: string[];
  min_size_mb?: number | null;
  max_size_mb?: number | null;
  preferred_keywords?: string[];
  excluded_keywords?: string[];
  is_default?: boolean;
}

export async function getProfiles(): Promise<Profile[]> {
  return apiFetch("/api/profiles");
}

export async function getProfile(id: number): Promise<Profile> {
  return apiFetch(`/api/profiles/${id}`);
}

export async function createProfile(data: ProfileInput): Promise<Profile> {
  return apiFetch("/api/profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProfile(
  id: number,
  data: Partial<ProfileInput>
): Promise<Profile> {
  return apiFetch(`/api/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProfile(
  id: number
): Promise<{ success: boolean }> {
  return apiFetch(`/api/profiles/${id}`, { method: "DELETE" });
}
