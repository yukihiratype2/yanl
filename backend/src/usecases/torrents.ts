import * as qbittorrent from "../services/qbittorrent";
import * as models from "../db/models";
import { parseMagnetHash } from "../services/monitor/utils";
import { err, ok, type Result } from "../lib/result";

export type DownloadTorrentInput = {
  subscription_id: number;
  episode_id?: number;
  title: string;
  link: string;
  source: string;
};

export type TorrentDeps = {
  qbittorrent: typeof qbittorrent;
  models: typeof models;
};

const defaultDeps: TorrentDeps = {
  qbittorrent,
  models,
};

export async function downloadTorrent(
  input: DownloadTorrentInput,
  deps: TorrentDeps = defaultDeps
): Promise<Result<models.Torrent>> {
  const subscription = deps.models.getSubscriptionById(input.subscription_id);
  if (!subscription) {
    return err(404, "Subscription not found");
  }

  const hash = parseMagnetHash(input.link);
  if ((hash && deps.models.getTorrentByHash(hash)) || deps.models.getTorrentByLink(input.link)) {
    return err(409, "Torrent already added");
  }
  if (input.episode_id && deps.models.getTorrentByEpisodeId(input.episode_id)) {
    return err(409, "Episode already has a torrent");
  }

  const savepath = deps.qbittorrent.getQbitDownloadDir(subscription.media_type);
  const success = await deps.qbittorrent.addTorrentByUrl(input.link, {
    savepath,
    category: subscription.media_type,
  });
  if (!success) {
    return err(500, "Failed to add torrent to qBittorrent");
  }

  if (input.episode_id) {
    deps.models.updateEpisode(input.episode_id, {
      status: "downloading",
      torrent_hash: hash,
    });
  }

  const torrent = deps.models.createTorrent({
    subscription_id: input.subscription_id,
    episode_id: input.episode_id || null,
    title: input.title,
    link: input.link,
    hash,
    size: null,
    source: input.source,
    status: "downloading",
    download_path: subscription.folder_path,
  });

  return ok(torrent);
}
