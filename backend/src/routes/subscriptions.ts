import { Hono } from "hono";
import {
  getAllSubscriptions,
  getActiveSubscriptions,
  getSubscriptionById,
  updateSubscription,
  getEpisodesBySubscription,
  getTorrentsBySubscription,
} from "../db/models";
import {
  createSubscriptionWithEpisodes,
  deleteSubscriptionWithCleanup,
} from "../usecases/subscriptions";

const subscriptionRoutes = new Hono();

// List all subscriptions
subscriptionRoutes.get("/", (c) => {
  const status = c.req.query("status");
  const subs =
    status === "active" ? getActiveSubscriptions() : getAllSubscriptions();
  return c.json(subs);
});

// Get subscription detail
subscriptionRoutes.get("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const sub = getSubscriptionById(id);
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

  const episodes = getEpisodesBySubscription(id);
  const torrents = getTorrentsBySubscription(id);
  return c.json({ ...sub, episodes, torrents });
});

// Subscribe to a media
subscriptionRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    source?: "tvdb" | "bgm";
    source_id?: number;
    tmdb_id?: number;
    media_type: "anime" | "tv" | "movie";
    season_number?: number;
    profile_id?: number | null;
  }>();
  const result = await createSubscriptionWithEpisodes(body);
  if (!result.ok) {
    return c.json({ error: result.error, ...(result.details || {}) }, result.status);
  }
  return c.json(result.data, 201);
});

// Update subscription
subscriptionRoutes.patch("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const sub = getSubscriptionById(id);
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

  const body = await c.req.json<{ status?: "active" | "disabled" }>();
  if (!body.status) {
    return c.json({ error: "Missing status" }, 400);
  }
  if (!["active", "disabled"].includes(body.status)) {
    return c.json({ error: "Invalid status" }, 400);
  }
  updateSubscription(id, { status: body.status });
  return c.json({ success: true });
});

// Delete subscription
subscriptionRoutes.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const sub = getSubscriptionById(id);
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

  const parseBool = (value: string | undefined | null) => {
    if (!value) return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  };

  const deleteFilesQuery = parseBool(
    c.req.query("delete_files_on_disk") ?? c.req.query("delete_files")
  );
  const body = await c.req
    .json<{
      delete_files_on_disk?: boolean;
      delete_files?: boolean;
    }>()
    .catch(() => null);
  const deleteFilesBody = Boolean(
    body?.delete_files_on_disk ?? body?.delete_files
  );
  const deleteFilesOnDisk = deleteFilesQuery || deleteFilesBody;

  const result = await deleteSubscriptionWithCleanup(sub, {
    deleteFilesOnDisk,
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data);
});

// Get episodes for subscription
subscriptionRoutes.get("/:id/episodes", (c) => {
  const id = parseInt(c.req.param("id"));
  const sub = getSubscriptionById(id);
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

  const episodes = getEpisodesBySubscription(id);
  return c.json(episodes);
});

export default subscriptionRoutes;
