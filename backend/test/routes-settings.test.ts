import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const settingsMock = () => ({
  getAllSettings: () => ({ api_token: "secret", log_dir: "/tmp" }),
  setSettings: () => {},
  getSetting: () => "secret",
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

const aiMock = () => ({
  testAIConfig: async () => "ok",
});
mock.module(modulePath("../src/services/ai"), aiMock);
mock.module("../services/ai", aiMock);

const loggerMock = () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  reconfigureLogger: () => ({ info: () => {} }),
});

mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

const qbitMock = () => ({
  testConnection: async () => ({ ok: true }),
  mapQbitPathToLocal: (path: string) => path,
  getTorrents: async () => [],
  deleteTorrents: async () => true,
});
mock.module(modulePath("../src/services/qbittorrent"), qbitMock);
mock.module("../services/qbittorrent", qbitMock);

const routes = await import("../src/routes/settings?test=routes-settings");

describe("routes/settings", () => {
  it("returns settings without api_token", async () => {
    const res = await routes.default.request("/", { method: "GET" });
    const body = await res.json();
    expect(body.api_token).toBeUndefined();
    expect(body.log_dir).toBe("/tmp");
  });

  it("tests ai config", async () => {
    const res = await routes.default.request("/ai/test", { method: "POST" });
    const body = await res.json();
    expect(body.response).toBe("ok");
  });
});
