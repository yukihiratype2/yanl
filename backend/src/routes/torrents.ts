import { Context, Hono } from "hono";
import { searchTorrents } from "../services/rss";
import { qbittorrent } from "../services/qbittorrent";
import { downloadTorrent } from "../usecases/torrents";

const torrentRoutes = new Hono();

type JsonRecord = Record<string, unknown>;

async function readJsonBody(c: Context): Promise<JsonRecord | Response> {
  try {
    const body = await c.req.json<unknown>();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    return body as JsonRecord;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

// Search torrents via RSS
torrentRoutes.get("/search", async (c) => {
  const keyword = c.req.query("q");
  const episode = c.req.query("episode");
  const season = c.req.query("season");
  if (!keyword) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  try {
    const results = await searchTorrents(keyword, { season, episode });
    return c.json(results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Download a torrent (add to qBittorrent)
torrentRoutes.post("/download", async (c) => {
  const bodyOrResponse = await readJsonBody(c);
  if (bodyOrResponse instanceof Response) {
    return bodyOrResponse;
  }

  const subscriptionId = bodyOrResponse.subscription_id;
  const episodeId = bodyOrResponse.episode_id;
  const title = bodyOrResponse.title;
  const link = bodyOrResponse.link;
  const source = bodyOrResponse.source;

  const validEpisodeId =
    episodeId === undefined ||
    episodeId === null ||
    (Number.isInteger(episodeId) && Number(episodeId) > 0);
  if (
    !Number.isInteger(subscriptionId) ||
    Number(subscriptionId) <= 0 ||
    !validEpisodeId ||
    !isNonEmptyString(title) ||
    !isNonEmptyString(link) ||
    !isNonEmptyString(source)
  ) {
    return c.json({ error: "Invalid download payload" }, 400);
  }

  const result = await downloadTorrent({
    subscription_id: Number(subscriptionId),
    episode_id:
      episodeId === undefined || episodeId === null ? undefined : Number(episodeId),
    title: title.trim(),
    link: link.trim(),
    source: source.trim(),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, 201);
});

// Pause torrents
torrentRoutes.post("/pause", async (c) => {
  const bodyOrResponse = await readJsonBody(c);
  if (bodyOrResponse instanceof Response) {
    return bodyOrResponse;
  }
  if (!isNonEmptyStringArray(bodyOrResponse.hashes)) {
    return c.json({ error: "Missing hashes" }, 400);
  }
  try {
    const success = await qbittorrent.pauseTorrents(bodyOrResponse.hashes);
    return c.json({ success });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Resume torrents
torrentRoutes.post("/resume", async (c) => {
  const bodyOrResponse = await readJsonBody(c);
  if (bodyOrResponse instanceof Response) {
    return bodyOrResponse;
  }
  if (!isNonEmptyStringArray(bodyOrResponse.hashes)) {
    return c.json({ error: "Missing hashes" }, 400);
  }
  try {
    const success = await qbittorrent.resumeTorrents(bodyOrResponse.hashes);
    return c.json({ success });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete torrents
torrentRoutes.post("/delete", async (c) => {
  const bodyOrResponse = await readJsonBody(c);
  if (bodyOrResponse instanceof Response) {
    return bodyOrResponse;
  }
  if (!isNonEmptyStringArray(bodyOrResponse.hashes)) {
    return c.json({ error: "Missing hashes" }, 400);
  }
  if (
    bodyOrResponse.deleteFiles !== undefined &&
    typeof bodyOrResponse.deleteFiles !== "boolean"
  ) {
    return c.json({ error: "Invalid deleteFiles value" }, 400);
  }
  try {
    const success = await qbittorrent.deleteTorrents(
      bodyOrResponse.hashes,
      bodyOrResponse.deleteFiles || false
    );
    return c.json({ success });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default torrentRoutes;
