import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

process.env.NAS_TOOLS_DB_PATH = ":memory:";

const monitorMock = () => ({
  startMonitor: () => {},
  getJobStatuses: () => [],
  runJobNow: async () => true,
});
mock.module(modulePath("../src/services/monitor"), monitorMock);
mock.module("../services/monitor", monitorMock);

const integrationHealthMock = () => ({
  startIntegrationHealthMonitor: () => {},
  getIntegrationStatuses: () => [],
  runIntegrationCheck: async () => ({ ok: false, reason: "not_found" as const }),
  reportIntegrationSuccess: () => {},
  reportIntegrationFailure: () => {},
});
mock.module(modulePath("../src/services/integration-health"), integrationHealthMock);
mock.module("../services/integration-health", integrationHealthMock);

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
