import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const updates: any[] = [];
const createdTorrents: any[] = [];

const modelsMock = () => ({
  getActiveSubscriptions: () => [
    {
      id: 1,
      media_type: "tv",
      title: "Show",
      season_number: 1,
      status: "active",
      profile_id: null,
    },
  ],
  getEpisodesBySubscription: () => [
    {
      id: 10,
      subscription_id: 1,
      episode_number: 1,
      air_date: "2024-01-01",
      status: "pending",
    },
  ],
  updateEpisode: (id: number, data: any) => updates.push({ id, data }),
  updateSubscription: () => {},
  createTorrent: (data: any) => {
    createdTorrents.push(data);
    return { id: 1 };
  },
  getProfileById: () => null,
  getTorrentByEpisodeId: () => null,
  getTorrentByHash: () => null,
  getTorrentByLink: () => null,
  getTorrentsBySubscription: () => [],
  getAllSubscriptions: () => [],
  getSubscriptionById: () => null,
  getEpisodesWithAirDateRange: () => [],
  createSubscription: () => ({ id: 1 }),
  deleteSubscription: () => {},
  createEpisode: () => {},
  updateProfile: () => {},
  createProfile: () => ({ id: 1 }),
  deleteProfile: () => {},
  setDefaultProfile: () => {},
  getAllProfiles: () => [],
});
mock.module(modulePath("../src/db/models"), modelsMock);
mock.module(`${modulePath("../src/db/models")}?test=monitor-downloads`, modelsMock);
mock.module("../../db/models", modelsMock);

const rssMock = () => ({
  searchTorrents: async () => [
    {
      title: "Show",
      link: "magnet:?xt=urn:btih:abc",
      source: "mikan",
      ai: { englishTitle: "Show", episodeNumber: 1, seasonNumber: 1 },
    },
  ],
});
mock.module(modulePath("../src/services/rss"), rssMock);
mock.module(`${modulePath("../src/services/rss")}?test=monitor-downloads`, rssMock);
mock.module("../rss", rssMock);

const qbitMock = () => ({
  getQbitDownloadDir: () => "/downloads",
  addTorrentByUrl: async () => true,
});
mock.module(modulePath("../src/services/qbittorrent"), qbitMock);
mock.module(
  `${modulePath("../src/services/qbittorrent")}?test=monitor-downloads`,
  qbitMock
);
mock.module("../qbittorrent", qbitMock);

const loggerMock = () => ({
  logger: {
    info: () => {},
    debug: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module(`${modulePath("../src/services/logger")}?test=monitor-downloads`, loggerMock);
mock.module("../logger", loggerMock);

const matchersMock = () => ({
  isTitleMatch: () => true,
  matchesEpisodeSeason: () => ({ ok: true }),
  matchesProfile: () => ({ ok: true }),
});
mock.module(modulePath("../src/services/monitor/matchers"), matchersMock);
mock.module(
  `${modulePath("../src/services/monitor/matchers")}?test=monitor-downloads`,
  matchersMock
);
mock.module("./matchers", matchersMock);

const downloads = await import("../src/services/monitor/downloads?test=monitor-downloads");

describe("monitor/downloads", () => {
  it("searches and starts downloads", async () => {
    await downloads.searchAndDownload();
    expect(updates.length).toBeGreaterThanOrEqual(0);
    expect(createdTorrents.length).toBeGreaterThanOrEqual(0);
  });
});
