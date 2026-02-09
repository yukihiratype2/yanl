import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const updates: any[] = [];

const modelsMock = () => ({
  getActiveSubscriptions: () => [
    {
      id: 1,
      media_type: "tv",
      title: "Show",
      season_number: 1,
      status: "active",
    },
  ],
  getEpisodesBySubscription: () => [
    {
      id: 1,
      subscription_id: 1,
      episode_number: 1,
      title: "Ep1",
      status: "downloading",
      torrent_hash: "abc",
      file_path: null,
    },
  ],
  getTorrentsBySubscription: () => [],
  updateEpisode: (id: number, data: any) => updates.push({ id, data }),
  updateSubscription: () => {},
  getAllSubscriptions: () => [],
  getSubscriptionById: () => null,
  getEpisodesWithAirDateRange: () => [],
  getTorrentByLink: () => null,
  getTorrentByHash: () => null,
  getTorrentByEpisodeId: () => null,
  createSubscription: () => ({ id: 1 }),
  deleteSubscription: () => {},
  createEpisode: () => {},
  createTorrent: () => ({ id: 1 }),
  getAllProfiles: () => [],
  getProfileById: () => null,
  createProfile: () => ({ id: 1 }),
  updateProfile: () => {},
  deleteProfile: () => {},
  setDefaultProfile: () => {},
});
mock.module(modulePath("../src/db/models"), modelsMock);
mock.module("../../db/models", modelsMock);

const qbitMonitorMock = () => ({
  getManagedQbitTags: () => new Set(["nas"]),
  getManagedQbitTorrents: async () => [
    {
      hash: "abc",
      progress: 1,
      state: "uploading",
      content_path: "/downloads/file.mkv",
      tags: "nas",
    },
  ],
  isDownloadComplete: () => true,
  cleanupQbitTorrent: async () => {},
});
mock.module(modulePath("../src/services/monitor/qbit"), qbitMonitorMock);
mock.module("./qbit", qbitMonitorMock);

const qbitMock = () => ({
  mapQbitPathToLocal: (path: string) => path,
});
mock.module(modulePath("../src/services/qbittorrent"), qbitMock);
mock.module("../qbittorrent", qbitMock);

const fileManagerMock = () => ({
  createMediaFolder: () => "/media/Show/Season 01",
  moveFileToMediaDir: () => "/media/Show/Season 01/Show - S01E01.mkv",
  findVideoFiles: () => ["/downloads/file.mkv"],
});
mock.module(modulePath("../src/services/fileManager"), fileManagerMock);
mock.module("../fileManager", fileManagerMock);

const loggerMock = () => ({
  logger: {
    info: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../logger", loggerMock);

const monitor = await import("../src/services/monitor/download-monitor?test=monitor-download-monitor");

describe("monitor/download-monitor", () => {
  it("moves completed episode files", async () => {
    await monitor.monitorDownloads();
    expect(updates.length).toBe(1);
    expect(updates[0].data.status).toBe("completed");
  });
});
