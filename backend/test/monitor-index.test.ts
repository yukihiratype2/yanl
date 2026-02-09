import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

const jobsMock = () => ({
  getJobStatuses: () => [],
  runJobNow: async () => true,
  startMonitor: () => {},
});
mock.module(modulePath("../src/services/monitor/jobs"), jobsMock);
mock.module("./monitor/jobs", jobsMock);

const monitor = await import("../src/services/monitor?test=monitor-index");

describe("services/monitor", () => {
  it("reexports monitor functions", () => {
    expect(typeof monitor.getJobStatuses).toBe("function");
    expect(typeof monitor.runJobNow).toBe("function");
    expect(typeof monitor.startMonitor).toBe("function");
  });
});
