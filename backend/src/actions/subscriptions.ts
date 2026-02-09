import * as models from "../db/models";
import * as tmdb from "../services/tmdb";
import * as bgm from "../services/bgm";
import * as fileManager from "../services/fileManager";
import { qbittorrent, type QbittorrentService } from "../services/qbittorrent";
import { logger as baseLogger } from "../services/logger";
import { err, ok, type Result } from "../lib/result";
import { normalizeDateOnly } from "../lib/date";

export type CreateSubscriptionInput = {
  source?: "tvdb" | "bgm";
  source_id?: number;
  tmdb_id?: number;
  media_type: "anime" | "tv" | "movie";
  season_number?: number;
  profile_id?: number | null;
};

export type DeleteSubscriptionOptions = {
  deleteFilesOnDisk: boolean;
};

type Logger = Pick<typeof baseLogger, "info" | "warn" | "error">;

export type SubscriptionDeps = {
  models: typeof models;
  tmdb: typeof tmdb;
  bgm: typeof bgm;
  fileManager: typeof fileManager;
  qbittorrent: QbittorrentService;
  logger: Logger;
};

const defaultDeps: SubscriptionDeps = {
  models,
  tmdb,
  bgm,
  fileManager,
  qbittorrent,
  logger: baseLogger,
};

class InvalidCoreExternalDateError extends Error {
  readonly status = 422;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "InvalidCoreExternalDateError";
    this.details = details;
  }
}

export async function createSubscriptionWithEpisodes(
  input: CreateSubscriptionInput,
  deps: SubscriptionDeps = defaultDeps
): Promise<Result<models.Subscription>> {
  const source = input.source ?? "tvdb";
  const rawSourceId = input.source_id ?? input.tmdb_id;
  const sourceId = rawSourceId != null ? Number(rawSourceId) : null;
  const seasonNumber = input.season_number ?? null;
  let profileId: number | null =
    input.profile_id !== undefined ? input.profile_id : null;

  if (!sourceId || Number.isNaN(sourceId)) {
    return err(400, "Missing source_id");
  }
  if (source !== "tvdb" && source !== "bgm") {
    return err(400, "Invalid source");
  }

  if (profileId != null) {
    const profile = deps.models.getProfileById(profileId);
    if (!profile) {
      return err(400, "Profile not found");
    }
  } else {
    const defaultProfile = deps.models.getDefaultProfile();
    profileId = defaultProfile ? defaultProfile.id : null;
  }

  const existing = deps.models.getSubscriptionBySourceId(
    source,
    sourceId,
    input.media_type,
    seasonNumber
  );
  if (existing) {
    return err(409, "Already subscribed", { subscription: existing });
  }

  try {
    const metadata = await fetchSubscriptionMetadata(
      source,
      input.media_type,
      sourceId,
      seasonNumber,
      deps
    );

    const folderPath = deps.fileManager.createMediaFolder(
      input.media_type,
      metadata.title,
      metadata.season_number
    );

    const subscription = deps.models.createSubscription({
      source,
      source_id: sourceId,
      media_type: input.media_type,
      title: metadata.title,
      title_original: metadata.title_original,
      overview: metadata.overview,
      poster_path: metadata.poster_path,
      backdrop_path: metadata.backdrop_path,
      first_air_date: metadata.first_air_date,
      vote_average: metadata.vote_average,
      season_number: metadata.season_number,
      total_episodes: metadata.total_episodes,
      status: "active",
      folder_path: folderPath,
      profile_id: profileId,
    });

    if (input.media_type !== "movie") {
      await createInitialEpisodes(subscription, source, deps);
    }

    return ok(subscription);
  } catch (error: any) {
    if (error instanceof InvalidCoreExternalDateError) {
      return err(error.status, error.message, error.details);
    }
    return err(500, error?.message || "Failed to create subscription");
  }
}

export async function deleteSubscriptionWithCleanup(
  subscription: models.Subscription,
  options: DeleteSubscriptionOptions,
  deps: SubscriptionDeps = defaultDeps
): Promise<Result<{ success: true }>> {
  const torrents = deps.models.getTorrentsBySubscription(subscription.id);
  const episodes = deps.models.getEpisodesBySubscription(subscription.id);
  const hashSet = collectTorrentHashes(torrents, episodes);

  if (hashSet.size > 0) {
    try {
      const success = await deps.qbittorrent.deleteTorrents(
        Array.from(hashSet),
        options.deleteFilesOnDisk
      );
      if (!success) {
        return err(502, "Failed to delete torrents in qBittorrent");
      }
    } catch (error: any) {
      return err(500, error?.message || "Failed to delete torrents");
    }
  }

  if (options.deleteFilesOnDisk && subscription.folder_path) {
    deps.fileManager.deleteMediaFolder(subscription.media_type, subscription.folder_path);
  }

  deps.models.deleteSubscription(subscription.id);
  return ok({ success: true });
}

function collectTorrentHashes(
  torrents: models.Torrent[],
  episodes: models.Episode[]
): Set<string> {
  const hashSet = new Set<string>();
  for (const torrent of torrents) {
    if (torrent.hash) hashSet.add(torrent.hash.toLowerCase());
  }
  for (const episode of episodes) {
    if (episode.torrent_hash) hashSet.add(episode.torrent_hash.toLowerCase());
  }
  return hashSet;
}

type ExternalDateParseResult =
  | { type: "empty"; value: null }
  | { type: "normalized"; value: string }
  | { type: "invalid"; value: string };

function parseExternalDate(value: string | null | undefined): ExternalDateParseResult {
  if (value == null) return { type: "empty", value: null };

  const trimmed = value.trim();
  if (!trimmed) return { type: "empty", value: null };

  const normalized = normalizeDateOnly(trimmed);
  if (normalized) return { type: "normalized", value: normalized };
  return { type: "invalid", value: trimmed };
}

