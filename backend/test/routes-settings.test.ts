import { beforeEach, describe, expect, it, mock } from "bun:test";
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
const qbitMock = () => ({
  testConnection: async () => qbitTestResponse,
  mapQbitPathToLocal: (path: string) => path,
  getTorrents: async () => [],
  deleteTorrents: async () => true,
  getManagedQbitTags: () => new Set<string>(),
  getManagedQbitTorrents: async () => [],
  hasManagedQbitTag: () => false,
  isDownloadComplete: () => false,
  cleanupQbitTorrent: async () => {},
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
});
