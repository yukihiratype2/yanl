import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const tmdbCalls: Array<{ fn: string; args: any[] }> = [];
let failTmdb = false;

const tmdbMock = () => ({
  searchMulti: async (query: string, page: number) => {
    tmdbCalls.push({ fn: "searchMulti", args: [query, page] });
    if (failTmdb) throw new Error("tmdb failed");
    return { page, results: [{ id: 11 }], total_pages: 1, total_results: 1 };
  },
  searchTV: async (query: string, page: number) => {
    tmdbCalls.push({ fn: "searchTV", args: [query, page] });
    if (failTmdb) throw new Error("tmdb failed");
    return { page, results: [{ id: 21 }], total_pages: 1, total_results: 1 };
  },
  searchMovie: async (query: string, page: number) => {
    tmdbCalls.push({ fn: "searchMovie", args: [query, page] });
    if (failTmdb) throw new Error("tmdb failed");
    return { page, results: [{ id: 31 }], total_pages: 1, total_results: 1 };
  },
  getTVDetail: async (id: number) => {
    tmdbCalls.push({ fn: "getTVDetail", args: [id] });
    return { id };
  },
  getMovieDetail: async (id: number) => {
    tmdbCalls.push({ fn: "getMovieDetail", args: [id] });
    return { id };
  },
  getSeasonDetail: async (id: number, season: number) => {
    tmdbCalls.push({ fn: "getSeasonDetail", args: [id, season] });
    return { id, season };
  },
});
mock.module(modulePath("../src/services/tmdb"), tmdbMock);
mock.module("../services/tmdb", tmdbMock);

const bgmCalls: Array<{ query: string; opts: any }> = [];

const bgmMock = () => ({
  searchSubjects: async (query: string, opts: any) => {
    bgmCalls.push({ query, opts });
    return {
      total: 1,
      limit: 20,
      offset: 0,
      data: [
        {
          id: 1,
          name: "A",
          name_cn: "A",
          summary: "",
          rating: { score: 8 },
          images: { medium: null },
          date: "2024-01-01",
        },
      ],
    };
  },
});
mock.module(modulePath("../src/services/bgm"), bgmMock);
mock.module("../services/bgm", bgmMock);

const routes = await import("../src/routes/search?test=routes-search");

describe("routes/search", () => {
  beforeEach(() => {
    tmdbCalls.length = 0;
    bgmCalls.length = 0;
    failTmdb = false;
  });

  it("handles missing query", async () => {
    const res = await routes.default.request("/");
    expect(res.status).toBe(400);
  });

  it("uses TMDB multi search by default and annotates source", async () => {
    const res = await routes.default.request("/?q=test&page=3");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(tmdbCalls[0]).toEqual({ fn: "searchMulti", args: ["test", 3] });
    expect(body.results[0].source).toBe("tvdb");
  });

  it("uses TMDB TV search when type=tv", async () => {
    const res = await routes.default.request("/?q=test&type=tv&page=2");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(tmdbCalls[0]).toEqual({ fn: "searchTV", args: ["test", 2] });
    expect(body.results[0].id).toBe(21);
  });

  it("uses TMDB movie search when type=movie", async () => {
    const res = await routes.default.request("/?q=test&type=movie");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(tmdbCalls[0]).toEqual({ fn: "searchMovie", args: ["test", 1] });
    expect(body.results[0].id).toBe(31);
  });

  it("searches bgm", async () => {
    const res = await routes.default.request("/?q=test&source=bgm&page=2");
    const body = await res.json();
    expect(body.results.length).toBe(1);
    expect(body.results[0].source).toBe("bgm");
    expect(body.page).toBe(2);
    expect(bgmCalls[0].query).toBe("test");
    expect(bgmCalls[0].opts.offset).toBe(20);
  });

  it("returns tv details", async () => {
    const res = await routes.default.request("/tv/123");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(123);
    expect(tmdbCalls[0]).toEqual({ fn: "getTVDetail", args: [123] });
  });

  it("returns movie details", async () => {
    const res = await routes.default.request("/movie/456");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(456);
    expect(tmdbCalls[0]).toEqual({ fn: "getMovieDetail", args: [456] });
  });

  it("returns season details", async () => {
    const res = await routes.default.request("/tv/123/season/4");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.season).toBe(4);
    expect(tmdbCalls[0]).toEqual({ fn: "getSeasonDetail", args: [123, 4] });
  });

  it("maps service failures to 500", async () => {
    failTmdb = true;
    const res = await routes.default.request("/?q=test");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain("tmdb failed");
  });
});
