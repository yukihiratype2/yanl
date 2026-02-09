import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const loggerMock = () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

process.env.NAS_TOOLS_DB_PATH = ":memory:";
const dbModule = await import("../src/db/index");

dbModule.initDatabase();

const models = await import("../src/db/models?test=db");

describe("db/index", () => {
  it("creates core tables", () => {
    const rows = dbModule.default
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const names = rows.map((r) => r.name);
    expect(names).toContain("profiles");
    expect(names).toContain("subscriptions");
    expect(names).toContain("episodes");
    expect(names).toContain("torrents");
  });
});

describe("db/models", () => {
  it("creates and updates profiles", () => {
    const created = models.createProfile({
      name: "Default",
      description: null,
      resolutions: JSON.stringify(["1080p"]),
      qualities: null,
      formats: null,
      encoders: null,
      min_size_mb: null,
      max_size_mb: null,
      preferred_keywords: null,
      excluded_keywords: null,
      is_default: 1,
    });
    expect(created.id).toBeGreaterThan(0);
    models.setDefaultProfile(created.id);
    const current = models.getDefaultProfile();
    expect(current?.id).toBe(created.id);
  });

  it("creates subscriptions, episodes, torrents and queries", () => {
    const profile = models.createProfile({
      name: "Profile",
      description: null,
      resolutions: null,
      qualities: null,
      formats: null,
      encoders: null,
      min_size_mb: null,
      max_size_mb: null,
      preferred_keywords: null,
      excluded_keywords: null,
      is_default: 0,
    });
    const sub = models.createSubscription({
      source: "tmdb",
      source_id: 123,
      media_type: "tv",
      title: "Show",
      title_original: null,
      overview: null,
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2024-01-01",
      vote_average: 8.2,
      season_number: 1,
      total_episodes: 1,
      status: "active",
      folder_path: "/tmp/show",
      profile_id: profile.id,
    });
    const ep = models.createEpisode({
      subscription_id: sub.id,
      season_number: 1,
      episode_number: 1,
      title: "Pilot",
      air_date: "2024-01-01",
      overview: null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
    });
    const torrent = models.createTorrent({
      subscription_id: sub.id,
      episode_id: ep.id,
      title: "Show S01E01",
      link: "magnet:?xt=urn:btih:abc",
      hash: "abc",
      size: "123",
      source: "rss",
      status: "downloading",
      download_path: null,
    });

    expect(models.getSubscriptionById(sub.id)?.id).toBe(sub.id);
    expect(models.getEpisodesBySubscription(sub.id).length).toBe(1);
    expect(models.getTorrentsBySubscription(sub.id).length).toBe(1);
    expect(models.getTorrentByHash("abc")?.id).toBe(torrent.id);

    const calendar = models.getEpisodesWithAirDateRange("2024-01-01", "2024-01-02");
    expect(calendar.length).toBe(1);
  });

  it("backfills non-canonical dates and fails startup on remaining invalid values", () => {
    const sub = models.createSubscription({
      source: "tmdb",
      source_id: 999,
      media_type: "tv",
      title: "Backfill Show",
      title_original: null,
      overview: null,
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2024-01-01",
      vote_average: 7.5,
      season_number: 1,
      total_episodes: 2,
      status: "active",
      folder_path: "/tmp/backfill-show",
      profile_id: null,
    });
    const ep1 = models.createEpisode({
      subscription_id: sub.id,
      season_number: 1,
      episode_number: 1,
      title: "Ep1",
      air_date: "2024-01-01",
      overview: null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
    });
    const ep2 = models.createEpisode({
      subscription_id: sub.id,
      season_number: 1,
      episode_number: 2,
      title: "Ep2",
      air_date: "2024-01-01",
      overview: null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
    });

    dbModule.default
      .prepare("UPDATE subscriptions SET first_air_date = ? WHERE id = ?")
      .run("2024-1-2", sub.id);
    dbModule.default
      .prepare("UPDATE episodes SET air_date = ? WHERE id = ?")
      .run("2024-1-3", ep1.id);
    dbModule.default
      .prepare("UPDATE episodes SET air_date = ? WHERE id = ?")
      .run("bad-date", ep2.id);

    expect(() => dbModule.initDatabase()).toThrow("Database contains invalid date values");

    const firstPassSub = dbModule.default
      .prepare("SELECT first_air_date FROM subscriptions WHERE id = ?")
      .get(sub.id) as { first_air_date: string };
    const firstPassEps = dbModule.default
      .prepare("SELECT id, air_date FROM episodes WHERE id IN (?, ?) ORDER BY id ASC")
      .all(ep1.id, ep2.id) as Array<{ id: number; air_date: string }>;

    expect(firstPassSub.first_air_date).toBe("2024-01-02");
    expect(firstPassEps[0]?.air_date).toBe("2024-01-03");
    expect(firstPassEps[1]?.air_date).toBe("bad-date");
  });

  it("enforces canonical date-only values in model writes", () => {
    expect(() =>
      models.createSubscription({
        source: "tmdb",
        source_id: 1001,
        media_type: "tv",
        title: "Guarded Show",
        title_original: null,
        overview: null,
        poster_path: null,
        backdrop_path: null,
        first_air_date: "2024-1-2",
        vote_average: null,
        season_number: null,
        total_episodes: null,
        status: "active",
        folder_path: null,
        profile_id: null,
      })
    ).toThrow("first_air_date must be null or canonical YYYY-MM-DD");

    const sub = models.createSubscription({
      source: "tmdb",
      source_id: 1002,
      media_type: "tv",
      title: "Guarded Show 2",
      title_original: null,
      overview: null,
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2024-01-02",
      vote_average: null,
      season_number: null,
      total_episodes: null,
      status: "active",
      folder_path: null,
      profile_id: null,
    });
    expect(() =>
      models.updateSubscription(sub.id, { first_air_date: "2024-1-3" as any })
    ).toThrow("first_air_date must be null or canonical YYYY-MM-DD");

    expect(() =>
      models.createEpisode({
        subscription_id: sub.id,
        season_number: null,
        episode_number: 1,
        title: "Bad Date Ep",
        air_date: "2024-1-2",
        overview: null,
        still_path: null,
        status: "pending",
        torrent_hash: null,
        file_path: null,
      })
    ).toThrow("air_date must be null or canonical YYYY-MM-DD");

    const ep = models.createEpisode({
      subscription_id: sub.id,
      season_number: null,
      episode_number: 2,
      title: "Good Date Ep",
      air_date: "2024-01-02",
      overview: null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
    });
    expect(() =>
      models.updateEpisode(ep.id, { air_date: "2024-1-4" as any })
    ).toThrow("air_date must be null or canonical YYYY-MM-DD");
  });
});
