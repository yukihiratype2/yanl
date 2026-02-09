import { describe, expect, it } from "bun:test";
import { matchesProfile, matchesEpisodeSeason, isTitleMatch } from "../src/services/monitor/matchers";
import type { RSSItem } from "../src/services/rss";
import type { Profile, Subscription, Episode } from "../src/db/models";

const baseItem: RSSItem = {
  title: "Show 1080p WEB-DL",
  link: "magnet:?xt=urn:btih:abc",
  source: "mikan",
};

describe("monitor/matchers", () => {
  it("matches title by parsed english/chinese", () => {
    expect(isTitleMatch("Show", { englishTitle: "Show" })).toBe(true);
    expect(
      isTitleMatch("Show", { englishTitle: "Other", chineseTitle: "标题" })
    ).toBe(false);
  });

  it("filters by profile rules", () => {
    const profile: Profile = {
      id: 1,
      name: "P",
      description: null,
      resolutions: JSON.stringify(["1080p"]),
      qualities: JSON.stringify(["webdl"]),
      formats: null,
      encoders: null,
      min_size_mb: 100,
      max_size_mb: 5000,
      preferred_keywords: JSON.stringify(["show"]),
      excluded_keywords: JSON.stringify(["bad"]),
      is_default: 0,
      created_at: "",
      updated_at: "",
    };

    const item = {
      ...baseItem,
      ai: { resolution: "1080p", format: "WEB-DL", size: "1.5GB" },
    } as RSSItem;

    const ok = matchesProfile(item, profile);
    expect(ok.ok).toBe(true);

    const bad = matchesProfile(
      { ...item, title: "bad release" } as RSSItem,
      profile
    );
    expect(bad.ok).toBe(false);
  });

  it("matches episode and season", () => {
    const sub: Subscription = {
      id: 1,
      source: "tvdb",
      source_id: 1,
      media_type: "tv",
      title: "Show",
      title_original: null,
      overview: null,
      poster_path: null,
      backdrop_path: null,
      first_air_date: null,
      vote_average: null,
      season_number: 1,
      total_episodes: null,
      status: "active",
      folder_path: null,
      profile_id: null,
      created_at: "",
      updated_at: "",
    };
    const ep: Episode = {
      id: 1,
      subscription_id: 1,
      season_number: 1,
      episode_number: 2,
      title: null,
      air_date: null,
      overview: null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
      created_at: "",
      updated_at: "",
    };

    const match = matchesEpisodeSeason(sub, ep, {
      episodeNumber: 2,
      seasonNumber: 1,
    });
    expect(match.ok).toBe(true);
  });
});
