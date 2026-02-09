import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const settings: Record<string, string> = {};
const settingsMock = () => ({
  getSetting: (key: string) => settings[key] ?? "",
  getAllSettings: () => settings,
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

let notifactions: Array<{ enabled: boolean }> = [];
const configMock = () => ({
  loadConfig: () => ({ notifactions }),
});
mock.module(modulePath("../src/config"), configMock);
mock.module("../config", configMock);

const loggerMock = () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("./logger", loggerMock);
mock.module("../services/logger", loggerMock);

async function loadService() {
  return import(
    `../src/services/integration-health?test=integration-health-${Date.now()}-${Math.random()}`
  );
}

describe("services/integration-health", () => {
  beforeEach(() => {
    for (const key of Object.keys(settings)) {
      delete settings[key];
    }
    notifactions = [];
  });

  it("starts in not_used status and passive schedule mode", async () => {
    const service = await loadService();
    service.startIntegrationHealthMonitor();

    const statuses = service.getIntegrationStatuses();
    expect(statuses.length).toBe(7);
    expect(statuses.every((status: any) => status.status === "not_used")).toBe(true);
    expect(statuses.every((status: any) => status.checkedAt === null)).toBe(true);
    expect(statuses.every((status: any) => status.schedule === "Passive (on usage)")).toBe(true);
    expect(statuses.every((status: any) => status.testSupported === false)).toBe(true);
  });

  it("tracks failure and reason until next success", async () => {
    const service = await loadService();

    service.reportIntegrationFailure("qbit", new Error("Connection refused"));
    const afterFailure = service.getIntegrationStatuses().find((item: any) => item.key === "qbit");
    expect(afterFailure?.status).toBe("error");
    expect(afterFailure?.message).toContain("Connection refused");
    expect(typeof afterFailure?.checkedAt).toBe("string");

    service.reportIntegrationSuccess("qbit", "Connected");
    const afterSuccess = service.getIntegrationStatuses().find((item: any) => item.key === "qbit");
    expect(afterSuccess?.status).toBe("ok");
    expect(afterSuccess?.message).toBe("Connected");
  });

  it("returns manual_disabled for known integration checks", async () => {
    const service = await loadService();
    const result = await service.runIntegrationCheck("qbit");
    expect(result).toEqual({ ok: false, reason: "manual_disabled" });
  });

  it("returns not_found for unknown integration checks", async () => {
    const service = await loadService();
    const result = await service.runIntegrationCheck("unknown");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports configured state from settings/config", async () => {
    settings.qbit_url = "";
    settings.ai_api_url = "https://ai.example.com";
    settings.ai_api_token = "";
    settings.ai_model = "gpt";
    settings.tmdb_token = "";
    notifactions = [{ enabled: false }];

    const service = await loadService();
    const statuses = service.getIntegrationStatuses();
    const qbit = statuses.find((item: any) => item.key === "qbit");
    const ai = statuses.find((item: any) => item.key === "ai");
    const tmdb = statuses.find((item: any) => item.key === "tmdb");
    const notifaction = statuses.find((item: any) => item.key === "notifaction");
    const mikan = statuses.find((item: any) => item.key === "mikan");

    expect(qbit?.configured).toBe(false);
    expect(ai?.configured).toBe(false);
    expect(tmdb?.configured).toBe(false);
    expect(notifaction?.configured).toBe(false);
    expect(mikan?.configured).toBe(true);
  });
});
