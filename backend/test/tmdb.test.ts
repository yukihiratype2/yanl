import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { makeJsonResponse, mockFetch } from "./helpers";
import { modulePath } from "./mockPath";

const loggerCalls: Array<{ level: string; args: any[] }> = [];
const loggerMock = () => ({
  logger: {
    debug: (...args: any[]) => loggerCalls.push({ level: "debug", args }),
    warn: (...args: any[]) => loggerCalls.push({ level: "warn", args }),
    error: (...args: any[]) => loggerCalls.push({ level: "error", args }),
    info: (...args: any[]) => loggerCalls.push({ level: "info", args }),
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

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
    loggerCalls.length = 0;
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
    loggerCalls.length = 0;
    const { calls } = mockFetch(() =>
      makeJsonResponse({ tv_results: [{ id: 321, name: "Show" }] })
    );

    const result = await tmdb.findTVByTvdbId(123);
    expect(result?.id).toBe(321);
    expect(String(calls[0].input)).toContain("/find/123");
    expect(String(calls[0].input)).toContain("external_source=tvdb_id");
  });

  it("emits structured failure logs with op and err", async () => {
    loggerCalls.length = 0;
    mockFetch(() => new Response("bad", { status: 500, statusText: "Server Error" }));

    await expect(tmdb.searchMulti("test", 1)).rejects.toThrow("TMDB API error");

    const errorLog = loggerCalls.find(
      (entry) =>
        entry.level === "error" &&
        entry.args[0]?.op === "integration.tmdb.request_error"
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog?.args[0]?.provider).toBe("tmdb");
    expect(errorLog?.args[0]?.err).toBeTruthy();
  });
});
