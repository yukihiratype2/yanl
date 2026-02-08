import { Hono } from "hono";
import {
  getAllSubscriptions,
  getActiveSubscriptions,
  getSubscriptionById,
  getSubscriptionBySourceId,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getEpisodesBySubscription,
  createEpisode,
  getTorrentsBySubscription,
  getDefaultProfile,
  getProfileById,
} from "../db/models";
import { getTVDetail, getMovieDetail, getSeasonDetail } from "../services/tmdb";
import { getAllEpisodes, getSubjectDetail } from "../services/bgm";
import { createMediaFolder, deleteMediaFolder } from "../services/fileManager";

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

  const source = body.source ?? "tvdb";
  const rawSourceId = body.source_id ?? body.tmdb_id;
  const sourceId = rawSourceId != null ? Number(rawSourceId) : null;
  const { media_type, season_number } = body;
  let profileId: number | null =
    body.profile_id !== undefined ? body.profile_id : null;

  if (!sourceId || Number.isNaN(sourceId)) {
    return c.json({ error: "Missing source_id" }, 400);
  }
  if (source !== "tvdb" && source !== "bgm") {
    return c.json({ error: "Invalid source" }, 400);
  }

  if (profileId != null) {
    const profile = getProfileById(profileId);
    if (!profile) {
      return c.json({ error: "Profile not found" }, 400);
    }
  } else {
    const defaultProfile = getDefaultProfile();
    profileId = defaultProfile ? defaultProfile.id : null;
  }

  // Check if already subscribed
  const existing = getSubscriptionBySourceId(
    source,
    sourceId,
    media_type,
    season_number
  );
  if (existing) {
    return c.json({ error: "Already subscribed", subscription: existing }, 409);
  }

  try {
    let title: string;
    let titleOriginal: string | null = null;
    let overview: string | null = null;
    let posterPath: string | null = null;
    let backdropPath: string | null = null;
    let firstAirDate: string | null = null;
    let voteAverage: number | null = null;
    let totalEpisodes: number | null = null;
    let seasonNum: number | null = season_number ?? null;

    if (source === "bgm") {
      const detail = await getSubjectDetail(sourceId);
      title = detail.name_cn || detail.name;
      titleOriginal = detail.name || detail.name_cn || null;
      overview = detail.summary || null;
      posterPath = detail.images?.medium ?? detail.images?.small ?? null;
      backdropPath = detail.images?.large ?? null;
      firstAirDate = detail.date ?? null;
      voteAverage = detail.rating?.score ?? null;
      totalEpisodes = detail.total_episodes ?? detail.eps ?? null;
    } else if (media_type === "movie") {
      const detail = await getMovieDetail(sourceId);
      title = detail.title;
      titleOriginal = detail.original_title;
      overview = detail.overview;
      posterPath = detail.poster_path;
      backdropPath = detail.backdrop_path;
      firstAirDate = detail.release_date;
      voteAverage = detail.vote_average;
    } else {
      const detail = await getTVDetail(sourceId);
      title = detail.name;
      titleOriginal = detail.original_name;
      overview = detail.overview;
      posterPath = detail.poster_path;
      backdropPath = detail.backdrop_path;
      firstAirDate = detail.first_air_date;
      voteAverage = detail.vote_average;

      if (seasonNum != null) {
        const season = detail.seasons.find(
          (s) => s.season_number === seasonNum
        );
        totalEpisodes = season?.episode_count ?? null;
      }
    }

    // Create media folder
    const folderPath = createMediaFolder(media_type, title, seasonNum);

    const sub = createSubscription({
      source,
      source_id: sourceId,
      media_type,
      title,
      title_original: titleOriginal,
      overview,
      poster_path: posterPath,
      backdrop_path: backdropPath,
      first_air_date: firstAirDate,
      vote_average: voteAverage,
      season_number: seasonNum,
      total_episodes: totalEpisodes,
      status: "active",
      folder_path: folderPath,
      profile_id: profileId,
    });

    // Fetch and create episodes for TV/anime
    if (media_type !== "movie") {
      if (source === "tvdb" && seasonNum != null) {
        try {
          const seasonDetail = await getSeasonDetail(sourceId, seasonNum);
          for (const ep of seasonDetail.episodes) {
            createEpisode({
              subscription_id: sub.id,
              season_number: seasonNum,
              episode_number: ep.episode_number,
              title: ep.name,
              air_date: ep.air_date,
              overview: ep.overview,
              still_path: ep.still_path,
              status: "pending",
              torrent_hash: null,
              file_path: null,
            });
          }
        } catch (err) {
          console.error("Failed to fetch episodes:", err);
        }
      }

      if (source === "bgm") {
        try {
          const episodes = await getAllEpisodes(sourceId, { type: 0 });
          for (const ep of episodes) {
            const numberRaw = ep.ep ?? ep.sort;
            const episodeNumber = Number(numberRaw);
            if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) continue;
            const titleText = ep.name_cn || ep.name || null;
            const airDate = ep.airdate && ep.airdate.trim().length > 0 ? ep.airdate : null;
            createEpisode({
              subscription_id: sub.id,
              season_number: null,
              episode_number: episodeNumber,
              title: titleText,
              air_date: airDate,
              overview: ep.desc || null,
              still_path: null,
              status: "pending",
              torrent_hash: null,
              file_path: null,
            });
          }
        } catch (err) {
          console.error("Failed to fetch BGM episodes:", err);
        }
      }
    }

    return c.json(sub, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update subscription
subscriptionRoutes.patch("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const sub = getSubscriptionById(id);
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

  const body = await c.req.json<Partial<{ status: string }>>();
  updateSubscription(id, body);
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

  if (deleteFilesOnDisk && sub.folder_path) {
    deleteMediaFolder(sub.media_type, sub.folder_path);
  }
  deleteSubscription(id);
  return c.json({ success: true });
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
