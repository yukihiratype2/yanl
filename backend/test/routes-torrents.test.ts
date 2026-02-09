import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const rssCalls: Array<{ keyword: string; opts?: any }> = [];
let rssShouldFail = false;

const rssMock = () => ({
  searchTorrents: async (keyword: string, opts?: any) => {
    rssCalls.push({ keyword, opts });
    if (rssShouldFail) throw new Error("rss down");
    return [{ title: "A" }];
  },
});
mock.module(modulePath("../src/services/rss"), rssMock);
mock.module("../services/rss", rssMock);

let qbitShouldFail: "pause" | "resume" | "delete" | null = null;
const qbitCalls = {
  pause: [] as string[][],
  resume: [] as string[][],
  delete: [] as Array<{ hashes: string[]; deleteFiles: boolean }>,
};

const qbitMock = () => ({
  pauseTorrents: async (hashes: string[]) => {
    qbitCalls.pause.push(hashes);
    if (qbitShouldFail === "pause") throw new Error("pause failed");
    return true;
  },
  resumeTorrents: async (hashes: string[]) => {
    qbitCalls.resume.push(hashes);
    if (qbitShouldFail === "resume") throw new Error("resume failed");
    return true;
  },
  deleteTorrents: async (hashes: string[], deleteFiles: boolean) => {
    qbitCalls.delete.push({ hashes, deleteFiles });
    if (qbitShouldFail === "delete") throw new Error("delete failed");
    return true;
  },
  testConnection: async () => ({ ok: true }),
  getTorrents: async () => [],
  mapQbitPathToLocal: (path: string) => path,
  getManagedQbitTags: () => new Set<string>(),
  getManagedQbitTorrents: async () => [],
  hasManagedQbitTag: () => false,
  isDownloadComplete: () => false,
  cleanupQbitTorrent: async () => {},
});
mock.module(modulePath("../src/services/qbittorrent"), qbitMock);
mock.module("../services/qbittorrent", qbitMock);

const downloadCalls: any[] = [];
let downloadShouldFail = false;

const usecasesMock = () => ({
  downloadTorrent: async (payload: any) => {
    downloadCalls.push(payload);
    if (downloadShouldFail) return { ok: false, error: "bad request", status: 422 };
    return { ok: true, data: { id: 1 } };
  },
});
mock.module(modulePath("../src/usecases/torrents"), usecasesMock);
mock.module("../usecases/torrents", usecasesMock);

const routes = await import("../src/routes/torrents?test=routes-torrents");

describe("routes/torrents", () => {
  beforeEach(() => {
    rssCalls.length = 0;
    qbitCalls.pause.length = 0;
    qbitCalls.resume.length = 0;
    qbitCalls.delete.length = 0;
    downloadCalls.length = 0;
    rssShouldFail = false;
    qbitShouldFail = null;
    downloadShouldFail = false;
  });

  it("returns 400 when /search query is missing", async () => {
    const res = await routes.default.request("/search");
    expect(res.status).toBe(400);
  });

  it("searches torrents", async () => {
    const res = await routes.default.request("/search?q=test&season=2&episode=3");
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(rssCalls[0]).toEqual({
      keyword: "test",
      opts: { season: "2", episode: "3" },
    });
  });

  it("maps rss errors on /search", async () => {
    rssShouldFail = true;
    const res = await routes.default.request("/search?q=test");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain("rss down");
  });

  it("downloads torrent", async () => {
    const payload = {
      subscription_id: 1,
      title: "A",
      link: "magnet:?xt=urn:btih:abc",
      source: "rss",
    };
    const res = await routes.default.request("/download", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.id).toBe(1);
    expect(downloadCalls[0]).toEqual(payload);
  });

  it("returns usecase error status for download", async () => {
    downloadShouldFail = true;
    const res = await routes.default.request("/download", {
      method: "POST",
      body: JSON.stringify({
        subscription_id: 1,
        title: "A",
        link: "magnet:?xt=urn:btih:abc",
        source: "rss",
      }),
    });
    expect(res.status).toBe(422);
  });

  it("pauses torrents and validates input", async () => {
    const bad = await routes.default.request("/pause", {
      method: "POST",
      body: JSON.stringify({ hashes: [] }),
    });
    expect(bad.status).toBe(400);

    const ok = await routes.default.request("/pause", {
      method: "POST",
      body: JSON.stringify({ hashes: ["a", "b"] }),
    });
    const body = await ok.json();
    expect(ok.status).toBe(200);
    expect(body.success).toBe(true);
    expect(qbitCalls.pause[0]).toEqual(["a", "b"]);
  });

  it("maps pause errors", async () => {
    qbitShouldFail = "pause";
    const res = await routes.default.request("/pause", {
      method: "POST",
      body: JSON.stringify({ hashes: ["x"] }),
    });
    expect(res.status).toBe(500);
  });

  it("resumes torrents and maps errors", async () => {
    const ok = await routes.default.request("/resume", {
      method: "POST",
      body: JSON.stringify({ hashes: ["x"] }),
    });
    expect(ok.status).toBe(200);
    expect(qbitCalls.resume[0]).toEqual(["x"]);

    qbitShouldFail = "resume";
    const bad = await routes.default.request("/resume", {
      method: "POST",
      body: JSON.stringify({ hashes: ["x"] }),
    });
    expect(bad.status).toBe(500);
  });

  it("deletes torrents, validates input, and forwards deleteFiles", async () => {
    const bad = await routes.default.request("/delete", {
      method: "POST",
      body: JSON.stringify({ hashes: [] }),
    });
    expect(bad.status).toBe(400);

    const ok = await routes.default.request("/delete", {
      method: "POST",
      body: JSON.stringify({ hashes: ["x"], deleteFiles: true }),
    });
    expect(ok.status).toBe(200);
    expect(qbitCalls.delete[0]).toEqual({ hashes: ["x"], deleteFiles: true });
  });

  it("maps delete errors", async () => {
    qbitShouldFail = "delete";
    const res = await routes.default.request("/delete", {
      method: "POST",
      body: JSON.stringify({ hashes: ["x"] }),
    });
    expect(res.status).toBe(500);
  });

  it("returns 400 for malformed JSON bodies", async () => {
    const malformedDownload = await routes.default.request("/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{oops",
    });
    expect(malformedDownload.status).toBe(400);

    const malformedPause = await routes.default.request("/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{oops",
    });
    expect(malformedPause.status).toBe(400);

    const malformedResume = await routes.default.request("/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{oops",
    });
    expect(malformedResume.status).toBe(400);

    const malformedDelete = await routes.default.request("/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{oops",
    });
    expect(malformedDelete.status).toBe(400);
  });

  it("returns 400 for wrong hashes type", async () => {
    const pause = await routes.default.request("/pause", {
      method: "POST",
      body: JSON.stringify({ hashes: "abc" }),
    });
    expect(pause.status).toBe(400);

    const resume = await routes.default.request("/resume", {
      method: "POST",
      body: JSON.stringify({ hashes: "abc" }),
    });
    expect(resume.status).toBe(400);

    const del = await routes.default.request("/delete", {
      method: "POST",
      body: JSON.stringify({ hashes: "abc", deleteFiles: "true" }),
    });
    expect(del.status).toBe(400);
  });

  it("returns 400 when /download is missing required fields", async () => {
    const res = await routes.default.request("/download", {
      method: "POST",
      body: JSON.stringify({ title: "Missing fields" }),
    });
    expect(res.status).toBe(400);
  });
});
