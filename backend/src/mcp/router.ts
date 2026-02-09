import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Hono } from "hono";
import {
  getAllSubscriptions,
  getActiveSubscriptions,
  getEpisodesBySubscription,
  getSubscriptionById,
  getTorrentsBySubscription,
  updateSubscription,
  type Episode,
  type Subscription,
  type Torrent,
} from "../db/models";
import {
  createSubscriptionWithEpisodes,
  deleteSubscriptionWithCleanup,
} from "../actions/subscriptions";
import * as tmdb from "../services/tmdb";
import * as bgm from "../services/bgm";
import { isOnOrBeforeDateOnly, todayLocalDateOnly } from "../lib/date";

type HealthStatus = "ready" | "downloading" | "missing" | "not_released" | "unknown";

type NormalizedEpisodeStatus = "completed" | "downloading" | "pending" | "unknown";
type NormalizedTorrentStatus = "completed" | "downloading" | "pending" | "unknown";

type EpisodeStatusItem = {
  episode_id: number;
  season_number: number | null;
  episode_number: number;
  air_date: string | null;
  released: boolean;
  status: NormalizedEpisodeStatus;
  is_missing: boolean;
  is_latest_released: boolean;
  file_path: string | null;
  torrent_hash: string | null;
};

type SubscriptionDownloadStatusSummary = {
  subscription_id: number;
  title: string;
  media_type: Subscription["media_type"];
  subscription_status: string;
  health_status: HealthStatus;
  latest_released_episode_number: number | null;
  latest_completed_episode_number: number | null;
  missing_released_episode_count: number;
  downloading_episode_count: number;
  pending_released_episode_count: number;
  completed_episode_count: number;
  total_episode_count: number;
  last_updated_at: string | null;
};

type SubscriptionDownloadStatusDetail = SubscriptionDownloadStatusSummary & {
  episodes?: EpisodeStatusItem[];
};

const COMPLETED_EPISODE_STATUSES = new Set(["completed", "downloaded", "moved"]);
const COMPLETED_TORRENT_STATUSES = new Set(["completed", "downloaded", "moved"]);

