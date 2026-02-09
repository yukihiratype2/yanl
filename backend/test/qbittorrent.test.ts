import { describe, expect, it, mock } from "bun:test";
import { makeTextResponse, mockFetch } from "./helpers";
import { modulePath } from "./mockPath";

const loggerMock = () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

const settingsMock = () => ({
  getSetting: (key: string) => {
    switch (key) {
      case "qbit_url":
        return "http://qbit";
      case "qbit_username":
        return "user";
      case "qbit_password":
        return "pass";
      case "qbit_tag":
        return "nas";
      case "qbit_path_map":
        return JSON.stringify([{ from: "/remote", to: "/local" }]);
      default:
        return "";
    }
  },
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

const qb = await import("../src/services/qbittorrent?test=qbittorrent");

describe("services/qbittorrent", () => {
  it("maps qbit paths", () => {
    const mapped = qb.mapQbitPathToLocal("/remote/show/file.mkv");
    expect(mapped).toBe("/local/show/file.mkv");
  });

  it("adds torrent and attaches tag", async () => {
    const { calls } = mockFetch((input, init) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("Ok.", {
          status: 200,
          headers: { "set-cookie": "SID=abc;" },
        });
      }
      if (url.includes("/api/v2/torrents/add")) {
        return makeTextResponse("", { status: 200 });
      }
      return makeTextResponse("", { status: 200 });
    });

    const ok = await qb.addTorrentByUrl("magnet:?xt=urn:btih:abc", {
      tags: "existing",
      savepath: "/downloads",
    });

    expect(ok).toBe(true);
    const addCall = calls.find((c) => String(c.input).includes("/torrents/add"));
    expect(String(addCall?.init?.body)).toContain("tags=existing%2Cnas");
  });
});
