import { describe, expect, it } from "bun:test";
import { downloadTorrent } from "../src/usecases/torrents";

const baseDeps = {
  qbittorrent: {
    getQbitDownloadDir: () => "/downloads",
    addTorrentByUrl: async () => true,
  },
  models: {
    getSubscriptionById: () => ({ media_type: "tv", folder_path: "/media" }),
    getTorrentByHash: () => null,
    getTorrentByLink: () => null,
    getTorrentByEpisodeId: () => null,
    updateEpisode: () => {},
    createTorrent: (data: any) => ({ id: 1, ...data }),
  },
};

describe("usecases/torrents", () => {
  it("downloads a torrent and creates record", async () => {
    const res = await downloadTorrent(
      {
        subscription_id: 1,
        title: "Title",
        link: "magnet:?xt=urn:btih:abc",
        source: "rss",
      },
      baseDeps as any
    );
    expect(res.ok).toBe(true);
  });
});
