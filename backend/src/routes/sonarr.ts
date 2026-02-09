import { Context, Hono } from "hono";
import { resolve } from "node:path";
import * as subscriptionActions from "../actions/subscriptions?sonarr";
import * as models from "../db/models?sonarr";
import { getSetting } from "../db/settings";
import { runJobNow } from "../services/monitor";
import * as tmdb from "../services/tmdb?sonarr";

const sonarrRoutes = new Hono();

type SonarrMediaType = "tv" | "anime";
type Episode = models.Episode;
type Subscription = models.Subscription;

type SonarrTagLike = {
  id: number;
  label: string;
  created_at?: string;
  updated_at?: string;
};

const fallbackSonarrTags: SonarrTagLike[] = [];

type ParsedSeason = {
  seasonNumber: number;
  monitored: boolean;
};

type SonarrSeriesPayload = Record<string, unknown>;

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBoolLike(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toPosterUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/w500${path}`;
}

function parseYear(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.match(/^(\d{4})/);
  if (!match) return 0;
  return Number(match[1]) || 0;
}

function stripSeasonFolder(path: string): string {
  return path.replace(/\/?Season\s+\d+$/i, "");
}

function normalizePath(path: string): string {
  return resolve(path).replace(/[\\/]+$/, "");
}

function samePath(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return normalizePath(a) === normalizePath(b);
  } catch {
    return a === b;
  }
}

function getMediaRootPath(mediaType: SonarrMediaType): string {
  const key = mediaType === "anime" ? "media_dir_anime" : "media_dir_tv";
  return getSetting(key)?.trim() || "";
}

function getAllProfilesSafe(): Array<{ id: number; name: string; is_default?: number }> {
  if (typeof models.getAllProfiles === "function") {
    return models.getAllProfiles() as Array<{ id: number; name: string; is_default?: number }>;
  }
  return [];
}

function getDefaultProfileIdSafe(): number | null {
  if (typeof models.getDefaultProfile === "function") {
    return models.getDefaultProfile()?.id ?? null;
  }
  const profiles = getAllProfilesSafe();
  return profiles.find((profile) => profile.is_default === 1)?.id ?? profiles[0]?.id ?? null;
}

function getAllSonarrTagsSafe(): SonarrTagLike[] {
  if (typeof models.getAllSonarrTags === "function") {
    return models.getAllSonarrTags() as SonarrTagLike[];
  }
  return fallbackSonarrTags;
}

function getSonarrTagByLabelSafe(label: string): SonarrTagLike | null {
  if (typeof models.getSonarrTagByLabel === "function") {
    return (models.getSonarrTagByLabel(label) as SonarrTagLike | null) ?? null;
  }
  return getAllSonarrTagsSafe().find((tag) => tag.label === label) ?? null;
}

function createSonarrTagSafe(label: string): SonarrTagLike {
  if (typeof models.createSonarrTag === "function") {
    return models.createSonarrTag(label) as SonarrTagLike;
  }
  const nextId =
    fallbackSonarrTags.reduce((max, tag) => Math.max(max, tag.id), 0) + 1;
  const now = new Date().toISOString();
  const tag = { id: nextId, label, created_at: now, updated_at: now };
  fallbackSonarrTags.push(tag);
  return tag;
}

function getEpisodeByIdSafe(episodeId: number): Episode | null {
  if (typeof models.getEpisodeById === "function") {
    return models.getEpisodeById(episodeId) ?? null;
  }
  for (const sub of getAllTvSubscriptions()) {
    const found = models
      .getEpisodesBySubscription(sub.id)
      .find((episode) => episode.id === episodeId);
    if (found) return found;
  }
  return null;
}

function getAllTvSubscriptions(): Subscription[] {
  return models.getAllSubscriptions().filter(
    (sub) =>
      sub.source === "tvdb" &&
      (sub.media_type === "tv" || sub.media_type === "anime")
  );
}

function getSubscriptionsForSeries(
  tmdbId: number,
  mediaType?: SonarrMediaType
): Subscription[] {
  return getAllTvSubscriptions().filter((sub) => {
    if (sub.source_id !== tmdbId) return false;
    if (!mediaType) return true;
    return sub.media_type === mediaType;
  });
}

function inferMediaTypeFromSubs(subs: Subscription[]): SonarrMediaType {
  const hasAnime = subs.some((sub) => sub.media_type === "anime");
  return hasAnime ? "anime" : "tv";
}

function inferMediaTypeFromPayload(
  payload: SonarrSeriesPayload,
  fallback: SonarrMediaType
): SonarrMediaType {
  const seriesType =
    typeof payload.seriesType === "string" ? payload.seriesType.toLowerCase() : null;
  if (seriesType === "anime") return "anime";

  const rootFolderPath =
    typeof payload.rootFolderPath === "string" ? payload.rootFolderPath : null;
  if (samePath(rootFolderPath, getMediaRootPath("anime"))) {
    return "anime";
  }
  if (samePath(rootFolderPath, getMediaRootPath("tv"))) {
    return "tv";
  }

  return fallback;
}

function parseProfileId(payload: SonarrSeriesPayload): number | null {
  const qualityProfileId =
    payload.qualityProfileId ?? payload.profileId ?? payload["qualityprofileid"];
  return parsePositiveInt(qualityProfileId);
}

function parseSeasons(payload: SonarrSeriesPayload): ParsedSeason[] {
  const raw = payload.seasons;
  if (!Array.isArray(raw)) return [];

  const parsed = new Map<number, ParsedSeason>();

  for (const entry of raw) {
    if (typeof entry === "number" && Number.isInteger(entry) && entry > 0) {
      parsed.set(entry, { seasonNumber: entry, monitored: true });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;

    const item = entry as Record<string, unknown>;
    const seasonNumber = parsePositiveInt(item.seasonNumber ?? item.season_number);
    if (!seasonNumber) continue;

    const monitored = item.monitored !== false;
    parsed.set(seasonNumber, { seasonNumber, monitored });
  }

  return Array.from(parsed.values()).sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function getMonitoredSeasonSet(seasons: ParsedSeason[]): Set<number> {
  return new Set(
    seasons
      .filter((season) => season.monitored && season.seasonNumber > 0)
      .map((season) => season.seasonNumber)
  );
}

async function resolveTmdbIdFromTvdb(tvdbId: number): Promise<number> {
  const lookupFn = (tmdb as Record<string, unknown>).findTVByTvdbId;
  if (typeof lookupFn !== "function") {
    return tvdbId;
  }
  const resolved = await (lookupFn as (id: number) => Promise<{ id: number } | null>)(tvdbId);
  if (!resolved) {
    throw new Error("TVDB series not found in TMDB");
  }
  return resolved.id;
}

function gatherEpisodesForSubs(subs: Subscription[]): Episode[] {
  const episodes: Episode[] = [];
  for (const sub of subs) {
    episodes.push(...models.getEpisodesBySubscription(sub.id));
  }
  return episodes;
}

async function buildSeriesDto(
  tmdbId: number,
  options: {
    forcedMediaType?: SonarrMediaType;
    forcedTvdbId?: number | null;
    fallbackTitle?: string | null;
  } = {}
): Promise<Record<string, unknown> | null> {
  const allSubs = getSubscriptionsForSeries(tmdbId);
  const defaultMediaType = allSubs.length > 0 ? inferMediaTypeFromSubs(allSubs) : "tv";
  const mediaType = options.forcedMediaType ?? defaultMediaType;
  const sameTypeSubs = allSubs.filter((sub) => sub.media_type === mediaType);
  const relevantSubs = sameTypeSubs.length > 0 ? sameTypeSubs : allSubs;

  let detail: Awaited<ReturnType<typeof tmdb.getTVDetail>> | null = null;
  try {
    detail = await tmdb.getTVDetail(tmdbId);
  } catch {
    detail = null;
  }

  let externalIds: tmdb.TMDBTVExternalIds | null = null;
  try {
    externalIds = await tmdb.getTVExternalIds(tmdbId);
  } catch {
    externalIds = null;
  }

  const firstSub = relevantSubs[0] ?? allSubs[0] ?? null;
  const title = detail?.name || firstSub?.title || options.fallbackTitle || null;
  if (!title) return null;

  const titleSlug = sanitizeSlug(title) || String(tmdbId);
  const rootFolderPath = getMediaRootPath(mediaType);
  const profileId = firstSub?.profile_id ?? getDefaultProfileIdSafe() ?? 1;

  const monitoredSeasonSet = new Set(
    relevantSubs
      .filter((sub) => sub.status === "active" && sub.season_number != null)
      .map((sub) => sub.season_number as number)
  );

  const seasonNumbersFromTmdb =
    detail?.seasons
      ?.map((season) => season.season_number)
      .filter((value): value is number => Number.isInteger(value) && value >= 0) || [];

  const seasonNumbersFromSubs = relevantSubs
    .map((sub) => sub.season_number)
    .filter((value): value is number => Number.isInteger(value) && value >= 0);

  const seasonNumbers = Array.from(
    new Set([...seasonNumbersFromTmdb, ...seasonNumbersFromSubs])
  ).sort((a, b) => a - b);

  const seasons = seasonNumbers.map((seasonNumber) => ({
    seasonNumber,
    monitored: monitoredSeasonSet.has(seasonNumber),
  }));

  const episodes = gatherEpisodesForSubs(relevantSubs);
  const totalEpisodeCount =
    detail?.number_of_episodes ??
    episodes.filter((ep, idx, arr) => {
      const key = `${ep.season_number ?? 0}:${ep.episode_number}`;
      return arr.findIndex((x) => `${x.season_number ?? 0}:${x.episode_number}` === key) === idx;
    }).length;

  const episodeFileCount = episodes.filter(
    (ep) => ep.status === "downloaded" || ep.status === "moved" || Boolean(ep.file_path)
  ).length;

  const firstAirDate = detail?.first_air_date ?? firstSub?.first_air_date ?? "";
  const addedAt = firstSub?.created_at
    ? new Date(firstSub.created_at).toISOString()
    : new Date().toISOString();

  const pathFromSub = firstSub?.folder_path ? stripSeasonFolder(firstSub.folder_path) : "";
  const seriesPath =
    pathFromSub ||
    (rootFolderPath
      ? `${rootFolderPath.replace(/[\\/]+$/, "")}/${title.replace(/[<>:"/\\|?*]/g, "")}`
      : "");

  const seasonCount = seasons.filter((season) => season.seasonNumber > 0).length;
  const percentOfEpisodes =
    totalEpisodeCount > 0
      ? Number(((episodeFileCount / totalEpisodeCount) * 100).toFixed(2))
      : 0;

  return {
    title,
    sortTitle: title,
    seasonCount,
    status: "continuing",
    overview: detail?.overview ?? firstSub?.overview ?? "",
    network: "",
    airTime: "",
    images: detail?.poster_path
      ? [{ coverType: "poster", url: toPosterUrl(detail.poster_path) }]
      : [],
    remotePoster: toPosterUrl(detail?.poster_path ?? firstSub?.poster_path),
    seasons,
    year: parseYear(firstAirDate),
    path: seriesPath,
    profileId,
    languageProfileId: 1,
    seasonFolder: true,
    monitored: monitoredSeasonSet.size > 0,
    useSceneNumbering: false,
    runtime: 0,
    tvdbId: options.forcedTvdbId ?? externalIds?.tvdb_id ?? null,
    tvRageId: 0,
    tvMazeId: externalIds?.tvmaze_id ?? 0,
    firstAired: firstAirDate,
    lastInfoSync: new Date().toISOString(),
    seriesType: mediaType === "anime" ? "anime" : "standard",
    cleanTitle: titleSlug,
    imdbId: externalIds?.imdb_id ?? "",
    titleSlug,
    certification: "",
    genres: detail?.genres?.map((genre) => genre.name) ?? [],
    tags: [],
    added: addedAt,
    ratings: {
      votes: 0,
      value: detail?.vote_average ?? firstSub?.vote_average ?? 0,
    },
    qualityProfileId: profileId,
    rootFolderPath,
    statistics: {
      seasonCount,
      episodeFileCount,
      episodeCount: totalEpisodeCount,
      totalEpisodeCount,
      sizeOnDisk: 0,
      releaseGroups: [],
      percentOfEpisodes,
    },
    ...(relevantSubs.length > 0 ? { id: tmdbId } : {}),
  };
}

async function ensureSeasonSubscription(
  tmdbId: number,
  mediaType: SonarrMediaType,
  seasonNumber: number,
  profileId: number
): Promise<Subscription> {
  const existing = models.getSubscriptionBySourceId(
    "tvdb",
    tmdbId,
    mediaType,
    seasonNumber
  );
  if (existing) {
    models.updateSubscription(existing.id, {
      status: "active",
      profile_id: profileId,
    });
    return models.getSubscriptionById(existing.id)!;
  }

  const result = await subscriptionActions.createSubscriptionWithEpisodes({
    source: "tvdb",
    source_id: tmdbId,
    media_type: mediaType,
    season_number: seasonNumber,
    profile_id: profileId,
  });

  if (result.ok) {
    return result.data;
  }

  if (result.status === 409) {
    const conflict = models.getSubscriptionBySourceId(
      "tvdb",
      tmdbId,
      mediaType,
      seasonNumber
    );
    if (conflict) {
      models.updateSubscription(conflict.id, {
        status: "active",
        profile_id: profileId,
      });
      return models.getSubscriptionById(conflict.id)!;
    }
  }

  throw new Error(result.error);
}

async function upsertSeriesFromPayload(
  payload: SonarrSeriesPayload,
  mode: "create" | "update"
): Promise<{ tmdbId: number; tvdbId: number; mediaType: SonarrMediaType }> {
  const tvdbId = parsePositiveInt(payload.tvdbId ?? payload.tvdbid);
  if (!tvdbId) {
    throw new Error("Missing tvdbId");
  }

  const profileId = parseProfileId(payload);
  if (!profileId) {
    throw new Error("Missing qualityProfileId");
  }
  if (!models.getProfileById(profileId)) {
    throw new Error("Profile not found");
  }

  const tmdbId = await resolveTmdbIdFromTvdb(tvdbId);
  const existingSubs = getSubscriptionsForSeries(tmdbId);
  const fallbackType = existingSubs.length > 0 ? inferMediaTypeFromSubs(existingSubs) : "tv";
  const mediaType = inferMediaTypeFromPayload(payload, fallbackType);

  const parsedSeasons = parseSeasons(payload);
  const monitoredSet = getMonitoredSeasonSet(parsedSeasons);

  if (mode === "create" && monitoredSet.size === 0) {
    throw new Error("At least one monitored season is required");
  }

  for (const seasonNumber of monitoredSet) {
    await ensureSeasonSubscription(tmdbId, mediaType, seasonNumber, profileId);
  }

  const currentSubs = getSubscriptionsForSeries(tmdbId, mediaType).filter(
    (sub) => sub.season_number != null && sub.season_number > 0
  );

  if (mode === "update") {
    for (const sub of currentSubs) {
      if (sub.season_number == null) continue;
      if (monitoredSet.has(sub.season_number)) {
        models.updateSubscription(sub.id, { status: "active", profile_id: profileId });
      } else {
        models.updateSubscription(sub.id, { status: "disabled", profile_id: profileId });
      }
    }
  }

  const shouldSearchNow =
    parseBoolLike(payload.searchNow) ||
    parseBoolLike((payload.addOptions as Record<string, unknown> | undefined)
      ?.searchForMissingEpisodes);

  if (shouldSearchNow) {
    runJobNow("searchAndDownload");
  }

  return { tmdbId, tvdbId, mediaType };
}

function toEpisodeDto(episode: Episode, subscription: Subscription, seriesId: number) {
  const hasFile =
    episode.status === "downloaded" || episode.status === "moved" || Boolean(episode.file_path);

  return {
    seriesId,
    episodeFileId: hasFile ? episode.id : 0,
    seasonNumber: episode.season_number ?? subscription.season_number ?? 0,
    episodeNumber: episode.episode_number,
    title: episode.title || `Episode ${episode.episode_number}`,
    airDate: episode.air_date || "",
    airDateUtc: episode.air_date ? `${episode.air_date}T00:00:00Z` : "",
    overview: episode.overview || "",
    hasFile,
    monitored: subscription.status === "active",
    absoluteEpisodeNumber: episode.episode_number,
    unverifiedSceneNumbering: false,
    id: episode.id,
  };
}

function toQueueRecord(
  torrent: ReturnType<typeof models.getTorrentsBySubscription>[number],
  subscription: Subscription,
  episode: Episode | null
): Record<string, unknown> {
  const normalizedStatus =
    torrent.status === "downloading"
      ? "downloading"
      : torrent.status === "pending"
        ? "queued"
        : torrent.status;

  const size = Number(torrent.size ?? 0);
  const safeSize = Number.isFinite(size) && size >= 0 ? size : 0;

  return {
    id: torrent.id,
    seriesId: subscription.source_id,
    episodeId: torrent.episode_id ?? episode?.id ?? 0,
    episode: episode ? toEpisodeDto(episode, subscription, subscription.source_id) : null,
    size: safeSize,
    title: torrent.title,
    sizeleft: 0,
    timeleft: "00:00:00",
    estimatedCompletionTime: new Date().toISOString(),
    status: normalizedStatus,
    trackedDownloadStatus: normalizedStatus,
    trackedDownloadState: normalizedStatus,
    downloadId: torrent.hash || String(torrent.id),
    protocol: "torrent",
    downloadClient: "qBittorrent",
    indexer: torrent.source || "unknown",
  };
}

sonarrRoutes.get("/system/status", (c) => {
  return c.json({
    version: "3.0.0.0",
    buildTime: new Date().toISOString(),
    isDebug: false,
    isProduction: true,
    isAdmin: true,
    isUserInteractive: false,
    startupPath: process.cwd(),
    appData: process.cwd(),
    osName: "Linux",
    osVersion: "unknown",
    isNetCore: false,
    isMono: false,
    isLinux: true,
    isOsx: false,
    isWindows: false,
    isDocker: true,
    mode: "production",
    branch: "main",
    authentication: "none",
    sqliteVersion: "3",
    migrationVersion: 1,
    urlBase: "",
    runtimeVersion: "bun",
    runtimeName: "NAS Tools",
    startTime: new Date().toISOString(),
    packageUpdateMechanism: "external",
  });
});

const qualityProfileHandler = (c: Context) => {
  const profiles = getAllProfilesSafe().map((profile) => ({
    id: profile.id,
    name: profile.name,
  }));
  return c.json(profiles);
};

sonarrRoutes.get("/qualityProfile", qualityProfileHandler);
sonarrRoutes.get("/qualityprofile", qualityProfileHandler);

sonarrRoutes.get("/rootfolder", (c) => {
  const tvPath = getMediaRootPath("tv");
  const animePath = getMediaRootPath("anime");
  const raw = [tvPath, animePath].filter(Boolean);
  const unique = Array.from(
    new Map(raw.map((path) => [normalizePath(path), path])).values()
  );

  return c.json(
    unique.map((path, index) => ({
      id: index + 1,
      path,
      freeSpace: 0,
      totalSpace: 0,
      unmappedFolders: [],
    }))
  );
});

sonarrRoutes.get("/languageprofile", (c) => {
  return c.json([
    { id: 1, name: "English" },
    { id: 2, name: "Original" },
  ]);
});

sonarrRoutes.get("/tag", (c) => {
  return c.json(getAllSonarrTagsSafe().map((tag) => ({ id: tag.id, label: tag.label })));
});

sonarrRoutes.post("/tag", async (c) => {
  const body = await c.req.json<unknown>().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const label = (body as Record<string, unknown>).label;
  if (typeof label !== "string" || !label.trim()) {
    return c.json({ error: "Missing label" }, 400);
  }

  const existing = getSonarrTagByLabelSafe(label.trim());
  const tag = existing ?? createSonarrTagSafe(label.trim());
  return c.json({ id: tag.id, label: tag.label }, existing ? 200 : 201);
});

sonarrRoutes.get("/series/lookup", async (c) => {
  const term = c.req.query("term")?.trim();
  if (!term) {
    return c.json({ error: "Missing query parameter 'term'" }, 400);
  }

  const tvdbMatch = /^tvdb:(\d+)$/i.exec(term);
  if (tvdbMatch) {
    const tvdbId = Number(tvdbMatch[1]);
    try {
      const tmdbId = await resolveTmdbIdFromTvdb(tvdbId);
      const dto = await buildSeriesDto(tmdbId, { forcedTvdbId: tvdbId });
      if (!dto) {
        return c.json({ error: "Series metadata not found" }, 404);
      }
      return c.json([dto]);
    } catch (error: any) {
      return c.json({ error: error.message || "Failed to resolve TVDB ID" }, 422);
    }
  }

  try {
    const searchResult = await tmdb.searchTV(term, 1);
    const output: Record<string, unknown>[] = [];

    for (const item of searchResult.results.slice(0, 20)) {
      const dto = await buildSeriesDto(item.id, {
        fallbackTitle: item.name ?? item.title ?? null,
      });
      if (dto) output.push(dto);
    }

    return c.json(output);
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to lookup series" }, 500);
  }
});

sonarrRoutes.get("/series", async (c) => {
  const ids = Array.from(
    new Set(getAllTvSubscriptions().map((sub) => sub.source_id))
  ).sort((a, b) => a - b);

  const seriesList: Record<string, unknown>[] = [];
  for (const id of ids) {
    const dto = await buildSeriesDto(id);
    if (dto) seriesList.push(dto);
  }

  return c.json(seriesList);
});

sonarrRoutes.get("/series/:id", async (c) => {
  const seriesId = parsePositiveInt(c.req.param("id"));
  if (!seriesId) {
    return c.json({ error: "Invalid path parameter 'id'" }, 400);
  }

  const dto = await buildSeriesDto(seriesId);
  if (!dto || !("id" in dto)) {
    return c.json({ error: "Series not found" }, 404);
  }

  return c.json(dto);
});

sonarrRoutes.post("/series", async (c) => {
  const payload = await c.req.json<unknown>().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const { tmdbId, tvdbId, mediaType } = await upsertSeriesFromPayload(
      payload as SonarrSeriesPayload,
      "create"
    );
    const dto = await buildSeriesDto(tmdbId, {
      forcedMediaType: mediaType,
      forcedTvdbId: tvdbId,
    });
    if (!dto) {
      return c.json({ error: "Failed to build series response" }, 500);
    }
    return c.json(dto, 201);
  } catch (error: any) {
    const message = error?.message || "Failed to add series";
    if (
      message.includes("Missing tvdbId") ||
      message.includes("Missing qualityProfileId") ||
      message.includes("At least one monitored season")
    ) {
      return c.json({ error: message }, 400);
    }
    if (message.includes("Profile not found")) {
      return c.json({ error: message }, 400);
    }
    if (message.includes("TVDB series not found")) {
      return c.json({ error: message }, 422);
    }
    return c.json({ error: message }, 500);
  }
});

sonarrRoutes.put("/series", async (c) => {
  const payload = await c.req.json<unknown>().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const { tmdbId, tvdbId, mediaType } = await upsertSeriesFromPayload(
      payload as SonarrSeriesPayload,
      "update"
    );
    const dto = await buildSeriesDto(tmdbId, {
      forcedMediaType: mediaType,
      forcedTvdbId: tvdbId,
    });
    if (!dto) {
      return c.json({ error: "Series not found" }, 404);
    }
    return c.json(dto);
  } catch (error: any) {
    const message = error?.message || "Failed to update series";
    if (message.includes("Missing tvdbId") || message.includes("Missing qualityProfileId")) {
      return c.json({ error: message }, 400);
    }
    if (message.includes("Profile not found")) {
      return c.json({ error: message }, 400);
    }
    if (message.includes("TVDB series not found")) {
      return c.json({ error: message }, 422);
    }
    return c.json({ error: message }, 500);
  }
});

