import { Hono } from "hono";
import { searchTorrents } from "../services/rss";
import {
  pauseTorrents,
  resumeTorrents,
  deleteTorrents,
} from "../services/qbittorrent";
import { downloadTorrent } from "../usecases/torrents";

const torrentRoutes = new Hono();

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
  const body = await c.req.json<{
    subscription_id: number;
    episode_id?: number;
    title: string;
    link: string;
    source: string;
  }>();
  const result = await downloadTorrent(body);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data, 201);
});

// Pause torrents
torrentRoutes.post("/pause", async (c) => {
  const body = await c.req.json<{ hashes: string[] }>();
  if (!body.hashes || body.hashes.length === 0) {
    return c.json({ error: "Missing hashes" }, 400);
  }
  try {
    const success = await pauseTorrents(body.hashes);
    return c.json({ success });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Resume torrents
torrentRoutes.post("/resume", async (c) => {
  const body = await c.req.json<{ hashes: string[] }>();
  if (!body.hashes || body.hashes.length === 0) {
    return c.json({ error: "Missing hashes" }, 400);
  }
  try {
    const success = await resumeTorrents(body.hashes);
    return c.json({ success });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete torrents
torrentRoutes.post("/delete", async (c) => {
  const body = await c.req.json<{ hashes: string[]; deleteFiles?: boolean }>();
  if (!body.hashes || body.hashes.length === 0) {
    return c.json({ error: "Missing hashes" }, 400);
  }
  try {
    const success = await deleteTorrents(body.hashes, body.deleteFiles || false);
    return c.json({ success });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default torrentRoutes;
