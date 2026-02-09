import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const created: any[] = [];

let todayValue = "2024-01-02";
let activeSubscriptions: any[] = [];
let episodesBySubscription: Record<number, any[]> = {};
let tmdbSeasonDetail: any;
let tmdbTVDetail: any;
let bgmEpisodes: any[] = [];

const modelsMock = () => ({
  getActiveSubscriptions: () => activeSubscriptions,
  getEpisodesBySubscription: (id: number) => episodesBySubscription[id] ?? [],
  createEpisode: (data: any) => {
    const record = { id: created.length + 1, ...data };
    created.push(record);
    return record;
  },
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
  getSeasonDetail: async () => tmdbSeasonDetail,
  getTVDetail: async () => tmdbTVDetail,
});
mock.module(modulePath("../src/services/tmdb"), tmdbMock);
mock.module("../tmdb", tmdbMock);

const bgmMock = () => ({
  getAllEpisodes: async () => bgmEpisodes,
});
mock.module(modulePath("../src/services/bgm"), bgmMock);
mock.module("../bgm", bgmMock);

const loggerMock = () => ({
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../logger", loggerMock);

const notifactionCalls: any[] = [];
const notifactionMock = () => ({
  emitNotifactionEvent: (event: any) => notifactionCalls.push(event),
});
mock.module(modulePath("../src/services/notifaction"), notifactionMock);
mock.module("../notifaction", notifactionMock);

const utilsMock = () => ({
  getTodayDateOnly: () => todayValue,
});
mock.module(modulePath("../src/services/monitor/utils"), utilsMock);
mock.module("./utils", utilsMock);

const discovery = await import("../src/services/monitor/discovery?test=monitor-discovery");

describe("monitor/discovery", () => {
  beforeEach(() => {
    created.length = 0;
    notifactionCalls.length = 0;
    todayValue = "2024-01-02";
    activeSubscriptions = [
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
    ];
    episodesBySubscription = {};
    tmdbSeasonDetail = {
      season_number: 1,
      episodes: [
        {
          episode_number: 1,
          name: "Ep1",
          air_date: "2024-1-1",
          overview: "",
          still_path: null,
        },
        {
          episode_number: 2,
          name: "Ep2",
          air_date: "2024-01-03",
          overview: "",
          still_path: null,
        },
        {
          episode_number: 3,
          name: "Ep3",
          air_date: "bad-date",
          overview: "",
          still_path: null,
        },
      ],
    };
    tmdbTVDetail = { seasons: [] };
    bgmEpisodes = [
      { ep: 1, sort: 1, airdate: "2024-1-1", name_cn: "Bgm1", name: "Bgm1" },
      { ep: 2, sort: 2, airdate: "2024-01-03", name_cn: "Bgm2", name: "Bgm2" },
      { ep: 3, sort: 3, airdate: "bad-date", name_cn: "Bgm3", name: "Bgm3" },
    ];
  });

  it("creates only released parseable episodes and normalizes stored dates", async () => {
    await discovery.checkNewEpisodes();
    const keys = created.map(
      (entry) => `${entry.subscription_id}:${entry.episode_number}:${entry.air_date}`
    );
    expect(keys).toContain("1:1:2024-01-01");
    expect(keys).not.toContain("1:2:2024-01-03");
    expect(keys).not.toContain("1:3:bad-date");
    const bgmKeys = keys.filter((entry) => entry.startsWith("2:"));
    for (const bgmKey of bgmKeys) {
      expect(bgmKey).toBe("2:1:2024-01-01");
    }
    expect(notifactionCalls.length).toBeGreaterThan(0);
    expect(
      notifactionCalls.every((entry) => entry.type === "media_released")
    ).toBe(true);
  });

  it("skips TMDB episode when matched by legacy episode+air_date", async () => {
    activeSubscriptions = [activeSubscriptions[0]];
    episodesBySubscription = {
      1: [
        {
          season_number: null,
          episode_number: 1,
          air_date: "2024-1-1",
        },
      ],
    };
    await discovery.checkNewEpisodes();
    expect(created.length).toBe(0);
    expect(notifactionCalls.length).toBe(0);
  });
});
