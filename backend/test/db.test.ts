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
      source: "tvdb",
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
});
