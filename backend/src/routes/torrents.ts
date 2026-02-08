import { Hono } from "hono";
import { searchTorrents } from "../services/rss";
import {
  addTorrentByUrl,
  getQbitDownloadDir,
  pauseTorrents,
  resumeTorrents,
  deleteTorrents,
} from "../services/qbittorrent";
import {
  createTorrent,
  getSubscriptionById,
  updateEpisode,
  getTorrentByEpisodeId,
  getTorrentByHash,
  getTorrentByLink,
} from "../db/models";
import { parseMagnetHash } from "../services/monitor/utils";

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

  const sub = getSubscriptionById(body.subscription_id);
  if (!sub) {
    return c.json({ error: "Subscription not found" }, 404);
  }

  try {
    const hash = parseMagnetHash(body.link);
    if ((hash && getTorrentByHash(hash)) || getTorrentByLink(body.link)) {
      return c.json({ error: "Torrent already added" }, 409);
    }
    if (body.episode_id && getTorrentByEpisodeId(body.episode_id)) {
      return c.json({ error: "Episode already has a torrent" }, 409);
    }

    const savepath = getQbitDownloadDir(sub.media_type);
    const success = await addTorrentByUrl(body.link, {
      savepath,
      category: sub.media_type,
    });
    if (!success) {
      return c.json({ error: "Failed to add torrent to qBittorrent" }, 500);
    }

    if (body.episode_id) {
      updateEpisode(body.episode_id, { status: "downloading", torrent_hash: hash });
    }

    const torrent = createTorrent({
      subscription_id: body.subscription_id,
      episode_id: body.episode_id || null,
      title: body.title,
      link: body.link,
      hash,
      size: null,
      source: body.source,
      status: "downloading",
      download_path: sub.folder_path,
    });

    return c.json(torrent, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
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
