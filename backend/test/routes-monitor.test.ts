import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const monitorMock = () => ({
  getJobStatuses: () => [{ name: "job" }],
  runJobNow: async (name: string) => name === "job",
  startMonitor: () => {},
});
mock.module(modulePath("../src/services/monitor"), monitorMock);
mock.module("../services/monitor", monitorMock);

const routes = await import("../src/routes/monitor?test=routes-monitor");

describe("routes/monitor", () => {
  it("lists jobs", async () => {
    const res = await routes.default.request("/jobs");
    const body = await res.json();
    expect(body.jobs.length).toBe(1);
  });

  it("runs job", async () => {
    const res = await routes.default.request("/jobs/job/run", { method: "POST" });
    expect(res.status).toBe(200);
  });
});
