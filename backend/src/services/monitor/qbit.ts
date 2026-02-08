import * as qbittorrent from "../qbittorrent";
import { getSetting } from "../../db/settings";
import { logger } from "../logger";
import { QbitTorrent } from "./utils";

export function getManagedQbitTags(): Set<string> {
  const raw = (getSetting("qbit_tag") || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

export async function getManagedQbitTorrents(): Promise<QbitTorrent[]> {
  const managedTags = getManagedQbitTags();
  if (managedTags.size === 0) {
    return qbittorrent.getTorrents();
  }

  const byHash = new Map<string, QbitTorrent>();
  for (const tag of managedTags) {
    const torrents = await qbittorrent.getTorrents({ tag });
    for (const torrent of torrents) {
      byHash.set(torrent.hash.toLowerCase(), torrent);
    }
  }
  return Array.from(byHash.values());
}

export function hasManagedQbitTag(torrent: QbitTorrent, managedTags: Set<string>): boolean {
  if (managedTags.size === 0) return false;
  const torrentTags = (torrent.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return torrentTags.some((tag) => managedTags.has(tag));
}

export function isDownloadComplete(torrent: QbitTorrent): boolean {
  return (
    torrent.progress === 1 ||
    torrent.state === "uploading" ||
    torrent.state === "stalledUP" ||
    torrent.state === "pausedUP" ||
    torrent.state === "queuedUP" ||
    torrent.state === "checkingUP" ||
    torrent.state === "forcedUP"
  );
}

function isSeedingStopped(torrent: QbitTorrent): boolean {
  return torrent.state === "pausedUP" || torrent.state === "pausedDL";
}

export async function cleanupQbitTorrent(
  torrent: QbitTorrent,
  managedTags: Set<string>,
  context: Record<string, any>
): Promise<void> {
  if (!hasManagedQbitTag(torrent, managedTags)) return;
  if (!isSeedingStopped(torrent)) return;

  const ok = await qbittorrent.deleteTorrents(torrent.hash, true);
  if (ok) {
    logger.info({ ...context, hash: torrent.hash }, "Removed qBittorrent torrent and files");
  } else {
    logger.warn({ ...context, hash: torrent.hash }, "Failed to remove qBittorrent torrent");
  }
}
