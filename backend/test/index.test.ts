import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

process.env.NAS_TOOLS_DB_PATH = ":memory:";
process.env.NAS_TOOLS_SKIP_DATE_BACKFILL = "1";

const monitorMock = () => ({
  startMonitor: () => {},
  getJobStatuses: () => [],
  runJobNow: async () => true,
});
mock.module(modulePath("../src/services/monitor"), monitorMock);
mock.module("../services/monitor", monitorMock);

mock.module(modulePath("../src/db"), () => ({
  initDatabase: () => {},
}));
mock.module("../db", () => ({
  initDatabase: () => {},
}));

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
    error: () => {},
  },
  reconfigureLogger: () => ({
    info: () => {},
    trace: () => {},
    error: () => {},
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
