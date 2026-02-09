import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { makeJsonResponse, mockFetch } from "./helpers";
import { modulePath } from "./mockPath";

const settingsMock = () => ({
  getSetting: (key: string) => (key === "tmdb_token" ? "token" : ""),
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

const tmdb = await import("../src/services/tmdb?test=tmdb");

describe("services/tmdb", () => {
  it("calls TMDB with bearer token", async () => {
    const { calls } = mockFetch(() =>
      makeJsonResponse({ page: 1, results: [], total_pages: 1, total_results: 0 })
    );

    await tmdb.searchMulti("test", 2);
    const call = calls[0];
    expect(String(call.input)).toContain("/search/multi");
    expect((call.init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer token"
    );
  });

  it("resolves TV by TVDB id through TMDB find endpoint", async () => {
    const { calls } = mockFetch(() =>
      makeJsonResponse({ tv_results: [{ id: 321, name: "Show" }] })
    );

    const result = await tmdb.findTVByTvdbId(123);
    expect(result?.id).toBe(321);
    expect(String(calls[0].input)).toContain("/find/123");
    expect(String(calls[0].input)).toContain("external_source=tvdb_id");
  });
});
