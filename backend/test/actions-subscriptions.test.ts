import { describe, expect, it } from "bun:test";

const actions = await import("../src/actions/subscriptions?test=actions-subscriptions");

function buildDeps(overrides: Record<string, any> = {}) {
  const createdEpisodes: any[] = [];

  const deps = {
    models: {
      getProfileById: () => null,
      getDefaultProfile: () => ({ id: 2 }),
      getSubscriptionBySourceId: () => null,
      createSubscription: (data: any) => ({ id: 1, ...data }),
      createEpisode: (data: any) => {
        createdEpisodes.push(data);
      },
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
      getAllEpisodes: async () => [],
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
    ...overrides,
  };

  return { deps, createdEpisodes };
}

describe("actions/subscriptions", () => {
  it("creates a subscription with episodes", async () => {
    const { deps } = buildDeps();
    const result = await actions.createSubscriptionWithEpisodes(
      { media_type: "tv", source_id: 1 },
      deps as any
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Show");
    }
  });

  it("returns error on invalid source", async () => {
    const { deps } = buildDeps();
    const result = await actions.createSubscriptionWithEpisodes(
      { media_type: "tv", source_id: 1, source: "bad" as any },
      deps as any
    );
    expect(result.ok).toBe(false);
  });

  it("returns 422 when core metadata date is invalid", async () => {
    const { deps } = buildDeps({
      tmdb: {
        getTVDetail: async () => ({
          name: "Show",
          original_name: "Show",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          first_air_date: "bad-date",
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
    });

    const result = await actions.createSubscriptionWithEpisodes(
      { media_type: "tv", source_id: 1 },
      deps as any
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  it("skips invalid episode air_date values from external sources", async () => {
    const { deps, createdEpisodes } = buildDeps({
      tmdb: {
        getTVDetail: async () => ({
          name: "Show",
          original_name: "Show",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          first_air_date: "2024-01-01",
          vote_average: 8,
          seasons: [{ season_number: 1, episode_count: 3 }],
        }),
        getSeasonDetail: async () => ({
          season_number: 1,
          episodes: [
            {
              episode_number: 1,
              name: "Ep1",
              air_date: "2024-1-2",
              overview: "",
              still_path: null,
            },
            {
              episode_number: 2,
              name: "Ep2",
              air_date: "bad-date",
              overview: "",
              still_path: null,
            },
            {
              episode_number: 3,
              name: "Ep3",
              air_date: "",
              overview: "",
              still_path: null,
            },
          ],
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
    });

    const result = await actions.createSubscriptionWithEpisodes(
      { media_type: "tv", source_id: 1, season_number: 1 },
      deps as any
    );
    expect(result.ok).toBe(true);

    expect(createdEpisodes.length).toBe(2);
    expect(
      createdEpisodes.map((episode) => `${episode.episode_number}:${episode.air_date}`)
    ).toEqual(["1:2024-01-02", "3:null"]);
  });

  it("deletes subscription and qbit torrents", async () => {
    const { deps: baseDeps } = buildDeps();
    const deps = {
      ...baseDeps,
      models: {
        ...baseDeps.models,
        getTorrentsBySubscription: () => [{ hash: "abc" }],
        getEpisodesBySubscription: () => [{ torrent_hash: "def" }],
      },
    };
    const res = await actions.deleteSubscriptionWithCleanup(
      {
        id: 1,
        media_type: "tv",
        folder_path: "/media/Show",
      } as any,
      { deleteFilesOnDisk: true },
      deps as any
    );
    expect(res.ok).toBe(true);
  });
});
