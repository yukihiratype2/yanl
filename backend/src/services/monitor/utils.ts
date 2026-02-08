import * as qbittorrent from "../qbittorrent";
import * as fileManager from "../fileManager";

export type ParsedTitle = import("../rss").RSSItem["ai"];
export type QbitTorrent = qbittorrent.QBitTorrentInfo;

export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function parseMagnetHash(link: string): string | null {
  if (!link.startsWith("magnet:?xt=urn:btih:")) return null;
  const hash = link.split("xt=urn:btih:")[1]?.split("&")[0];
  return hash ? hash.toLowerCase() : null;
}

export function selectPrimaryVideoFile(contentPath: string): string {
  const files = fileManager.findVideoFiles(contentPath);
  return files.length > 0 ? files[0] : contentPath;
}

function getFileExtension(path: string): string | null {
  const idx = path.lastIndexOf(".");
  if (idx === -1 || idx === path.length - 1) return null;
  return path.slice(idx + 1);
}

export function buildEpisodeFilename(
  title: string,
  season: number,
  episode: number,
  sourcePath: string
): string {
  const ext = getFileExtension(sourcePath);
  const suffix = ext ? `.${ext}` : "";
  return `${title} - S${String(season).padStart(2, "0")}E${String(episode).padStart(
    2,
    "0"
  )}${suffix}`;
}

export function buildMovieFilename(title: string, sourcePath: string): string {
  const ext = getFileExtension(sourcePath);
  const suffix = ext ? `.${ext}` : "";
  return `${title}${suffix}`;
}

export function findTorrentByHash(
  torrents: QbitTorrent[],
  hash: string
): QbitTorrent | undefined {
  const normalized = hash.toLowerCase();
  return torrents.find((t) => t.hash.toLowerCase() === normalized);
}
