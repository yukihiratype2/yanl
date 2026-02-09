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

const infoCalls: any[] = [];
const traceCalls: any[] = [];
const errorCalls: any[] = [];
mock.module(modulePath("../src/services/logger"), () => ({
  logger: {
    info: (...args: any[]) => infoCalls.push(args),
    trace: (...args: any[]) => traceCalls.push(args),
    error: (...args: any[]) => errorCalls.push(args),
  },
  createRequestId: (incoming?: string | null) =>
    incoming && incoming.startsWith("req-") ? incoming : "req-generated-12345678",
  maskToken: (token?: string | null) => (token ? `***${token.slice(-4)}` : "(empty)"),
  withLogContext: (_context: Record<string, unknown>, fn: () => unknown) => fn(),
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
    expect(res.headers.get("X-Request-Id")).toBe("req-generated-12345678");
  });

  it("echoes incoming X-Request-Id", async () => {
    const res = await appModule.default.fetch(
      new Request("http://localhost/health", {
        headers: { "x-request-id": "req-client-12345678" },
      })
    );
    expect(res.headers.get("X-Request-Id")).toBe("req-client-12345678");
  });

  it("logs masked startup token", () => {
    const tokenLog = infoCalls.find((args) => args[0]?.op === "auth.token_loaded");
    expect(tokenLog).toBeTruthy();
    expect(tokenLog[0].maskedApiToken).toBe("***oken");
    expect(JSON.stringify(tokenLog)).not.toContain("API Token: token");
  });
});
