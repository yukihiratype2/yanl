import {
  getActiveSubscriptions,
  getEpisodesBySubscription,
  updateEpisode,
  updateSubscription,
  createTorrent,
  Subscription,
  Episode,
} from "../../db/models";
import * as rss from "../rss";
import * as qbittorrent from "../qbittorrent";
import { logger } from "../logger";
import { getTodayISO, isTitleMatch, parseMagnetHash } from "./utils";

export async function searchAndDownload() {
  const subscriptions = getActiveSubscriptions();
  const today = getTodayISO();

  for (const sub of subscriptions) {
    if (sub.media_type === "tv" || sub.media_type === "anime") {
      await searchEpisodesForSubscription(sub, today);
      continue;
    }

    if (sub.media_type === "movie" && sub.status === "active") {
      await searchMovieForSubscription(sub);
    }
  }
}

function getPendingEpisodes(episodes: Episode[], today: string): Episode[] {
  return episodes.filter((e) => {
    if (e.status !== "pending") return false;
    if (!e.air_date) return true;
    return e.air_date <= today;
  });
}

async function searchEpisodesForSubscription(sub: Subscription, today: string) {
  const episodes = getEpisodesBySubscription(sub.id);
  const pendingEps = getPendingEpisodes(episodes, today);
  if (pendingEps.length === 0) return;

  for (const ep of pendingEps) {
    await tryDownloadEpisode(sub, ep);
  }
}

async function tryDownloadEpisode(sub: Subscription, ep: Episode): Promise<boolean> {
  const searchResults = await rss.searchTorrents(sub.title, {
    season: sub.season_number,
    episode: ep.episode_number,
  });

  for (const item of searchResults) {
    const parseResult = item.ai;
    if (!isTitleMatch(sub.title, parseResult)) continue;

    if (
      sub.season_number &&
      parseResult?.seasonNumber &&
      parseResult.seasonNumber !== sub.season_number
    ) {
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
  const searchResults = await rss.searchTorrents(sub.title);
  for (const item of searchResults) {
    if (!isTitleMatch(sub.title, item.ai)) continue;

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
