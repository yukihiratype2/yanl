import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

process.env.NAS_TOOLS_DB_PATH = ":memory:";

const monitorMock = () => ({
  startMonitor: () => {},
  getJobStatuses: () => [],
  runJobNow: async () => true,
});
mock.module(modulePath("../src/services/monitor"), monitorMock);
mock.module("../services/monitor", monitorMock);

const settingsMock = () => ({
  getSetting: () => "token",
  getAllSettings: () => ({ api_token: "token" }),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

mock.module(modulePath("../src/services/logger"), () => ({
  logger: {
    info: () => {},
    trace: () => {},
  },
  reconfigureLogger: () => ({
    info: () => {},
    trace: () => {},
  }),
}));

const appModule = await import("../src/index?test=index");

describe("index", () => {
  it("serves health endpoint", async () => {
    const res = await appModule.default.fetch(new Request("http://localhost/health"));
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
