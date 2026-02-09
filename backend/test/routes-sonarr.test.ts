import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

mock.restore();

let profiles: any[] = [];
let subscriptions: any[] = [];
let episodesBySubscription: Record<number, any[]> = {};
let torrentsBySubscription: Record<number, any[]> = {};
let tags: any[] = [];
let runJobCalls: string[] = [];
let deleteCalls: Array<{ sub: any; opts: any }> = [];

let nextSubscriptionId = 1;
let nextEpisodeId = 1;
let nextTagId = 1;

const tvdbToTmdb = new Map<number, number>();
const tmdbDetails = new Map<number, any>();
const tmdbExternalIds = new Map<number, any>();
let searchResults: any[] = [];

function seedTmdbData(tmdbId: number, tvdbId: number, title = "Mock Show") {
  tvdbToTmdb.set(tvdbId, tmdbId);
  tmdbDetails.set(tmdbId, {
    id: tmdbId,
    name: title,
    original_name: title,
    overview: `${title} overview`,
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    first_air_date: "2024-01-01",
    vote_average: 8.4,
    number_of_seasons: 3,
    number_of_episodes: 24,
    seasons: [
      { id: tmdbId * 10 + 0, season_number: 0, name: "Specials", episode_count: 0, air_date: null, poster_path: null },
      { id: tmdbId * 10 + 1, season_number: 1, name: "Season 1", episode_count: 12, air_date: "2024-01-01", poster_path: null },
      { id: tmdbId * 10 + 2, season_number: 2, name: "Season 2", episode_count: 12, air_date: "2025-01-01", poster_path: null },
    ],
    genres: [{ id: 18, name: "Drama" }],
  });
  tmdbExternalIds.set(tmdbId, {
    id: tmdbId,
    imdb_id: "tt1234567",
    tvdb_id: tvdbId,
    tvmaze_id: 555,
  });
}