const server = new Server(
  { name: "nas-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

const ready = server.connect(transport);

const text = (payload: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
});

function parseIntegerArg(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

function parsePageArg(value: unknown, fallback: number): number | null {
  if (value == null) return fallback;
  const parsed = parseIntegerArg(value);
  if (parsed == null || parsed < 1) return null;
  return parsed;
}

function parseLimitArg(value: unknown, fallback: number): number | null {
  if (value == null) return fallback;
  const parsed = parseIntegerArg(value);
  if (parsed == null || parsed < 1) return null;
  return parsed;
}

function parseOffsetArg(value: unknown, fallback: number): number | null {
  if (value == null) return fallback;
  const parsed = parseIntegerArg(value);
  if (parsed == null || parsed < 0) return null;
  return parsed;
}

function normalizeEpisodeStatus(status: string | null | undefined): NormalizedEpisodeStatus {
  if (!status) return "unknown";
  if (COMPLETED_EPISODE_STATUSES.has(status)) return "completed";
  if (status === "downloading") return "downloading";
  if (status === "pending") return "pending";
  return "unknown";
}

function normalizeTorrentStatus(status: string | null | undefined): NormalizedTorrentStatus {
  if (!status) return "unknown";
  if (COMPLETED_TORRENT_STATUSES.has(status)) return "completed";
  if (status === "downloading") return "downloading";
  if (status === "pending") return "pending";
  return "unknown";
}

function compareEpisodes(left: Episode, right: Episode): number {
  const leftSeason = left.season_number ?? 0;
  const rightSeason = right.season_number ?? 0;
  if (leftSeason !== rightSeason) return leftSeason - rightSeason;
  return left.episode_number - right.episode_number;
}

function isReleasedDate(airDate: string | null | undefined, today: string): boolean {
  if (!airDate) return false;
  return isOnOrBeforeDateOnly(airDate, today) === true;
}

function maxUpdatedAt(values: Array<string | null | undefined>): string | null {
  const nonEmpty = values.filter((v): v is string => Boolean(v));
  if (nonEmpty.length === 0) return null;
  nonEmpty.sort();
  return nonEmpty[nonEmpty.length - 1];
}

function buildTvAnimeDownloadStatus(
  subscription: Subscription,
  options: { includeEpisodes: boolean; releasedOnly: boolean }
): SubscriptionDownloadStatusDetail {
  const today = todayLocalDateOnly();
  const episodes = getEpisodesBySubscription(subscription.id);
  const sorted = [...episodes].sort(compareEpisodes);

  const releasedEpisodes = sorted.filter((ep) => isReleasedDate(ep.air_date, today));
  const completedEpisodes = sorted.filter(
    (ep) => normalizeEpisodeStatus(ep.status) === "completed"
  );
  const completedReleasedEpisodes = releasedEpisodes.filter(
    (ep) => normalizeEpisodeStatus(ep.status) === "completed"
  );
  const downloadingReleasedEpisodes = releasedEpisodes.filter(
    (ep) => normalizeEpisodeStatus(ep.status) === "downloading"
  );
  const pendingReleasedEpisodes = releasedEpisodes.filter(
    (ep) => normalizeEpisodeStatus(ep.status) === "pending"
  );
  const missingReleasedEpisodes = releasedEpisodes.filter(
    (ep) => normalizeEpisodeStatus(ep.status) !== "completed"
  );

  const latestReleased = releasedEpisodes[releasedEpisodes.length - 1] ?? null;
  const latestCompletedReleased =
    completedReleasedEpisodes[completedReleasedEpisodes.length - 1] ?? null;

  let healthStatus: HealthStatus;
  if (releasedEpisodes.length === 0) {
    healthStatus = sorted.length === 0 ? "unknown" : "not_released";
  } else if (latestReleased && normalizeEpisodeStatus(latestReleased.status) === "completed") {
    healthStatus = "ready";
  } else if (downloadingReleasedEpisodes.length > 0) {
    healthStatus = "downloading";
  } else {
    healthStatus = "missing";
  }

  const response: SubscriptionDownloadStatusDetail = {
    subscription_id: subscription.id,
    title: subscription.title,
    media_type: subscription.media_type,
    subscription_status: subscription.status,
    health_status: healthStatus,
    latest_released_episode_number: latestReleased?.episode_number ?? null,
    latest_completed_episode_number: latestCompletedReleased?.episode_number ?? null,
    missing_released_episode_count: missingReleasedEpisodes.length,
    downloading_episode_count: downloadingReleasedEpisodes.length,
    pending_released_episode_count: pendingReleasedEpisodes.length,
    completed_episode_count: completedEpisodes.length,
    total_episode_count: sorted.length,
    last_updated_at: maxUpdatedAt([
      subscription.updated_at,
      ...sorted.map((ep) => ep.updated_at),
    ]),
  };

  if (options.includeEpisodes) {
    const latestReleasedId = latestReleased?.id ?? null;
    const sourceEpisodes = options.releasedOnly ? releasedEpisodes : sorted;
    response.episodes = sourceEpisodes.map((ep) => {
      const normalizedStatus = normalizeEpisodeStatus(ep.status);
      const released = isReleasedDate(ep.air_date, today);
      return {
        episode_id: ep.id,
        season_number: ep.season_number,
        episode_number: ep.episode_number,
        air_date: ep.air_date,
        released,
        status: normalizedStatus,
        is_missing: released && normalizedStatus !== "completed",
        is_latest_released: latestReleasedId != null && ep.id === latestReleasedId,
        file_path: ep.file_path,
        torrent_hash: ep.torrent_hash,
      };
    });
  }

  return response;
}

function buildMovieDownloadStatus(subscription: Subscription): SubscriptionDownloadStatusDetail {
  const today = todayLocalDateOnly();
  const latestTorrent = getTorrentsBySubscription(subscription.id)[0] ?? null;
  const latestTorrentStatus = normalizeTorrentStatus(latestTorrent?.status ?? null);
  const releaseKnown = subscription.first_air_date
    ? isOnOrBeforeDateOnly(subscription.first_air_date, today)
    : null;

  let healthStatus: HealthStatus;
  if (subscription.status === "completed" || latestTorrentStatus === "completed") {
    healthStatus = "ready";
  } else if (
    subscription.status === "downloading" ||
    latestTorrentStatus === "downloading"
  ) {
    healthStatus = "downloading";
  } else if (releaseKnown === true) {
    healthStatus = "missing";
  } else if (releaseKnown === false) {
    healthStatus = "not_released";
  } else {
    healthStatus = "unknown";
  }

  return {
    subscription_id: subscription.id,
    title: subscription.title,
    media_type: subscription.media_type,
    subscription_status: subscription.status,
    health_status: healthStatus,
    latest_released_episode_number: null,
    latest_completed_episode_number: null,
    missing_released_episode_count: 0,
    downloading_episode_count: 0,
    pending_released_episode_count: 0,
    completed_episode_count: 0,
    total_episode_count: 0,
    last_updated_at: maxUpdatedAt([
      subscription.updated_at,
      latestTorrent?.updated_at,
    ]),
  };
}

function buildSubscriptionDownloadStatus(
  subscription: Subscription,
  options: { includeEpisodes: boolean; releasedOnly: boolean }
): SubscriptionDownloadStatusDetail {
  if (subscription.media_type === "movie") {
    return buildMovieDownloadStatus(subscription);
  }
  return buildTvAnimeDownloadStatus(subscription, options);
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_subscriptions",
      description: "List subscriptions, optionally filtering by status.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "active", "disabled"],
            description: "Filter by subscription status.",
          },
        },
      },
    },
    {
      name: "get_subscription",
      description:
        "Get a subscription by id, with optional episodes/torrents.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          include_episodes: { type: "boolean", default: true },
          include_torrents: { type: "boolean", default: false },
        },
        required: ["id"],
      },
    },
    {
      name: "create_subscription",
      description: "Create a subscription (may call TMDB/BGM).",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", enum: ["tvdb", "bgm"] },
          source_id: { type: "number" },
          tmdb_id: { type: "number" },
          media_type: { type: "string", enum: ["anime", "tv", "movie"] },
          season_number: { type: "number" },
          profile_id: { type: "number" },
        },
        required: ["media_type"],
      },
    },
    {
      name: "update_subscription_status",
      description: "Enable or disable a subscription.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          status: { type: "string", enum: ["active", "disabled"] },
        },
        required: ["id", "status"],
      },
    },
    {
      name: "delete_subscription",
      description:
        "Delete a subscription, optionally deleting files on disk.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          delete_files_on_disk: { type: "boolean", default: false },
        },
        required: ["id"],
      },
    },
    {
      name: "search_media",
      description: "Search TV/anime/movie items from TVDB(TMDB) or BGM.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search text." },
          source: { type: "string", enum: ["tvdb", "bgm"], default: "tvdb" },
          type: {
            type: "string",
            enum: ["tv", "movie", "multi"],
            default: "multi",
            description: "TVDB search type. Ignored for BGM.",
          },
          page: { type: "number", default: 1 },
        },
        required: ["query"],
      },
    },
    {
      name: "get_media_detail",
      description: "Get media detail from TVDB(TMDB) or BGM by id.",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", enum: ["tvdb", "bgm"] },
          id: { type: "number" },
          media_type: { type: "string", enum: ["tv", "movie"] },
          season_number: {
            type: "number",
            description: "Optional TV season number for TVDB TV detail.",
          },
        },
        required: ["source", "id", "media_type"],
      },
    },
    {
      name: "list_subscription_download_status",
      description: "List subscription download health summary.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "active", "disabled"],
            default: "all",
          },
          media_type: {
            type: "string",
            enum: ["all", "anime", "tv", "movie"],
            default: "all",
          },
          limit: { type: "number", default: 50 },
          offset: { type: "number", default: 0 },
        },
      },
    },
    {
      name: "get_subscription_download_status",
      description:
        "Get detailed download health for one subscription, including episode state.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          include_episodes: { type: "boolean", default: true },
          released_only: { type: "boolean", default: true },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_subscriptions": {
      const status = typeof args?.status === "string" ? args.status : "all";
      const subs =
        status === "active" ? getActiveSubscriptions() : getAllSubscriptions();
      if (status === "disabled") {
        return text(subs.filter((sub) => sub.status === "disabled"));
      }
      return text(subs);
    }

    case "get_subscription": {
      const id = Number(args?.id);
      if (!Number.isFinite(id)) {
        return text({ error: "Missing or invalid id" });
      }
      const sub = getSubscriptionById(id);
      if (!sub) {
        return text({ error: "Subscription not found" });
      }
      const includeEpisodes = args?.include_episodes !== false;
      const includeTorrents = args?.include_torrents === true;
      const episodes = includeEpisodes ? getEpisodesBySubscription(id) : [];
      const torrents = includeTorrents ? getTorrentsBySubscription(id) : [];
      return text({
        ...sub,
        episodes: includeEpisodes ? episodes : undefined,
        torrents: includeTorrents ? torrents : undefined,
      });
    }

    case "create_subscription": {
      const mediaType = args?.media_type;
      if (mediaType !== "anime" && mediaType !== "tv" && mediaType !== "movie") {
        return text({ error: "Missing or invalid media_type" });
      }
      const result = await createSubscriptionWithEpisodes({
        source: args?.source,
        source_id: args?.source_id,
        tmdb_id: args?.tmdb_id,
        media_type: mediaType,
        season_number: args?.season_number,
        profile_id: args?.profile_id,
      });
      if (!result.ok) {
        return text({
          error: result.error,
          ...(result.details || {}),
          status: result.status,
        });
      }
      return text(result.data);
    }

    case "update_subscription_status": {
      const id = Number(args?.id);
      const status = args?.status;
      if (!Number.isFinite(id)) {
        return text({ error: "Missing or invalid id" });
      }
      if (status !== "active" && status !== "disabled") {
        return text({ error: "Invalid status" });
      }
      const sub = getSubscriptionById(id);
      if (!sub) {
        return text({ error: "Subscription not found" });
      }
      updateSubscription(id, { status });
      return text({ success: true });
    }

    case "delete_subscription": {
      const id = Number(args?.id);
      if (!Number.isFinite(id)) {
        return text({ error: "Missing or invalid id" });
      }
      const sub = getSubscriptionById(id);
      if (!sub) {
        return text({ error: "Subscription not found" });
      }
      const deleteFilesOnDisk = Boolean(args?.delete_files_on_disk);
      const result = await deleteSubscriptionWithCleanup(sub, {
        deleteFilesOnDisk,
      });
      if (!result.ok) {
        return text({ error: result.error, status: result.status });
      }
      return text(result.data);
    }

    case "search_media": {
      const query = typeof args?.query === "string" ? args.query.trim() : "";
      if (!query) {
        return text({ error: "Missing or invalid query" });
      }

      const source = typeof args?.source === "string" ? args.source : "tvdb";
      if (source !== "tvdb" && source !== "bgm") {
        return text({ error: "Invalid source" });
      }

      const page = parsePageArg(args?.page, 1);
      if (page == null) {
        return text({ error: "Invalid page" });
      }

      try {
        if (source === "bgm") {
          const limit = 20;
          const offset = (page - 1) * limit;
          const bgmRes = await bgm.searchSubjects(query, {
            limit,
            offset,
            types: [2, 6],
          });
          const totalPages =
            bgmRes.limit > 0 ? Math.ceil(bgmRes.total / bgmRes.limit) : 1;
          return text({
            page,
            results: bgmRes.data.map((item) => ({
              id: item.id,
              title: item.name_cn || item.name,
              name: item.name_cn || item.name,
              original_name: item.name,
              overview: item.summary || "",
              poster_path: item.images?.medium ?? item.images?.small ?? null,
              backdrop_path: item.images?.large ?? null,
              first_air_date: item.date ?? null,
              vote_average: item.rating?.score ?? 0,
              media_type: "tv",
              source: "bgm",
            })),
            total_pages: totalPages,
            total_results: bgmRes.total,
          });
        }

        const type = typeof args?.type === "string" ? args.type : "multi";
        if (type !== "tv" && type !== "movie" && type !== "multi") {
          return text({ error: "Invalid type" });
        }

        let results;
        switch (type) {
          case "tv":
            results = await tmdb.searchTV(query, page);
            break;
          case "movie":
            results = await tmdb.searchMovie(query, page);
            break;
          default:
            results = await tmdb.searchMulti(query, page);
            break;
        }

        const normalizedResults = results.results
          .map((item: any) => {
            const mediaType =
              item.media_type ?? (type === "tv" ? "tv" : type === "movie" ? "movie" : null);
            if (mediaType !== "tv" && mediaType !== "movie") {
              return null;
            }
            return {
              ...item,
              media_type: mediaType,
              source: "tvdb",
            };
          })
          .filter((item: any) => item != null);

        return text({
          ...results,
          results: normalizedResults,
        });
      } catch (error: any) {
        return text({ error: error?.message || "Search failed" });
      }
    }

    case "get_media_detail": {
      const source = typeof args?.source === "string" ? args.source : null;
      if (source !== "tvdb" && source !== "bgm") {
        return text({ error: "Invalid source" });
      }

      const id = parseIntegerArg(args?.id);
      if (id == null || id < 1) {
        return text({ error: "Missing or invalid id" });
      }

      const mediaType = typeof args?.media_type === "string" ? args.media_type : null;
      if (mediaType !== "tv" && mediaType !== "movie") {
        return text({ error: "Missing or invalid media_type" });
      }

      const seasonNumberValue = args?.season_number;
      const seasonNumber =
        seasonNumberValue == null ? null : parseIntegerArg(seasonNumberValue);
      if (seasonNumberValue != null && (seasonNumber == null || seasonNumber < 0)) {
        return text({ error: "Invalid season_number" });
      }

      if (source === "bgm" && mediaType === "movie") {
        return text({ error: "Invalid source/media_type combination" });
      }

      try {
        if (source === "bgm") {
          const detail = await bgm.getSubjectDetail(id);
          return text({
            ...detail,
            source,
            media_type: "tv",
            id: detail.id,
          });
        }

        if (mediaType === "movie") {
          const detail = await tmdb.getMovieDetail(id);
          return text({
            ...detail,
            source,
            media_type: "movie",
            id,
          });
        }

        if (seasonNumber != null) {
          const detail = await tmdb.getSeasonDetail(id, seasonNumber);
          return text({
            ...detail,
            source,
            media_type: "tv",
            id,
            season_number: seasonNumber,
          });
        }

        const detail = await tmdb.getTVDetail(id);
        return text({
          ...detail,
          source,
          media_type: "tv",
          id,
        });
      } catch (error: any) {
        return text({ error: error?.message || "Failed to get media detail" });
      }
    }

    case "list_subscription_download_status": {
      const status = typeof args?.status === "string" ? args.status : "all";
      if (status !== "all" && status !== "active" && status !== "disabled") {
        return text({ error: "Invalid status" });
      }

      const mediaType = typeof args?.media_type === "string" ? args.media_type : "all";
      if (
        mediaType !== "all" &&
        mediaType !== "anime" &&
        mediaType !== "tv" &&
        mediaType !== "movie"
      ) {
        return text({ error: "Invalid media_type" });
      }

      const limit = parseLimitArg(args?.limit, 50);
      if (limit == null) {
        return text({ error: "Invalid limit" });
      }

      const offset = parseOffsetArg(args?.offset, 0);
      if (offset == null) {
        return text({ error: "Invalid offset" });
      }

      let subscriptions =
        status === "active" ? getActiveSubscriptions() : getAllSubscriptions();
      if (status === "disabled") {
        subscriptions = subscriptions.filter((sub) => sub.status === "disabled");
      }
      if (mediaType !== "all") {
        subscriptions = subscriptions.filter((sub) => sub.media_type === mediaType);
      }

      const items = subscriptions.map((sub) =>
        buildSubscriptionDownloadStatus(sub, {
          includeEpisodes: false,
          releasedOnly: true,
        })
      );

      return text({
        total: items.length,
        limit,
        offset,
        items: items.slice(offset, offset + limit),
      });
    }

    case "get_subscription_download_status": {
      const id = parseIntegerArg(args?.id);
      if (id == null || id < 1) {
        return text({ error: "Missing or invalid id" });
      }
      const sub = getSubscriptionById(id);
      if (!sub) {
        return text({ error: "Subscription not found" });
      }

      const includeEpisodes = args?.include_episodes !== false;
      const releasedOnly = args?.released_only !== false;
      const detail = buildSubscriptionDownloadStatus(sub, {
        includeEpisodes: includeEpisodes,
        releasedOnly,
      });
      return text(detail);
    }

    default:
      return text({ error: `Unknown tool: ${name}` });
  }
});

export function registerMcpRoutes(app: Hono) {
  app.all("/mcp", async (c) => {
    await ready;
    return transport.handleRequest(c.req.raw);
  });
}
