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
import { emitNotifactionEvent } from "../notifaction";
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
    logger.error(
      {
        op: "monitor.download_monitor.qbit_fetch_failed",
        err,
      },
      "QBit connection validation failed"
    );
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

  logger.info(
    {
      op: "monitor.download_monitor.episode_download_complete",
      subscriptionId: sub.id,
      subscription: sub.title,
      episodeId: ep.id,
      episode: ep.title,
      torrentHash: ep.torrent_hash,
    },
    "Episode download complete"
  );
  emitNotifactionEvent({
    type: "download_completed",
    subscription: {
      id: sub.id,
      title: sub.title,
      media_type: sub.media_type,
      source: sub.source,
      source_id: sub.source_id,
      season_number: sub.season_number,
    },
    data: {
      episode_id: ep.id,
      episode_number: ep.episode_number,
      episode_title: ep.title,
      torrent_hash: ep.torrent_hash,
      content_path: torrent.content_path,
    },
  });

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
    emitNotifactionEvent({
      type: "media_moved",
      subscription: {
        id: sub.id,
        title: sub.title,
        media_type: sub.media_type,
        source: sub.source,
        source_id: sub.source_id,
        season_number: sub.season_number,
      },
      data: {
        episode_id: ep.id,
        episode_number: ep.episode_number,
        episode_title: ep.title,
        from_path: sourceFile,
        to_path: finalPath,
      },
    });

    await qbittorrent.cleanupQbitTorrent(torrent, managedTags, {
      subscription: sub.title,
      episode: ep.title,
    });
  } catch (err) {
    logger.error(
      {
        op: "monitor.download_monitor.episode_file_move_failed",
        subscriptionId: sub.id,
        subscription: sub.title,
        episodeId: ep.id,
        episode: ep.title,
        torrentHash: ep.torrent_hash,
        contentPath,
        sourceFile,
        err,
      },
      "Episode file move error"
    );
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

  logger.info(
    {
      op: "monitor.download_monitor.movie_download_complete",
      subscriptionId: sub.id,
      subscription: sub.title,
      torrentHash: activeTorrentRecord.hash,
    },
    "Movie download complete"
  );
  emitNotifactionEvent({
    type: "download_completed",
    subscription: {
      id: sub.id,
      title: sub.title,
      media_type: sub.media_type,
      source: sub.source,
      source_id: sub.source_id,
      season_number: sub.season_number,
    },
    data: {
      torrent_hash: activeTorrentRecord.hash,
      content_path: torrent.content_path,
    },
  });

  const contentPath = qbittorrent.mapQbitPathToLocal(torrent.content_path);
  let sourceFile = selectPrimaryVideoFile(contentPath);

  try {
    const destDir = fileManager.createMediaFolder("movie", sub.title);
    const newName = buildMovieFilename(sub.title, sourceFile);

    const finalPath = fileManager.moveFileToMediaDir(sourceFile, destDir, newName);

    updateSubscription(sub.id, { status: "completed" });
    emitNotifactionEvent({
      type: "media_moved",
      subscription: {
        id: sub.id,
        title: sub.title,
        media_type: sub.media_type,
        source: sub.source,
        source_id: sub.source_id,
        season_number: sub.season_number,
      },
      data: {
        from_path: sourceFile,
        to_path: finalPath,
      },
    });
    await qbittorrent.cleanupQbitTorrent(torrent, managedTags, {
      subscription: sub.title,
    });
  } catch (err) {
    logger.error(
      {
        op: "monitor.download_monitor.movie_file_move_failed",
        subscriptionId: sub.id,
        subscription: sub.title,
        torrentHash: activeTorrentRecord.hash,
        contentPath,
        sourceFile,
        err,
      },
      "Movie file move error"
    );
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
