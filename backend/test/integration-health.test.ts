import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const scheduled: Array<{ expr: string; fn: () => void }> = [];

mock.module("node-cron", () => ({
  default: {
    schedule: (expr: string, fn: () => void) => {
      scheduled.push({ expr, fn });
      return {
        start: () => {},
        stop: () => {},
        getNextRun: () => new Date("2024-01-01T00:00:00.000Z"),
      };
    },
  },
}));

const settings: Record<string, string> = {};
const settingsMock = () => ({
  getSetting: (key: string) => settings[key] ?? "",
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

let qbitCalls = 0;
let qbitResult: Promise<{ ok: boolean; version?: string; error?: string }> | {
  ok: boolean;
  version?: string;
  error?: string;
} = {
  ok: true,
  version: "4.6.0",
};
const qbittorrentMock = () => ({
  testConnection: async () => {
    qbitCalls += 1;
    return await qbitResult;
  },
});
mock.module(modulePath("../src/services/qbittorrent"), qbittorrentMock);
mock.module("./qbittorrent", qbittorrentMock);

let aiCalls = 0;
let aiShouldThrow = false;
let aiResponse = "ok";
const aiMock = () => ({
  testAIConfig: async () => {
    aiCalls += 1;
    if (aiShouldThrow) throw new Error("ai down");
    return aiResponse;
  },
});
mock.module(modulePath("../src/services/ai"), aiMock);
mock.module("./ai", aiMock);

let tmdbCalls = 0;
let tmdbResult: { ok: boolean; error?: string } = { ok: true };
const tmdbMock = () => ({
  testTMDBConnection: async () => {
    tmdbCalls += 1;
    return tmdbResult;
  },
});
mock.module(modulePath("../src/services/tmdb"), tmdbMock);
mock.module("./tmdb", tmdbMock);

let bgmCalls = 0;
let bgmResult: { ok: boolean; error?: string } = { ok: true };
const bgmMock = () => ({
  testBGMConnection: async () => {
    bgmCalls += 1;
    return bgmResult;
  },
});
mock.module(modulePath("../src/services/bgm"), bgmMock);
mock.module("./bgm", bgmMock);

let mikanCalls = 0;
let dmhyCalls = 0;
let mikanResult: { ok: boolean; error?: string } = { ok: true };
let dmhyResult: { ok: boolean; error?: string } = { ok: true };
const rssMock = () => ({
  testMikanRSSConnection: async () => {
    mikanCalls += 1;
    return mikanResult;
  },
  testDmhyRSSConnection: async () => {
    dmhyCalls += 1;
    return dmhyResult;
  },
});
mock.module(modulePath("../src/services/rss"), rssMock);
mock.module("./rss", rssMock);

let notifReadinessCalls = 0;
let notifDeliveryCalls = 0;
let notifReadiness = {
  configured: true,
  enabledCount: 1,
  message: "1 enabled destination configured",
};
let notifDeliveryResult = {
  ok: true,
  total: 1,
  succeeded: 1,
  failed: 0,
  message: "Delivered test notification to 1/1 destinations",
};
const notifactionMock = () => ({
  getNotifactionReadiness: () => {
    notifReadinessCalls += 1;
    return notifReadiness;
  },
  testNotifactionDelivery: async () => {
    notifDeliveryCalls += 1;
    return notifDeliveryResult;
  },
  emitNotifactionEvent: () => {},
});
mock.module(modulePath("../src/services/notifaction"), notifactionMock);
mock.module("./notifaction", notifactionMock);

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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function loadService() {
  return import(
    `../src/services/integration-health?test=integration-health-${Date.now()}-${Math.random()}`
  );
}

describe("services/integration-health", () => {
  beforeEach(() => {
    scheduled.length = 0;

    for (const key of Object.keys(settings)) {
      delete settings[key];
    }
    settings.qbit_url = "http://qbit";
    settings.ai_api_url = "https://ai.example.com";
    settings.ai_api_token = "token";
    settings.ai_model = "gpt";
    settings.tmdb_token = "tmdb";

    qbitCalls = 0;
    qbitResult = { ok: true, version: "4.6.0" };

    aiCalls = 0;
    aiShouldThrow = false;
    aiResponse = "healthy";

    tmdbCalls = 0;
    tmdbResult = { ok: true };

    bgmCalls = 0;
    bgmResult = { ok: true };

    mikanCalls = 0;
    dmhyCalls = 0;
    mikanResult = { ok: true };
    dmhyResult = { ok: true };

    notifReadinessCalls = 0;
    notifDeliveryCalls = 0;
    notifReadiness = {
      configured: true,
      enabledCount: 1,
      message: "1 enabled destination configured",
    };
    notifDeliveryResult = {
      ok: true,
      total: 1,
      succeeded: 1,
      failed: 0,
      message: "Delivered test notification to 1/1 destinations",
    };
  });

  it("registers schedules and runs startup checks", async () => {
    const service = await loadService();
    service.startIntegrationHealthMonitor();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(scheduled.map((entry) => entry.expr)).toEqual([
      "0 * * * *",
      "0 */2 * * *",
      "0 3 * * *",
      "5 3 * * *",
      "10 3 * * *",
      "15 3 * * *",
      "20 * * * *",
    ]);

    const statuses = service.getIntegrationStatuses();
    expect(statuses.length).toBe(7);
    expect(statuses.every((status: any) => status.nextCheckAt === "2024-01-01T00:00:00.000Z")).toBe(true);
    expect(statuses.every((status: any) => status.status !== "unknown")).toBe(true);
    expect(notifDeliveryCalls).toBe(0);
  });

  it("returns not_found for unknown integration", async () => {
    const service = await loadService();
    const result = await service.runIntegrationCheck("unknown");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns already_running when same integration is in-flight", async () => {
    const gate = deferred<{ ok: boolean; version?: string; error?: string }>();
    qbitResult = gate.promise;

    const service = await loadService();
    const first = service.runIntegrationCheck("qbit");
    await Promise.resolve();
    const second = await service.runIntegrationCheck("qbit");

    expect(second).toEqual({ ok: false, reason: "already_running" });

    gate.resolve({ ok: true, version: "4.6.0" });
    const settled = await first;
    expect(settled.ok).toBe(true);
  });

  it("marks qBittorrent as not_configured and skips connectivity call", async () => {
    settings.qbit_url = "";

    const service = await loadService();
    const result = await service.runIntegrationCheck("qbit");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status.status).toBe("not_configured");
      expect(result.status.message).toBe("Not configured");
    }
    expect(qbitCalls).toBe(0);
  });

  it("maps qBittorrent connectivity errors", async () => {
    qbitResult = { ok: false, error: "qbit down" };

    const service = await loadService();
    const result = await service.runIntegrationCheck("qbit");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status.status).toBe("error");
      expect(result.status.message).toContain("qbit down");
    }
  });

  it("maps AI success and failure", async () => {
    const service = await loadService();

    const okResult = await service.runIntegrationCheck("ai");
    expect(okResult.ok).toBe(true);
    if (okResult.ok) {
      expect(okResult.status.status).toBe("ok");
      expect(okResult.status.message).toContain("Healthy");
    }

    aiShouldThrow = true;
    const failResult = await service.runIntegrationCheck("ai");
    expect(failResult.ok).toBe(true);
    if (failResult.ok) {
      expect(failResult.status.status).toBe("error");
      expect(failResult.status.message).toContain("ai down");
    }
  });

  it("maps TMDB, BGM, Mikan, and DMHY failures", async () => {
    tmdbResult = { ok: false, error: "tmdb down" };
    bgmResult = { ok: false, error: "bgm down" };
    mikanResult = { ok: false, error: "mikan down" };
    dmhyResult = { ok: false, error: "dmhy down" };

    const service = await loadService();

    const tmdb = await service.runIntegrationCheck("tmdb");
    const bgm = await service.runIntegrationCheck("bgm");
    const mikan = await service.runIntegrationCheck("mikan");
    const dmhy = await service.runIntegrationCheck("dmhy");

    expect(tmdb.ok).toBe(true);
    expect(bgm.ok).toBe(true);
    expect(mikan.ok).toBe(true);
    expect(dmhy.ok).toBe(true);

    if (tmdb.ok) expect(tmdb.status.status).toBe("error");
    if (bgm.ok) expect(bgm.status.status).toBe("error");
    if (mikan.ok) expect(mikan.status.status).toBe("error");
    if (dmhy.ok) expect(dmhy.status.status).toBe("error");
  });

  it("uses readiness for scheduled notification checks and delivery for manual checks", async () => {
    notifReadiness = {
      configured: true,
      enabledCount: 2,
      message: "2 enabled destinations configured",
    };
    notifDeliveryResult = {
      ok: false,
      total: 2,
      succeeded: 1,
      failed: 1,
      message: "Delivered test notification to 1/2; 1 failed",
    };

    const service = await loadService();

    service.startIntegrationHealthMonitor();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(notifReadinessCalls).toBe(1);
    expect(notifDeliveryCalls).toBe(0);

    const manual = await service.runIntegrationCheck("notifaction");
    expect(manual.ok).toBe(true);
    if (manual.ok) {
      expect(manual.status.status).toBe("error");
      expect(manual.status.message).toContain("1/2");
    }
    expect(notifDeliveryCalls).toBe(1);
  });
});
