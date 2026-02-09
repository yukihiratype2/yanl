import { describe, expect, it } from "bun:test";

const usecases = await import("../src/usecases/subscriptions?test=usecases-subscriptions");

const baseDeps = {
  models: {
    getProfileById: () => null,
    getDefaultProfile: () => ({ id: 2 }),
    getSubscriptionBySourceId: () => null,
    createSubscription: (data: any) => ({ id: 1, ...data }),
    createEpisode: () => {},
    getTorrentsBySubscription: () => [],
    getEpisodesBySubscription: () => [],
    deleteSubscription: () => {},
  },
  tmdb: {
    getTVDetail: async () => ({
      name: "Show",
      original_name: "Show",
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2024-01-01",
      vote_average: 8,
      seasons: [{ season_number: 1, episode_count: 10 }],
    }),
    getSeasonDetail: async () => ({
      season_number: 1,
      episodes: [],
    }),
    getMovieDetail: async () => ({
      title: "Movie",
      original_title: "Movie",
      overview: "",
      poster_path: null,
      backdrop_path: null,
      release_date: "2024-01-01",
      vote_average: 7,
    }),
  },
  bgm: {
    getSubjectDetail: async () => ({
      id: 1,
      name: "Anime",
      name_cn: "Anime",
      summary: "",
      images: {},
      date: "2024-01-01",
      total_episodes: 12,
    }),
  },
  fileManager: {
    createMediaFolder: () => "/media/Show",
    deleteMediaFolder: () => {},
  },
  qbittorrent: {
    deleteTorrents: async () => true,
  },
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
};

describe("usecases/subscriptions", () => {
  it("creates a subscription with episodes", async () => {
    const result = await usecases.createSubscriptionWithEpisodes(
      { media_type: "tv", source_id: 1 },
      baseDeps as any
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Show");
    }
  });

  it("returns error on invalid source", async () => {
    const result = await usecases.createSubscriptionWithEpisodes(
      { media_type: "tv", source_id: 1, source: "bad" as any },
      baseDeps as any
    );
    expect(result.ok).toBe(false);
  });

  it("deletes subscription and qbit torrents", async () => {
    const res = await usecases.deleteSubscriptionWithCleanup(
      {
        id: 1,
        media_type: "tv",
        folder_path: "/media/Show",
      } as any,
      { deleteFilesOnDisk: true },
      {
        ...baseDeps,
        models: {
          ...baseDeps.models,
          getTorrentsBySubscription: () => [{ hash: "abc" }],
          getEpisodesBySubscription: () => [{ torrent_hash: "def" }],
        },
      } as any
    );
    expect(res.ok).toBe(true);
  });
});
