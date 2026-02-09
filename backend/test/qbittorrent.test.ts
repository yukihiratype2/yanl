import { beforeEach, describe, expect, it, mock } from "bun:test";
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

const settings: Record<string, string> = {};

const settingsMock = () => ({
  getSetting: (key: string) => settings[key] ?? "",
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

async function loadQb() {
  return import(`../src/services/qbittorrent?test=qbittorrent-${Date.now()}-${Math.random()}`);
}

describe("services/qbittorrent", () => {
  beforeEach(() => {
    settings.qbit_url = "http://qbit";
    settings.qbit_username = "user";
    settings.qbit_password = "pass";
    settings.qbit_tag = "nas";
    settings.qbit_path_map = JSON.stringify([{ from: "/remote", to: "/local" }]);
  });

  it("maps qbit paths", async () => {
    const qb = await loadQb();
    const mapped = qb.mapQbitPathToLocal("/remote/show/file.mkv");
    expect(mapped).toBe("/local/show/file.mkv");
  });

  it("adds torrent and attaches tag", async () => {
    const qb = await loadQb();
    const { calls } = mockFetch((input) => {
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

  it("serializes explicit false booleans and zero limits when adding torrent", async () => {
    const qb = await loadQb();
    const { calls } = mockFetch((input) => {
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
      paused: false,
      autoTMM: false,
      upLimit: 0,
      dlLimit: 0,
    });
    expect(ok).toBe(true);

    const addCall = calls.find((c) => String(c.input).includes("/torrents/add"));
    const body = String(addCall?.init?.body);
    expect(body).toContain("paused=false");
    expect(body).toContain("autoTMM=false");
    expect(body).toContain("upLimit=0");
    expect(body).toContain("dlLimit=0");
  });

  it("returns empty map entries when qbit_path_map is malformed JSON", async () => {
    settings.qbit_path_map = "not-json";
    const qb = await loadQb();
    expect(qb.getQbitPathMap()).toEqual([]);
  });

  it("throws when login succeeds without SID and response is not Ok.", async () => {
    const qb = await loadQb();
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        return makeTextResponse("Fails.", { status: 200 });
      }
      return makeTextResponse("", { status: 200 });
    });
    await expect(qb.addTorrentByUrl("magnet:?xt=urn:btih:abc")).rejects.toThrow(
      "qBittorrent login failed: no SID returned"
    );
  });

  it("retries after 403 by re-authenticating and sends SID cookie", async () => {
    const qb = await loadQb();
    let loginCount = 0;
    const { calls } = mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        loginCount += 1;
        return new Response("Ok.", {
          status: 200,
          headers: { "set-cookie": `SID=s${loginCount};` },
        });
      }
      if (url.includes("/api/v2/torrents/info")) {
        if (loginCount === 1) return makeTextResponse("Forbidden", { status: 403 });
        return new Response("[]", { status: 200 });
      }
      return makeTextResponse("", { status: 200 });
    });

    const torrents = await qb.getTorrents();
    expect(torrents).toEqual([]);
    expect(loginCount).toBe(2);

    const infoCalls = calls.filter((c) =>
      String(c.input).includes("/api/v2/torrents/info")
    );
    expect(infoCalls.length).toBe(2);
    expect((infoCalls[1].init?.headers as Record<string, string>)?.Cookie).toBe("SID=s2");
  });

  it("surfaces failure when retry after 403 still returns non-ok", async () => {
    const qb = await loadQb();
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("Ok.", {
          status: 200,
          headers: { "set-cookie": "SID=abc;" },
        });
      }
      if (url.includes("/api/v2/torrents/info")) {
        return makeTextResponse("Forbidden", { status: 403 });
      }
      return makeTextResponse("", { status: 200 });
    });

    await expect(qb.getTorrents()).rejects.toThrow("Failed to get torrents: 403");
  });

  it("throws on network errors during request after successful login", async () => {
    const qb = await loadQb();
    let requestCount = 0;
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("Ok.", {
          status: 200,
          headers: { "set-cookie": "SID=abc;" },
        });
      }
      if (url.includes("/api/v2/torrents/stop")) {
        requestCount += 1;
        if (requestCount === 1) throw new Error("network down");
      }
      return makeTextResponse("", { status: 200 });
    });
    await expect(qb.pauseTorrents(["x"])).rejects.toThrow("network down");
  });

  it("encodes hash when requesting torrent files", async () => {
    const qb = await loadQb();
    const { calls } = mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("Ok.", {
          status: 200,
          headers: { "set-cookie": "SID=abc;" },
        });
      }
      if (url.includes("/api/v2/torrents/files")) {
        return new Response("[]", { status: 200 });
      }
      return makeTextResponse("", { status: 200 });
    });

    await qb.getTorrentFiles("a+b/c");
    const filesCall = calls.find((c) => String(c.input).includes("/api/v2/torrents/files"));
    expect(String(filesCall?.input)).toContain("hash=a%2Bb%2Fc");
  });

  it("fetches managed torrents by tag and dedupes by hash", async () => {
    settings.qbit_tag = "nas,extra";
    const qb = await loadQb();

    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("Ok.", {
          status: 200,
          headers: { "set-cookie": "SID=abc;" },
        });
      }
      if (url.includes("/api/v2/torrents/info?tag=nas")) {
        return new Response('[{"hash":"abc","tags":"nas"}]', { status: 200 });
      }
      if (url.includes("/api/v2/torrents/info?tag=extra")) {
        return new Response('[{"hash":"ABC","tags":"extra"}]', { status: 200 });
      }
      return new Response("[]", { status: 200 });
    });

    const torrents = await qb.getManagedQbitTorrents();
    expect(torrents.length).toBe(1);
    expect(torrents[0].hash.toLowerCase()).toBe("abc");
  });

  it("cleans up managed paused torrents only", async () => {
    const qb = await loadQb();
    const { calls } = mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/v2/auth/login")) {
        return new Response("Ok.", {
          status: 200,
          headers: { "set-cookie": "SID=abc;" },
        });
      }
      if (url.includes("/api/v2/torrents/delete")) {
        return makeTextResponse("", { status: 200 });
      }
      return makeTextResponse("", { status: 200 });
    });

    await qb.cleanupQbitTorrent(
      { hash: "abc", tags: "nas", state: "pausedUP" },
      new Set(["nas"]),
      { sub: "Show" }
    );
    await qb.cleanupQbitTorrent(
      { hash: "def", tags: "nas", state: "uploading" },
      new Set(["nas"]),
      { sub: "Show" }
    );
    await qb.cleanupQbitTorrent(
      { hash: "ghi", tags: "other", state: "pausedUP" },
      new Set(["nas"]),
      { sub: "Show" }
    );

    const deleteCalls = calls.filter((c) =>
      String(c.input).includes("/api/v2/torrents/delete")
    );
    expect(deleteCalls.length).toBe(1);
    expect(String(deleteCalls[0].init?.body)).toContain("hashes=abc");
  });
});