sonarrRoutes.delete("/series/:id", async (c) => {
  const seriesId = parsePositiveInt(c.req.param("id"));
  if (!seriesId) {
    return c.json({ error: "Invalid path parameter 'id'" }, 400);
  }

  const deleteFiles = parseBoolLike(c.req.query("deleteFiles"));
  const subs = getSubscriptionsForSeries(seriesId);
  if (subs.length === 0) {
    return c.json({ error: "Series not found" }, 404);
  }

  for (const sub of subs) {
    const result = await subscriptionActions.deleteSubscriptionWithCleanup(sub, {
      deleteFilesOnDisk: deleteFiles,
    });
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }
  }

  return c.json({ success: true });
});

sonarrRoutes.get("/episode", (c) => {
  const seriesId = parsePositiveInt(c.req.query("seriesId"));
  if (!seriesId) {
    return c.json({ error: "Invalid query parameter 'seriesId'" }, 400);
  }

  const subs = getSubscriptionsForSeries(seriesId);
  if (subs.length === 0) {
    return c.json([]);
  }

  const episodes = subs
    .flatMap((sub) => models.getEpisodesBySubscription(sub.id).map((ep) => ({ ep, sub })))
    .map(({ ep, sub }) => toEpisodeDto(ep, sub, seriesId))
    .sort((a, b) => {
      const seasonDiff = a.seasonNumber - b.seasonNumber;
      if (seasonDiff !== 0) return seasonDiff;
      return a.episodeNumber - b.episodeNumber;
    });

  return c.json(episodes);
});

