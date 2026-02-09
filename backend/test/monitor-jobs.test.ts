import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.restore();
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

const loggerCalls: Array<{ level: string; args: any[] }> = [];
const loggerMock = () => ({
  logger: {
    info: (...args: any[]) => loggerCalls.push({ level: "info", args }),
    warn: (...args: any[]) => loggerCalls.push({ level: "warn", args }),
    error: (...args: any[]) => loggerCalls.push({ level: "error", args }),
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../logger", loggerMock);

let checkNewEpisodesImpl: () => Promise<void> = async () => {};
let searchAndDownloadImpl: () => Promise<void> = async () => {};
let monitorDownloadsImpl: () => Promise<void> = async () => {};

const discoveryMock = () => ({
  checkNewEpisodes: () => checkNewEpisodesImpl(),
});
mock.module(modulePath("../src/services/monitor/discovery"), discoveryMock);
mock.module("./discovery", discoveryMock);

const downloadsMock = () => ({
  searchAndDownload: () => searchAndDownloadImpl(),
});
mock.module(modulePath("../src/services/monitor/downloads"), downloadsMock);
mock.module("./downloads", downloadsMock);

const monitorMock = () => ({
  monitorDownloads: () => monitorDownloadsImpl(),
});
mock.module(modulePath("../src/services/monitor/download-monitor"), monitorMock);
mock.module("./download-monitor", monitorMock);

async function loadJobs() {
  return import(`../src/services/monitor/jobs?test=monitor-jobs-${Date.now()}-${Math.random()}`);
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("monitor/jobs", () => {
  beforeEach(() => {
    scheduled.length = 0;
    loggerCalls.length = 0;
    checkNewEpisodesImpl = async () => {};
    searchAndDownloadImpl = async () => {};
    monitorDownloadsImpl = async () => {};
  });

  it("registers jobs and exposes statuses with nextRunAt field", async () => {
    const jobs = await loadJobs();
    jobs.startMonitor();
    const statuses = jobs.getJobStatuses();
    expect(statuses.length).toBe(3);
    for (const status of statuses) {
      expect(status.nextRunAt).toBe("2024-01-01T00:00:00.000Z");
    }
  });

  it("returns false for unknown job names", async () => {
    const jobs = await loadJobs();
    jobs.startMonitor();
    const ok = await jobs.runJobNow("unknown");
    expect(ok).toBe(false);
  });

  it("does not re-enter the same job when it is already running", async () => {
    const jobs = await loadJobs();
    const gate = deferred<void>();
    let runs = 0;
    searchAndDownloadImpl = async () => {
      runs += 1;
      await gate.promise;
    };

    jobs.startMonitor();

    // Trigger first run.
    await jobs.runJobNow("searchAndDownload");
    // Trigger second run while first is still in-flight.
    await jobs.runJobNow("searchAndDownload");
    await Promise.resolve();

    expect(runs).toBe(1);
    const warned = loggerCalls.some((c) => c.level === "warn");
    expect(warned).toBe(true);

    gate.resolve();
  });

  it("records lastRunError and resets running state when job fails", async () => {
    const jobs = await loadJobs();
    searchAndDownloadImpl = async () => {
      throw new Error("boom");
    };
    jobs.startMonitor();

    const ok = await jobs.runJobNow("searchAndDownload");
    expect(ok).toBe(true);

    // runJobNow is fire-and-forget; allow internal job promise to settle.
    await new Promise((r) => setTimeout(r, 0));

    const statuses = jobs.getJobStatuses();
    const target = statuses.find((s) => s.name === "searchAndDownload");
    expect(target).toBeTruthy();
    expect(target?.running).toBe(false);
    expect(target?.lastRunError).toContain("boom");
  });
});
