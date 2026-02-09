import {
  getActiveSubscriptions,
  getEpisodesBySubscription,
  updateEpisode,
  updateSubscription,
  createTorrent,
  getProfileById,
  getTorrentByEpisodeId,
  getTorrentByHash,
  getTorrentByLink,
  getTorrentsBySubscription,
  Profile,
  Subscription,
  Episode,
} from "../../db/models";
import * as rss from "../rss";
import { qbittorrent } from "../qbittorrent";
import { logger } from "../logger";
import { getTodayDateOnly, parseMagnetHash } from "./utils";
import { isTitleMatch, matchesEpisodeSeason, matchesProfile } from "./matchers";
import { isOnOrBeforeDateOnly } from "../../lib/date";

export async function searchAndDownload() {
  const subscriptions = getActiveSubscriptions();
  const today = getTodayDateOnly();
  const invalidAirDateWarnings = new Set<string>();

  for (const sub of subscriptions) {
    if (sub.media_type === "tv" || sub.media_type === "anime") {
      await searchEpisodesForSubscription(sub, today, invalidAirDateWarnings);
      continue;
    }

    if (sub.media_type === "movie" && sub.status === "active") {
      await searchMovieForSubscription(sub);
    }
  }
}

function getPendingEpisodes(
  episodes: Episode[],
  sub: Subscription,
  today: string,
  invalidAirDateWarnings: Set<string>
): Episode[] {
  return episodes.filter((e) => {
    if (e.status !== "pending") return false;
    if (!e.air_date) return true;

    const isReleased = isOnOrBeforeDateOnly(e.air_date, today);
    if (isReleased === null) {
      const key = `${sub.id}:${e.air_date}`;
      if (!invalidAirDateWarnings.has(key)) {
        invalidAirDateWarnings.add(key);
        logger.warn(
          {
            subscriptionId: sub.id,
            subscription: sub.title,
            episodeId: e.id,
            episode: e.episode_number,
            air_date: e.air_date,
          },
          "Skipping pending episode with unparseable air_date"
        );
      }
      return false;
    }
    return isReleased;
  });
}

async function searchEpisodesForSubscription(
  sub: Subscription,
  today: string,
  invalidAirDateWarnings: Set<string>
) {
  const episodes = getEpisodesBySubscription(sub.id);
  const pendingEps = getPendingEpisodes(
    episodes,
    sub,
    today,
    invalidAirDateWarnings
  );
  if (pendingEps.length === 0) return;

  const profile = getProfileForSubscription(sub);

  for (const ep of pendingEps) {
    await tryDownloadEpisode(sub, ep, profile);
  }
}

async function tryDownloadEpisode(
  sub: Subscription,
  ep: Episode,
  profile: Profile | null
): Promise<boolean> {
  if (getTorrentByEpisodeId(ep.id)) {
    logger.info(
      { subscription: sub.title, episode: ep.episode_number },
      "Episode already has a torrent record"
    );
    return true;
  }

  const searchResults = await rss.searchTorrents(sub.title, {
    season: sub.season_number,
    episode: ep.episode_number,
  });

  for (const item of searchResults) {
    const hash = parseMagnetHash(item.link);
    if ((hash && getTorrentByHash(hash)) || getTorrentByLink(item.link)) {
      logger.info(
        { subscription: sub.title, episode: ep.episode_number, result: item.title },
        "Skipping already grabbed torrent"
      );
      return true;
    }

    const parseResult = item.ai;
    if (!isTitleMatch(sub.title, parseResult)) continue;
    const episodeSeasonMatch = matchesEpisodeSeason(sub, ep, parseResult);
    if (!episodeSeasonMatch.ok) {
      logger.debug(
        {
          subscription: sub.title,
          episode: ep.episode_number,
          result: item.title,
          reason: episodeSeasonMatch.reason,
        },
        "Episode/season filter rejected episode candidate"
      );
      continue;
    }
    const profileMatch = matchesProfile(item, profile);
    if (!profileMatch.ok) {
      logger.debug(
        {
          subscription: sub.title,
          episode: ep.episode_number,
          result: item.title,
          profile: profile?.name ?? null,
          reason: profileMatch.reason,
        },
        "Profile filter rejected episode candidate"
      );
      continue;
    }

    logger.info(
      {
        subscription: sub.title,
        episode: ep.episode_number,
        result: item.title,
      },
      "Found RSS match"
    );

    try {
      await startEpisodeDownload(sub, ep, item);
      return true;
    } catch (err) {
      logger.error({ title: item.title, err }, "Failed to add torrent");
    }
  }

  return false;
}

async function startEpisodeDownload(sub: Subscription, ep: Episode, item: rss.RSSItem) {
  const savepath = qbittorrent.getQbitDownloadDir(sub.media_type);
  await qbittorrent.addTorrentByUrl(item.link, {
    savepath,
    category: sub.media_type,
  });

  const hash = parseMagnetHash(item.link);

  updateEpisode(ep.id, {
    status: "downloading",
    torrent_hash: hash,
  });

  createTorrent({
    subscription_id: sub.id,
    episode_id: ep.id,
    title: item.title,
    link: item.link,
    hash,
    size: item.ai?.size || item.torrent?.contentLength || null,
    source: item.source,
    status: "downloading",
    download_path: null,
  });
}

async function searchMovieForSubscription(sub: Subscription) {
  const existing = getTorrentsBySubscription(sub.id);
  if (existing.some((t) => t.status === "downloading" || t.status === "completed")) {
    logger.info(
      { subscription: sub.title },
      "Skipping movie search due to existing torrent record"
    );
    return;
  }

  const searchResults = await rss.searchTorrents(sub.title);
  const profile = getProfileForSubscription(sub);
  for (const item of searchResults) {
    if (!isTitleMatch(sub.title, item.ai)) continue;
    const hash = parseMagnetHash(item.link);
    if ((hash && getTorrentByHash(hash)) || getTorrentByLink(item.link)) {
      logger.info(
        { subscription: sub.title, title: item.title },
        "Skipping already grabbed movie torrent"
      );
      break;
    }
    const profileMatch = matchesProfile(item, profile);
    if (!profileMatch.ok) {
      logger.debug(
        {
          subscription: sub.title,
          result: item.title,
          profile: profile?.name ?? null,
          reason: profileMatch.reason,
        },
        "Profile filter rejected movie candidate"
      );
      continue;
    }

    logger.info({ subscription: sub.title, title: item.title }, "Found movie match");
    try {
      await startMovieDownload(sub, item);
      break;
    } catch (err) {
      logger.error({ subscription: sub.title, err }, "Movie torrent add error");
    }
  }
}

async function startMovieDownload(sub: Subscription, item: rss.RSSItem) {
  const savepath = qbittorrent.getQbitDownloadDir(sub.media_type);
  await qbittorrent.addTorrentByUrl(item.link, {
    savepath,
    category: sub.media_type,
  });

  const hash = parseMagnetHash(item.link);
  updateSubscription(sub.id, { status: "downloading" });

  createTorrent({
    subscription_id: sub.id,
    episode_id: null,
    title: item.title,
    link: item.link,
    hash,
    size: item.ai?.size || item.torrent?.contentLength || null,
    source: item.source,
    status: "downloading",
    download_path: null,
  });
}

function getProfileForSubscription(sub: Subscription): Profile | null {
  if (sub.profile_id == null) return null;
  return getProfileById(sub.profile_id) ?? null;
}
