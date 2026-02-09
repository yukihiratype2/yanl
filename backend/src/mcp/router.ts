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
