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
} from "../db/models";
import {
  createSubscriptionWithEpisodes,
  deleteSubscriptionWithCleanup,
} from "../actions/subscriptions";
import * as bgm from "../services/bgm";
import * as tmdb from "../services/tmdb";

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

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_media",
      description: "Search TMDB or Bangumi media.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          type: { type: "string", enum: ["tv", "movie", "multi"] },
          source: { type: "string", enum: ["tvdb", "bgm"] },
          page: { type: "number", minimum: 1 },
        },
        required: ["query"],
      },
    },
    {
      name: "get_tv_detail",
      description: "Get TMDB TV show detail.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_movie_detail",
      description: "Get TMDB movie detail.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_tv_season_detail",
      description: "Get TMDB TV season detail.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          season: { type: "number" },
        },
        required: ["id", "season"],
      },
    },
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_media": {
      const query = typeof args?.query === "string" ? args.query.trim() : "";
      if (!query) {
        return text({ error: "Missing or invalid query" });
      }
      const type = typeof args?.type === "string" ? args.type : "multi";
      if (type !== "tv" && type !== "movie" && type !== "multi") {
        return text({ error: "Invalid type" });
      }
      const source = typeof args?.source === "string" ? args.source : "tvdb";
      if (source !== "tvdb" && source !== "bgm") {
        return text({ error: "Invalid source" });
      }
      const page = args?.page === undefined ? 1 : parsePositiveInt(args.page);
      if (page === null) {
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
        return text({
          ...results,
          results: results.results.map((item) => ({
            ...item,
            media_type: item.media_type ?? (type === "multi" ? undefined : type),
            source: "tvdb",
          })),
        });
      } catch (error: any) {
        return text({ error: error.message });
      }
    }

    case "get_tv_detail": {
      const id = parsePositiveInt(args?.id);
      if (id === null) {
        return text({ error: "Missing or invalid id" });
      }
      try {
        const detail = await tmdb.getTVDetail(id);
        return text({ ...detail, source: "tvdb", media_type: "tv" });
      } catch (error: any) {
        return text({ error: error.message });
      }
    }

    case "get_movie_detail": {
      const id = parsePositiveInt(args?.id);
      if (id === null) {
        return text({ error: "Missing or invalid id" });
      }
      try {
        const detail = await tmdb.getMovieDetail(id);
        return text({ ...detail, source: "tvdb", media_type: "movie" });
      } catch (error: any) {
        return text({ error: error.message });
      }
    }

    case "get_tv_season_detail": {
      const id = parsePositiveInt(args?.id);
      const season = parsePositiveInt(args?.season);
      if (id === null) {
        return text({ error: "Missing or invalid id" });
      }
      if (season === null) {
        return text({ error: "Missing or invalid season" });
      }
      try {
        const detail = await tmdb.getSeasonDetail(id, season);
        return text({
          ...detail,
          tv_id: id,
          source: "tvdb",
          media_type: "tv",
        });
      } catch (error: any) {
        return text({ error: error.message });
      }
    }

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