function normalizeCoreExternalDate(
  value: string | null | undefined,
  deps: SubscriptionDeps,
  context: Record<string, unknown>
): string | null {
  const parsed = parseExternalDate(value);
  if (parsed.type === "normalized" || parsed.type === "empty") {
    return parsed.value;
  }

  deps.logger.warn(
    {
      ...context,
      date: parsed.value,
    },
    "Received invalid core date from external source"
  );
  throw new InvalidCoreExternalDateError("Invalid date received from external source", {
    ...context,
    date: parsed.value,
  });
}

function normalizeEpisodeExternalDate(
  value: string | null | undefined,
  deps: SubscriptionDeps,
  context: Record<string, unknown>
): { shouldSkip: boolean; value: string | null } {
  const parsed = parseExternalDate(value);
  if (parsed.type === "normalized" || parsed.type === "empty") {
    return { shouldSkip: false, value: parsed.value };
  }

  deps.logger.warn(
    {
      ...context,
      date: parsed.value,
    },
    "Skipping episode with invalid air_date from external source"
  );
  return { shouldSkip: true, value: null };
}

async function fetchSubscriptionMetadata(
  source: "tvdb" | "bgm",
  mediaType: "anime" | "tv" | "movie",
  sourceId: number,
  seasonNumber: number | null,
  deps: SubscriptionDeps
): Promise<{
  title: string;
  title_original: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number | null;
  total_episodes: number | null;
  season_number: number | null;
}> {
  if (source === "bgm") {
    const detail = await deps.bgm.getSubjectDetail(sourceId);
    return {
      title: detail.name_cn || detail.name,
      title_original: detail.name || detail.name_cn || null,
      overview: detail.summary || null,
      poster_path: detail.images?.medium ?? detail.images?.small ?? null,
      backdrop_path: detail.images?.large ?? null,
      first_air_date: normalizeCoreExternalDate(detail.date, deps, {
        source,
        sourceId,
        mediaType,
        field: "first_air_date",
      }),
      vote_average: detail.rating?.score ?? null,
      total_episodes: detail.total_episodes ?? detail.eps ?? null,
      season_number: seasonNumber,
    };
  }

  if (mediaType === "movie") {
    const detail = await deps.tmdb.getMovieDetail(sourceId);
    return {
      title: detail.title,
      title_original: detail.original_title,
      overview: detail.overview,
      poster_path: detail.poster_path,
      backdrop_path: detail.backdrop_path,
      first_air_date: normalizeCoreExternalDate(detail.release_date, deps, {
        source,
        sourceId,
        mediaType,
        field: "first_air_date",
      }),
      vote_average: detail.vote_average,
      total_episodes: null,
      season_number: seasonNumber,
    };
  }

  const detail = await deps.tmdb.getTVDetail(sourceId);
  let totalEpisodes: number | null = null;
  if (seasonNumber != null) {
    const season = detail.seasons.find((s) => s.season_number === seasonNumber);
    totalEpisodes = season?.episode_count ?? null;
  }

  return {
    title: detail.name,
    title_original: detail.original_name,
    overview: detail.overview,
    poster_path: detail.poster_path,
    backdrop_path: detail.backdrop_path,
    first_air_date: normalizeCoreExternalDate(detail.first_air_date, deps, {
      source,
      sourceId,
      mediaType,
      field: "first_air_date",
    }),
    vote_average: detail.vote_average,
    total_episodes: totalEpisodes,
    season_number: seasonNumber,
  };
}

async function createInitialEpisodes(
  subscription: models.Subscription,
  source: "tvdb" | "bgm",
  deps: SubscriptionDeps
): Promise<void> {
  if (source === "tvdb" && subscription.season_number != null) {
    try {
      const seasonDetail = await deps.tmdb.getSeasonDetail(
        subscription.source_id,
        subscription.season_number
      );
      for (const ep of seasonDetail.episodes) {
        const airDate = normalizeEpisodeExternalDate(ep.air_date, deps, {
          source,
          sourceId: subscription.source_id,
          subscriptionId: subscription.id,
          seasonNumber: subscription.season_number,
          episodeNumber: ep.episode_number,
          field: "air_date",
        });
        if (airDate.shouldSkip) continue;
        deps.models.createEpisode({
          subscription_id: subscription.id,
          season_number: subscription.season_number,
          episode_number: ep.episode_number,
          title: ep.name,
          air_date: airDate.value,
          overview: ep.overview,
          still_path: ep.still_path,
          status: "pending",
          torrent_hash: null,
          file_path: null,
        });
      }
    } catch (error: any) {
      deps.logger.error({ error }, "Failed to fetch episodes");
    }
  }

  if (source === "bgm") {
    try {
      const episodes = await deps.bgm.getAllEpisodes(subscription.source_id, { type: 0 });
      for (const ep of episodes) {
        const numberRaw = ep.ep ?? ep.sort;
        const episodeNumber = Number(numberRaw);
        if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) continue;
        const titleText = ep.name_cn || ep.name || null;
        const airDate = normalizeEpisodeExternalDate(ep.airdate, deps, {
          source,
          sourceId: subscription.source_id,
          subscriptionId: subscription.id,
          episodeNumber,
          field: "air_date",
        });
        if (airDate.shouldSkip) continue;
        deps.models.createEpisode({
          subscription_id: subscription.id,
          season_number: null,
          episode_number: episodeNumber,
          title: titleText,
          air_date: airDate.value,
          overview: ep.desc || null,
          still_path: null,
          status: "pending",
          torrent_hash: null,
          file_path: null,
        });
      }
    } catch (error: any) {
      deps.logger.error({ error }, "Failed to fetch BGM episodes");
    }
  }
}
