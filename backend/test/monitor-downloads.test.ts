import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const updates: any[] = [];
const createdTorrents: any[] = [];
const rssCalls: Array<{ title: string; opts: any }> = [];
const loggerCalls: Array<{ level: string; args: any[] }> = [];

let subscriptions: any[] = [];
let episodesBySubscription: Record<number, any[]> = {};

const modelsMock = () => ({
  getActiveSubscriptions: () => subscriptions,
  getEpisodesBySubscription: (id: number) => episodesBySubscription[id] ?? [],
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
mock.module("../../db/models", modelsMock);

const rssMock = () => ({
  searchTorrents: async (title: string, opts: any) => {
    rssCalls.push({ title, opts });
    return [
      {
        title: "Show",
        link: "magnet:?xt=urn:btih:abc",
        source: "mikan",
        ai: { englishTitle: "Show", episodeNumber: 1, seasonNumber: 1 },
      },
    ];
  },
});
mock.module(modulePath("../src/services/rss"), rssMock);
mock.module("../rss", rssMock);

const qbitMock = () => ({
  getQbitDownloadDir: () => "/downloads",
  addTorrentByUrl: async () => true,
});
mock.module(modulePath("../src/services/qbittorrent"), qbitMock);
mock.module("../qbittorrent", qbitMock);

const loggerMock = () => ({
  logger: {
    info: (...args: any[]) => loggerCalls.push({ level: "info", args }),
    debug: (...args: any[]) => loggerCalls.push({ level: "debug", args }),
    warn: (...args: any[]) => loggerCalls.push({ level: "warn", args }),
    error: (...args: any[]) => loggerCalls.push({ level: "error", args }),
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../logger", loggerMock);

const matchersMock = () => ({
  isTitleMatch: () => true,
  matchesEpisodeSeason: () => ({ ok: true }),
  matchesProfile: () => ({ ok: true }),
});
mock.module(modulePath("../src/services/monitor/matchers"), matchersMock);
mock.module("./matchers", matchersMock);

const utilsMock = () => ({
  getTodayDateOnly: () => "2024-01-02",
  parseMagnetHash: (link: string) => {
    if (!link.startsWith("magnet:?xt=urn:btih:")) return null;
    const hash = link.split("xt=urn:btih:")[1]?.split("&")[0];
    return hash ? hash.toLowerCase() : null;
  },
});
mock.module(modulePath("../src/services/monitor/utils"), utilsMock);
mock.module("./utils", utilsMock);

const downloads = await import("../src/services/monitor/downloads?test=monitor-downloads");

describe("monitor/downloads", () => {
  beforeEach(() => {
    updates.length = 0;
    createdTorrents.length = 0;
    rssCalls.length = 0;
    loggerCalls.length = 0;
    subscriptions = [
      {
        id: 1,
        media_type: "tv",
        title: "Show",
        season_number: 1,
        status: "active",
        profile_id: null,
      },
    ];
    episodesBySubscription = {
      1: [
        {
          id: 10,
          subscription_id: 1,
          episode_number: 1,
          air_date: "2024-01-01",
          status: "pending",
        },
        {
          id: 11,
          subscription_id: 1,
          episode_number: 2,
          air_date: "bad-date",
          status: "pending",
        },
        {
          id: 12,
          subscription_id: 1,
          episode_number: 3,
          air_date: "bad-date",
          status: "pending",
        },
        {
          id: 13,
          subscription_id: 1,
          episode_number: 4,
          air_date: "2024-01-03",
          status: "pending",
        },
      ],
    };
  });

  it("filters pending episodes with parsed dates and warns once per invalid date value", async () => {
    await downloads.searchAndDownload();

    const warningCalls = loggerCalls.filter((entry) => entry.level === "warn");
    expect(warningCalls.length).toBe(1);

    expect(rssCalls.every((call) => call.opts?.episode === 1)).toBe(true);
    expect(updates.length <= 1).toBe(true);
    expect(createdTorrents.length <= 1).toBe(true);
  });
});
