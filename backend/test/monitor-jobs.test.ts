import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const scheduled: any[] = [];

mock.module("node-cron", () => ({
  default: {
    schedule: (expr: string, fn: () => void) => {
      scheduled.push({ expr, fn });
      return { start: () => {}, stop: () => {} };
    },
  },
}));

const loggerMock = () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../logger", loggerMock);

const discoveryMock = () => ({
  checkNewEpisodes: async () => {},
});
mock.module(modulePath("../src/services/monitor/discovery"), discoveryMock);
mock.module("./discovery", discoveryMock);

const downloadsMock = () => ({
  searchAndDownload: async () => {},
});
mock.module(modulePath("../src/services/monitor/downloads"), downloadsMock);
mock.module("./downloads", downloadsMock);

const monitorMock = () => ({
  monitorDownloads: async () => {},
});
mock.module(modulePath("../src/services/monitor/download-monitor"), monitorMock);
mock.module("./download-monitor", monitorMock);

const jobs = await import("../src/services/monitor/jobs?test=monitor-jobs");

describe("monitor/jobs", () => {
  it("registers jobs and exposes statuses", () => {
    jobs.startMonitor();
    const statuses = jobs.getJobStatuses();
    expect(statuses.length).toBe(3);
    expect(statuses[0].nextRunAt).toBeTruthy();
  });

  it("runs job by name", async () => {
    const ok = await jobs.runJobNow("searchAndDownload");
    expect(ok).toBe(true);
  });
});
