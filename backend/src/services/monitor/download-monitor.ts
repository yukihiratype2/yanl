import {
  getActiveSubscriptions,
  getEpisodesBySubscription,
  getTorrentsBySubscription,
  updateEpisode,
  updateSubscription,
  Subscription,
  Episode,
} from "../../db/models";
import * as fileManager from "../fileManager";
import { logger } from "../logger";
import { qbittorrent } from "../qbittorrent";
import {
  buildEpisodeFilename,
  buildMovieFilename,
  findTorrentByHash,
  selectPrimaryVideoFile,
  QbitTorrent,
} from "./utils";

export async function monitorDownloads() {
  const managedTags = qbittorrent.getManagedQbitTags();
  let qbitTorrents: QbitTorrent[];
  try {
    qbitTorrents = await qbittorrent.getManagedQbitTorrents();
  } catch (err) {
    logger.error({ err }, "QBit connection validation failed");
    return;
  }

  const subscriptions = getActiveSubscriptions();
  for (const sub of subscriptions) {
    if (sub.media_type === "tv" || sub.media_type === "anime") {
      await monitorEpisodeDownloads(sub, qbitTorrents, managedTags);
      continue;
    }

    if (sub.media_type === "movie") {
      await monitorMovieDownloads(sub, qbitTorrents, managedTags);
    }
  }
}

async function monitorEpisodeDownloads(
  sub: Subscription,
  qbitTorrents: QbitTorrent[],
  managedTags: Set<string>
) {
  const episodes = getEpisodesBySubscription(sub.id);
  const downloadingEpisodes = episodes.filter((e) => e.status === "downloading");
  const completedEpisodes = episodes.filter(
    (e) => e.status === "completed" && e.torrent_hash && e.file_path
  );

  for (const ep of downloadingEpisodes) {
    await handleDownloadingEpisode(sub, ep, qbitTorrents, managedTags);
  }

  for (const ep of completedEpisodes) {
    await cleanupCompletedEpisode(sub, ep, qbitTorrents, managedTags);
  }
}

async function handleDownloadingEpisode(
  sub: Subscription,
  ep: Episode,
  qbitTorrents: QbitTorrent[],
  managedTags: Set<string>
) {
  if (!ep.torrent_hash) return;

  const torrent = findTorrentByHash(qbitTorrents, ep.torrent_hash);
  if (!torrent || !qbittorrent.isDownloadComplete(torrent)) return;

  logger.info({ subscription: sub.title, episode: ep.title }, "Episode download complete");

  const contentPath = qbittorrent.mapQbitPathToLocal(torrent.content_path);
  let sourceFile = selectPrimaryVideoFile(contentPath);

  try {
    const seasonNum = sub.season_number || 1;
    const destDir = fileManager.createMediaFolder(sub.media_type, sub.title, seasonNum);
    const newName = buildEpisodeFilename(
      sub.title,
      seasonNum,
      ep.episode_number,
      sourceFile
    );

    const finalPath = fileManager.moveFileToMediaDir(sourceFile, destDir, newName);

    updateEpisode(ep.id, {
      status: "completed",
      file_path: finalPath,
    });

    await qbittorrent.cleanupQbitTorrent(torrent, managedTags, {
      subscription: sub.title,
      episode: ep.title,
    });
  } catch (err) {
    logger.error({ err }, "Episode file move error");
  }
}

async function cleanupCompletedEpisode(
  sub: Subscription,
  ep: Episode,
  qbitTorrents: QbitTorrent[],
  managedTags: Set<string>
) {
  if (!ep.torrent_hash) return;
  const torrent = findTorrentByHash(qbitTorrents, ep.torrent_hash);
  if (!torrent || !qbittorrent.isDownloadComplete(torrent)) return;

  await qbittorrent.cleanupQbitTorrent(torrent, managedTags, {
    subscription: sub.title,
    episode: ep.title,
  });
}

async function monitorMovieDownloads(
  sub: Subscription,
  qbitTorrents: QbitTorrent[],
  managedTags: Set<string>
) {
  if (sub.status === "downloading") {
    await handleDownloadingMovie(sub, qbitTorrents, managedTags);
    return;
  }

  if (sub.status === "completed") {
    await cleanupCompletedMovie(sub, qbitTorrents, managedTags);
  }
}

function getLatestTorrentRecord(sub: Subscription) {
  const torrents = getTorrentsBySubscription(sub.id);
  return torrents[0] || null;
}

async function handleDownloadingMovie(
  sub: Subscription,
  qbitTorrents: QbitTorrent[],
  managedTags: Set<string>
) {
  const activeTorrentRecord = getLatestTorrentRecord(sub);
  if (!activeTorrentRecord?.hash) return;

  const torrent = findTorrentByHash(qbitTorrents, activeTorrentRecord.hash);
  if (!torrent || !qbittorrent.isDownloadComplete(torrent)) return;

  logger.info({ subscription: sub.title }, "Movie download complete");

  const contentPath = qbittorrent.mapQbitPathToLocal(torrent.content_path);
  let sourceFile = selectPrimaryVideoFile(contentPath);

  try {
    const destDir = fileManager.createMediaFolder("movie", sub.title);
    const newName = buildMovieFilename(sub.title, sourceFile);

    fileManager.moveFileToMediaDir(sourceFile, destDir, newName);

    updateSubscription(sub.id, { status: "completed" });
    await qbittorrent.cleanupQbitTorrent(torrent, managedTags, {
      subscription: sub.title,
    });
  } catch (err) {
    logger.error({ err }, "Movie file move error");
  }
}

async function cleanupCompletedMovie(
  sub: Subscription,
  qbitTorrents: QbitTorrent[],
  managedTags: Set<string>
) {
  const activeTorrentRecord = getLatestTorrentRecord(sub);
  if (!activeTorrentRecord?.hash) return;

  const torrent = findTorrentByHash(qbitTorrents, activeTorrentRecord.hash);
  if (!torrent || !qbittorrent.isDownloadComplete(torrent)) return;

  await qbittorrent.cleanupQbitTorrent(torrent, managedTags, {
    subscription: sub.title,
  });
}