sonarrRoutes.put("/episode/monitor", async (c) => {
  const payload = await c.req.json<unknown>().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const body = payload as Record<string, unknown>;
  const monitored = body.monitored !== false;
  const episodeIds = Array.isArray(body.episodeIds)
    ? body.episodeIds.map((value) => parsePositiveInt(value)).filter((value): value is number => value != null)
    : [];

  if (episodeIds.length === 0) {
    return c.json({ error: "Missing episodeIds" }, 400);
  }

  const affectedSubscriptionIds = new Set<number>();
  for (const episodeId of episodeIds) {
    const episode = getEpisodeByIdSafe(episodeId);
    if (episode) {
      affectedSubscriptionIds.add(episode.subscription_id);
    }
  }

  for (const subscriptionId of affectedSubscriptionIds) {
    models.updateSubscription(subscriptionId, {
      status: monitored ? "active" : "disabled",
    });
  }

  return c.json({ success: true });
});

sonarrRoutes.get("/queue", (c) => {
  const records: Record<string, unknown>[] = [];
  for (const sub of getAllTvSubscriptions()) {
    const episodesById = new Map(
      models.getEpisodesBySubscription(sub.id).map((episode) => [episode.id, episode])
    );
    for (const torrent of models.getTorrentsBySubscription(sub.id)) {
      if (![
        "pending",
        "downloading",
      ].includes(torrent.status)) {
        continue;
      }
      const episode = torrent.episode_id ? episodesById.get(torrent.episode_id) ?? null : null;
      records.push(toQueueRecord(torrent, sub, episode));
    }
  }

  return c.json({
    page: 1,
    pageSize: records.length,
    sortKey: "timeleft",
    sortDirection: "descending",
    totalRecords: records.length,
    records,
  });
});

sonarrRoutes.post("/command", async (c) => {
  const payload = await c.req.json<unknown>().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const body = payload as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : "";

  switch (name) {
    case "MissingEpisodeSearch":
      runJobNow("searchAndDownload");
      break;
    case "RefreshMonitoredDownloads":
      runJobNow("monitorDownloads");
      break;
    default:
      return c.json({ error: `Unsupported command: ${name}` }, 400);
  }

  return c.json({
    id: Date.now(),
    name,
    body,
    state: "queued",
    queued: true,
    startedOn: new Date().toISOString(),
  });
});

export default sonarrRoutes;