const settingsMock = () => ({
  getSetting: (key: string) => {
    const values: Record<string, string> = {
      media_dir_tv: "/media/tv",
      media_dir_anime: "/media/anime",
      api_token: "token",
    };
    return values[key] ?? "";
  },
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

const modelsPath = modulePath("../src/db/models");
const actionsPath = modulePath("../src/actions/subscriptions");
const tmdbPath = modulePath("../src/services/tmdb");

const modelsMock = () => ({
  getAllProfiles: () => profiles,
  getProfileById: (id: number) => profiles.find((profile) => profile.id === id) ?? null,
  getDefaultProfile: () => profiles.find((profile) => profile.is_default === 1) ?? profiles[0] ?? null,

  getAllSubscriptions: () => subscriptions,
  getSubscriptionById: (id: number) => subscriptions.find((sub) => sub.id === id) ?? null,
  getSubscriptionBySourceId: (
    source: string,
    sourceId: number,
    mediaType: string,
    seasonNumber?: number | null
  ) => {
    return (
      subscriptions.find((sub) => {
        if (sub.source !== source) return false;
        if (sub.source_id !== sourceId) return false;
        if (sub.media_type !== mediaType) return false;
        if (seasonNumber == null) return true;
        return sub.season_number === seasonNumber;
      }) ?? null
    );
  },
  updateSubscription: (id: number, data: any) => {
    const target = subscriptions.find((sub) => sub.id === id);
    if (!target) return;
    Object.assign(target, data, { updated_at: new Date().toISOString() });
  },

  getEpisodesBySubscription: (subscriptionId: number) =>
    episodesBySubscription[subscriptionId] ?? [],
  getEpisodeById: (id: number) => {
    for (const list of Object.values(episodesBySubscription)) {
      const found = list.find((item) => item.id === id);
      if (found) return found;
    }
    return null;
  },

  getTorrentsBySubscription: (subscriptionId: number) =>
    torrentsBySubscription[subscriptionId] ?? [],

  getAllSonarrTags: () => tags,
  getSonarrTagByLabel: (label: string) =>
    tags.find((tag) => tag.label === label) ?? null,
  createSonarrTag: (label: string) => {
    const tag = {
      id: nextTagId++,
      label,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    tags.push(tag);
    return tag;
  },

  // Unused exports for compatibility with shared model mocks in other tests
  getActiveSubscriptions: () => subscriptions.filter((sub) => sub.status === "active"),
  createSubscription: () => ({ id: 1 }),
  deleteSubscription: () => {},
  createEpisode: () => ({ id: 1 }),
  updateEpisode: () => {},
  getTorrentByHash: () => null,
  getTorrentByLink: () => null,
  getTorrentByEpisodeId: () => null,
  createTorrent: () => ({ id: 1 }),
  updateTorrent: () => {},
  getEpisodesWithAirDateRange: () => [],
  createProfile: () => ({ id: 1 }),
  updateProfile: () => {},
  deleteProfile: () => {},
  setDefaultProfile: () => {},
});
mock.module(modelsPath, modelsMock);
mock.module(`${modelsPath}?sonarr`, modelsMock);
mock.module("../db/models", modelsMock);
mock.module("../db/models?sonarr", modelsMock);

const actionsMock = () => ({
  createSubscriptionWithEpisodes: async (payload: any) => {
    const exists = subscriptions.find(
      (sub) =>
        sub.source === (payload.source ?? "tvdb") &&
        sub.source_id === payload.source_id &&
        sub.media_type === payload.media_type &&
        sub.season_number === payload.season_number
    );
    if (exists) {
      return {
        ok: false,
        status: 409,
        error: "Already subscribed",
        details: { subscription: exists },
      };
    }

    const sub = {
      id: nextSubscriptionId++,
      source: payload.source ?? "tvdb",
      source_id: payload.source_id,
      media_type: payload.media_type,
      title: `Series ${payload.source_id}`,
      title_original: null,
      overview: null,
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2024-01-01",
      vote_average: 7.8,
      season_number: payload.season_number ?? null,
      total_episodes: 12,
      status: "active",
      folder_path: `/media/${payload.media_type}/Series ${payload.source_id}/Season ${String(
        payload.season_number ?? 1
      ).padStart(2, "0")}`,
      profile_id: payload.profile_id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    subscriptions.push(sub);

    const episode = {
      id: nextEpisodeId++,
      subscription_id: sub.id,
      season_number: sub.season_number,
      episode_number: 1,
      title: "Episode 1",
      air_date: "2024-01-02",
      overview: null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    episodesBySubscription[sub.id] = [episode];

    return { ok: true, data: sub };
  },
  deleteSubscriptionWithCleanup: async (sub: any, opts: any) => {
    deleteCalls.push({ sub, opts });
    subscriptions = subscriptions.filter((item) => item.id !== sub.id);
    delete episodesBySubscription[sub.id];
    delete torrentsBySubscription[sub.id];
    return { ok: true, data: { success: true } };
  },
});
mock.module(actionsPath, actionsMock);
mock.module(`${actionsPath}?sonarr`, actionsMock);
mock.module("../actions/subscriptions", actionsMock);
mock.module("../actions/subscriptions?sonarr", actionsMock);

const monitorMock = () => ({
  runJobNow: (name: string) => {
    runJobCalls.push(name);
    return true;
  },
  startMonitor: () => {},
  getJobStatuses: () => [],
});
mock.module(modulePath("../src/services/monitor"), monitorMock);
mock.module("../services/monitor", monitorMock);

const tmdbMock = () => ({
  findTVByTvdbId: async (tvdbId: number) => {
    const tmdbId = tvdbToTmdb.get(tvdbId);
    if (!tmdbId) return null;
    return {
      id: tmdbId,
      name: tmdbDetails.get(tmdbId)?.name ?? `Series ${tmdbId}`,
      overview: "",
      poster_path: null,
      backdrop_path: null,
      vote_average: 0,
    };
  },
  getTVDetail: async (tmdbId: number) => {
    const detail = tmdbDetails.get(tmdbId);
    if (!detail) throw new Error("not found");
    return detail;
  },
  getTVExternalIds: async (tmdbId: number) => {
    const external = tmdbExternalIds.get(tmdbId);
    if (!external) throw new Error("not found");
    return external;
  },
  searchTV: async () => ({
    page: 1,
    results: searchResults,
    total_pages: 1,
    total_results: searchResults.length,
  }),
  searchMulti: async () => ({ page: 1, results: [], total_pages: 1, total_results: 0 }),
  searchMovie: async () => ({ page: 1, results: [], total_pages: 1, total_results: 0 }),
  getMovieDetail: async () => {
    throw new Error("unused");
  },
  getSeasonDetail: async () => {
    throw new Error("unused");
  },
  getAiringToday: async () => ({ page: 1, results: [], total_pages: 1, total_results: 0 }),
});
mock.module(tmdbPath, tmdbMock);
mock.module(`${tmdbPath}?sonarr`, tmdbMock);
mock.module("../services/tmdb", tmdbMock);
mock.module("../services/tmdb?sonarr", tmdbMock);

const routes = await import("../src/routes/sonarr?test=routes-sonarr");

describe("routes/sonarr", () => {
  beforeEach(() => {
    profiles = [
      {
        id: 1,
        name: "Default",
        is_default: 1,
      },
      {
        id: 2,
        name: "High Quality",
        is_default: 0,
      },
    ];
    subscriptions = [];
    episodesBySubscription = {};
    torrentsBySubscription = {};
    tags = [];
    runJobCalls = [];
    deleteCalls = [];
    nextSubscriptionId = 1;
    nextEpisodeId = 1;
    nextTagId = 1;
    tvdbToTmdb.clear();
    tmdbDetails.clear();
    tmdbExternalIds.clear();
    searchResults = [];

    seedTmdbData(10, 100, "Lookup Show");
    searchResults = [{ id: 10, name: "Lookup Show" }];
  });

  it("serves setup endpoints for Jellyseerr Sonarr test", async () => {
    const status = await routes.default.request("/system/status");
    const statusBody = await status.json();
    expect(status.status).toBe(200);
    expect(statusBody.version.startsWith("3.")).toBe(true);

    const quality = await routes.default.request("/qualityProfile");
    const qualityBody = await quality.json();
    expect(quality.status).toBe(200);
    expect(qualityBody.map((item: any) => item.name)).toEqual([
      "Default",
      "High Quality",
    ]);

    const qualityLower = await routes.default.request("/qualityprofile");
    expect(qualityLower.status).toBe(200);

    const rootfolder = await routes.default.request("/rootfolder");
    const rootBody = await rootfolder.json();
    expect(rootfolder.status).toBe(200);
    expect(rootBody.map((item: any) => item.path)).toEqual([
      "/media/tv",
      "/media/anime",
    ]);

    const language = await routes.default.request("/languageprofile");
    const languageBody = await language.json();
    expect(language.status).toBe(200);
    expect(languageBody[0].name).toBe("English");
  });

  it("creates and lists Sonarr tags", async () => {
    const create = await routes.default.request("/tag", {
      method: "POST",
      body: JSON.stringify({ label: "jellyseerr-user" }),
    });
    expect(create.status).toBe(201);

    const list = await routes.default.request("/tag");
    const body = await list.json();
    expect(list.status).toBe(200);
    expect(body).toEqual([{ id: 1, label: "jellyseerr-user" }]);
  });

  it("resolves tvdb lookup and includes id when subscription exists", async () => {
    const first = await routes.default.request("/series/lookup?term=tvdb:100");
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody[0].tvdbId).toBe(100);
    expect(firstBody[0].id).toBeUndefined();

    await routes.default.request("/series", {
      method: "POST",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 1,
        seasons: [{ seasonNumber: 1, monitored: true }],
      }),
    });

    const second = await routes.default.request("/series/lookup?term=tvdb:100");
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(Number(secondBody[0].id)).toBeGreaterThan(0);
  });

  it("creates a season subscription from POST /series", async () => {
    const res = await routes.default.request("/series", {
      method: "POST",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 1,
        seasons: [
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: false },
        ],
        seriesType: "standard",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(Number(body.id)).toBeGreaterThan(0);
    expect(subscriptions.length).toBe(1);
    expect(subscriptions[0].season_number).toBe(1);
    expect(subscriptions[0].status).toBe("active");
  });

  it("updates monitored seasons with PUT /series", async () => {
    await routes.default.request("/series", {
      method: "POST",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 1,
        seasons: [
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: true },
        ],
      }),
    });

    const update = await routes.default.request("/series", {
      method: "PUT",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 2,
        seasons: [
          { seasonNumber: 1, monitored: true },
          { seasonNumber: 2, monitored: false },
          { seasonNumber: 3, monitored: true },
        ],
      }),
    });

    expect(update.status).toBe(200);

    const bySeason = new Map(
      subscriptions.map((sub) => [sub.season_number, sub])
    );
    expect(bySeason.get(1)?.status).toBe("active");
    expect(bySeason.get(1)?.profile_id).toBe(2);
    expect(bySeason.get(2)?.status).toBe("disabled");
    expect(bySeason.get(2)?.profile_id).toBe(2);
    expect(bySeason.get(3)?.status).toBe("active");
  });

  it("deletes mapped subscriptions and honors deleteFiles flag", async () => {
    await routes.default.request("/series", {
      method: "POST",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 1,
        seasons: [{ seasonNumber: 1, monitored: true }],
      }),
    });

    const seriesId = subscriptions[0]?.source_id;
    const safeDelete = await routes.default.request(`/series/${seriesId}`, {
      method: "DELETE",
    });
    expect(safeDelete.status).toBe(200);
    expect(deleteCalls[0]?.opts).toEqual({ deleteFilesOnDisk: false });

    await routes.default.request("/series", {
      method: "POST",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 1,
        seasons: [{ seasonNumber: 1, monitored: true }],
      }),
    });

    const destructiveDelete = await routes.default.request(
      `/series/${seriesId}?deleteFiles=yes`,
      {
        method: "DELETE",
      }
    );
    expect(destructiveDelete.status).toBe(200);
    expect(deleteCalls[1]?.opts).toEqual({ deleteFilesOnDisk: true });
  });

  it("returns Sonarr-style episodes and updates monitor state", async () => {
    await routes.default.request("/series", {
      method: "POST",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 1,
        seasons: [{ seasonNumber: 1, monitored: true }],
      }),
    });

    const seriesId = subscriptions[0]?.source_id;
    const episodes = await routes.default.request(`/episode?seriesId=${seriesId}`);
    const episodesBody = await episodes.json();
    expect(episodes.status).toBe(200);
    expect(episodesBody.length).toBe(1);
    expect(episodesBody[0].seasonNumber).toBe(1);

    const monitorOff = await routes.default.request("/episode/monitor", {
      method: "PUT",
      body: JSON.stringify({
        episodeIds: [episodesBody[0].id],
        monitored: false,
      }),
    });
    expect(monitorOff.status).toBe(200);
    expect(subscriptions[0].status).toBe("disabled");
  });

  it("returns queue records only for active download states", async () => {
    await routes.default.request("/series", {
      method: "POST",
      body: JSON.stringify({
        tvdbId: 100,
        qualityProfileId: 1,
        seasons: [{ seasonNumber: 1, monitored: true }],
      }),
    });

    const sub = subscriptions[0];
    torrentsBySubscription[sub.id] = [
      {
        id: 100,
        subscription_id: sub.id,
        episode_id: episodesBySubscription[sub.id][0].id,
        title: "Pending torrent",
        link: "magnet:?xt=urn:btih:aaa",
        hash: "aaa",
        size: "1024",
        source: "indexer",
        status: "pending",
        download_path: null,
      },
      {
        id: 101,
        subscription_id: sub.id,
        episode_id: null,
        title: "Completed torrent",
        link: "magnet:?xt=urn:btih:bbb",
        hash: "bbb",
        size: "2048",
        source: "indexer",
        status: "completed",
        download_path: null,
      },
    ];

    const queue = await routes.default.request("/queue");
    const body = await queue.json();

    expect(queue.status).toBe(200);
    expect(body.totalRecords).toBe(1);
    expect(body.records[0].title).toBe("Pending torrent");
  });

  it("supports known commands and rejects unknown commands", async () => {
    const missingSearch = await routes.default.request("/command", {
      method: "POST",
      body: JSON.stringify({ name: "MissingEpisodeSearch", seriesId: 10 }),
    });
    expect(missingSearch.status).toBe(200);
    expect(runJobCalls).toContain("searchAndDownload");

    const refresh = await routes.default.request("/command", {
      method: "POST",
      body: JSON.stringify({ name: "RefreshMonitoredDownloads" }),
    });
    expect(refresh.status).toBe(200);
    expect(runJobCalls).toContain("monitorDownloads");

    const invalid = await routes.default.request("/command", {
      method: "POST",
      body: JSON.stringify({ name: "UnknownCommand" }),
    });
    expect(invalid.status).toBe(400);
  });
});
