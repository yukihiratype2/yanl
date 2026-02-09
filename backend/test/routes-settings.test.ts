import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

const setSettingsCalls: Array<Record<string, string>> = [];
let tokenValue = "secret";

const settingsMock = () => ({
  getAllSettings: () => ({ api_token: "secret", log_dir: "/tmp" }),
  setSettings: (values: Record<string, string>) => {
    setSettingsCalls.push(values);
  },
  getSetting: () => tokenValue,
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

let aiShouldThrow = false;
const aiMock = () => ({
  testAIConfig: async () => {
    if (aiShouldThrow) throw new Error("ai failed");
    return "ok";
  },
  parseTorrentTitles: async () => [{ englishTitle: "Mocked" }],
});
mock.module(modulePath("../src/services/ai"), aiMock);
mock.module("../services/ai", aiMock);

const loggerCalls: string[] = [];
const loggerMock = () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  reconfigureLogger: () => {
    loggerCalls.push("reconfigure");
    return { info: () => {} };
  },
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

let qbitTestResponse: any = { ok: true };
let qbitPathMapSanityResponse: any = {
  ok: true,
  message: "Folder map sanity check passed.",
  summary: {
    checkedDirs: 1,
    checkedTorrents: 1,
    passCount: 2,
    warnCount: 0,
    failCount: 0,
  },
  checks: [],
};
const qbitMock = () => ({
  qbittorrent: {
    testConnection: async () => qbitTestResponse,
    sanityCheckPathMap: async () => qbitPathMapSanityResponse,
    mapQbitPathToLocal: (path: string) => path,
    getTorrents: async () => [],
    deleteTorrents: async () => true,
    getManagedQbitTags: () => new Set<string>(),
    getManagedQbitTorrents: async () => [],
    hasManagedQbitTag: () => false,
    isDownloadComplete: () => false,
    cleanupQbitTorrent: async () => {},
  },
});
mock.module(modulePath("../src/services/qbittorrent"), qbitMock);
mock.module("../services/qbittorrent", qbitMock);

const routes = await import("../src/routes/settings?test=routes-settings");

describe("routes/settings", () => {
  beforeEach(() => {
    setSettingsCalls.length = 0;
    loggerCalls.length = 0;
    aiShouldThrow = false;
    tokenValue = "secret";
    qbitTestResponse = { ok: true };
    qbitPathMapSanityResponse = {
      ok: true,
      message: "Folder map sanity check passed.",
      summary: {
        checkedDirs: 1,
        checkedTorrents: 1,
        passCount: 2,
        warnCount: 0,
        failCount: 0,
      },
      checks: [],
    };
  });

  it("returns settings without api_token", async () => {
    const res = await routes.default.request("/", { method: "GET" });
    const body = await res.json();
    expect(body.api_token).toBeUndefined();
    expect(body.log_dir).toBe("/tmp");
  });

  it("updates settings, strips api_token, and reconfigures logger", async () => {
    const res = await routes.default.request("/", {
      method: "PUT",
      body: JSON.stringify({ api_token: "new-secret", log_level: "debug" }),
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(setSettingsCalls[0]).toEqual({ log_level: "debug" });
    expect(loggerCalls.length).toBe(1);
  });

  it("returns token from /token", async () => {
    tokenValue = "abc123";
    const res = await routes.default.request("/token", { method: "GET" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ token: "abc123" });
  });

  it("passes through /test-qbit result", async () => {
    qbitTestResponse = { ok: true, version: "4.6.0" };
    const res = await routes.default.request("/test-qbit", { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, version: "4.6.0" });
  });

  it("passes through /test-qbit-path-map result", async () => {
    qbitPathMapSanityResponse = {
      ok: true,
      message: "Folder map sanity check passed.",
      summary: {
        checkedDirs: 2,
        checkedTorrents: 3,
        passCount: 4,
        warnCount: 1,
        failCount: 0,
      },
      checks: [
        {
          scope: "download_dir",
          status: "pass",
          reason: "mapped_path_exists",
          mediaType: "tv",
          sourcePath: "/downloads/tv",
          mappedPath: "/mnt/downloads/tv",
        },
      ],
    };

    const res = await routes.default.request("/test-qbit-path-map", { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(qbitPathMapSanityResponse);
  });

  it("returns failure payload from /test-qbit-path-map", async () => {
    qbitPathMapSanityResponse = {
      ok: false,
      message: "Folder map sanity check failed.",
      summary: {
        checkedDirs: 0,
        checkedTorrents: 0,
        passCount: 0,
        warnCount: 0,
        failCount: 0,
      },
      checks: [],
      error: "qBittorrent login failed",
    };

    const res = await routes.default.request("/test-qbit-path-map", { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("qBittorrent login failed");
    expect(body.summary).toEqual({
      checkedDirs: 0,
      checkedTorrents: 0,
      passCount: 0,
      warnCount: 0,
      failCount: 0,
    });
    expect(body.checks).toEqual([]);
  });

  it("tests ai config", async () => {
    const res = await routes.default.request("/ai/test", { method: "POST" });
    const body = await res.json();
    expect(body.response).toBe("ok");
  });

  it("maps ai test failure to 500", async () => {
    aiShouldThrow = true;
    const res = await routes.default.request("/ai/test", { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain("ai failed");
  });

  it("returns 400 for malformed JSON on PUT /", async () => {
    const res = await routes.default.request("/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid qbit_path_map payload", async () => {
    const res = await routes.default.request("/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qbit_path_map: JSON.stringify([{ from: "relative/path", to: "/local" }]),
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.field).toBe("qbit_path_map");
    expect(body.error).toContain("absolute paths");
  });

  it("returns 400 for duplicate qbit_path_map from paths", async () => {
    const res = await routes.default.request("/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qbit_path_map: JSON.stringify([
          { from: "/downloads", to: "/mnt/downloads" },
          { from: "/downloads/", to: "/media/downloads" },
        ]),
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.field).toBe("qbit_path_map");
    expect(body.error).toContain("duplicate from path");
  });
});
