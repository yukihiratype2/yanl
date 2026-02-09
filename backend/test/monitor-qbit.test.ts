import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const deleteCalls: any[] = [];
const getCalls: any[] = [];

const settingsMock = () => ({
  getSetting: (key: string) => (key === "qbit_tag" ? "nas,extra" : ""),
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

const qbitMock = () => ({
  getTorrents: async (options?: any) => {
    getCalls.push(options);
    if (options?.tag === "nas") {
      return [{ hash: "abc", tags: "nas" }];
    }
    if (options?.tag === "extra") {
      return [{ hash: "ABC", tags: "extra" }];
    }
    return [{ hash: "xyz", tags: "" }];
  },
  deleteTorrents: async (hash: string) => {
    deleteCalls.push(hash);
    return true;
  },
  mapQbitPathToLocal: (path: string) => path,
});
mock.module(modulePath("../src/services/qbittorrent"), qbitMock);
mock.module("../qbittorrent", qbitMock);

const loggerMock = () => ({
  logger: {
    info: () => {},
    warn: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../logger", loggerMock);

const qbit = await import("../src/services/monitor/qbit?test=monitor-qbit");

describe("monitor/qbit", () => {
  it("dedupes managed torrents", async () => {
    const torrents = await qbit.getManagedQbitTorrents();
    expect(torrents.length).toBe(1);
    expect(getCalls.length).toBe(2);
  });

  it("cleans up stopped torrents", async () => {
    await qbit.cleanupQbitTorrent(
      { hash: "abc", tags: "nas", state: "pausedUP", progress: 1 } as any,
      new Set(["nas"]),
      { ctx: true }
    );
    expect(deleteCalls.length).toBe(1);
  });
});
