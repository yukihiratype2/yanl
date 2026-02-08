import { Hono } from "hono";
import {
  getAllSubscriptions,
  getActiveSubscriptions,
  getSubscriptionById,
  getSubscriptionByTmdbId,
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
import { createMediaFolder } from "../services/fileManager";

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
    tmdb_id: number;
    media_type: "anime" | "tv" | "movie";
    season_number?: number;
    profile_id?: number | null;
  }>();

  const { tmdb_id, media_type, season_number } = body;
  let profileId: number | null =
    body.profile_id !== undefined ? body.profile_id : null;

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
  const existing = getSubscriptionByTmdbId(tmdb_id, media_type, season_number);
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

    if (media_type === "movie") {
      const detail = await getMovieDetail(tmdb_id);
      title = detail.title;
      titleOriginal = detail.original_title;
      overview = detail.overview;
      posterPath = detail.poster_path;
      backdropPath = detail.backdrop_path;
      firstAirDate = detail.release_date;
      voteAverage = detail.vote_average;
    } else {
      const detail = await getTVDetail(tmdb_id);
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
      tmdb_id,
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
    if (media_type !== "movie" && seasonNum != null) {
      try {
        const seasonDetail = await getSeasonDetail(tmdb_id, seasonNum);
        for (const ep of seasonDetail.episodes) {
          createEpisode({
            subscription_id: sub.id,
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
subscriptionRoutes.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const sub = getSubscriptionById(id);
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

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
