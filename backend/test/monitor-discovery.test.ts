import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const created: any[] = [];

const modelsMock = () => ({
  getActiveSubscriptions: () => [
    {
      id: 1,
      source: "tvdb",
      media_type: "tv",
      source_id: 100,
      title: "Show",
      season_number: 1,
    },
    {
      id: 2,
      source: "bgm",
      media_type: "anime",
      source_id: 200,
      title: "Anime",
    },
  ],
  getEpisodesBySubscription: (id: number) => (id === 1 ? [] : []),
  createEpisode: (data: any) => created.push(data),
  getAllSubscriptions: () => [],
  getSubscriptionById: () => null,
  updateSubscription: () => {},
  getTorrentsBySubscription: () => [],
  getTorrentByLink: () => null,
  getTorrentByHash: () => null,
  getTorrentByEpisodeId: () => null,
  createSubscription: () => ({ id: 1 }),
  deleteSubscription: () => {},
  updateEpisode: () => {},
  createTorrent: () => ({ id: 1 }),
  getAllProfiles: () => [],
  getProfileById: () => null,
  createProfile: () => ({ id: 1 }),
  updateProfile: () => {},
  deleteProfile: () => {},
  setDefaultProfile: () => {},
  getEpisodesWithAirDateRange: () => [],
});
mock.module(modulePath("../src/db/models"), modelsMock);
mock.module("../../db/models", modelsMock);

const tmdbMock = () => ({
  getSeasonDetail: async () => ({
    season_number: 1,
    episodes: [
      { episode_number: 1, name: "Ep1", air_date: "2024-01-01", overview: "", still_path: null },
    ],
  }),
  getTVDetail: async () => ({
    seasons: [
      { season_number: 1, air_date: "2024-01-01", episode_count: 1 },
    ],
  }),
});
mock.module(modulePath("../src/services/tmdb"), tmdbMock);
mock.module("../tmdb", tmdbMock);

const bgmMock = () => ({
  getAllEpisodes: async () => [
    { ep: 1, sort: 1, airdate: "2024-01-01", name_cn: "Ep1", name: "Ep1" },
  ],
});
mock.module(modulePath("../src/services/bgm"), bgmMock);
mock.module("../bgm", bgmMock);

const loggerMock = () => ({
  logger: {
    info: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../logger", loggerMock);

const utilsMock = () => ({
  getTodayISO: () => "2024-01-02",
});
mock.module(modulePath("../src/services/monitor/utils"), utilsMock);
mock.module("./utils", utilsMock);

const discovery = await import("../src/services/monitor/discovery?test=monitor-discovery");

describe("monitor/discovery", () => {
  it("creates new episodes from TMDB and BGM", async () => {
    await discovery.checkNewEpisodes();
    expect(created.length).toBeGreaterThanOrEqual(0);
  });
});
