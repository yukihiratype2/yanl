import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

const handlers = new Map<any, (req: any) => Promise<any>>();
const CallToolRequestSchema = Symbol("CallToolRequestSchema");
const ListToolsRequestSchema = Symbol("ListToolsRequestSchema");

class MockServer {
  setRequestHandler(schema: any, handler: (req: any) => Promise<any>) {
    handlers.set(schema, handler);
  }

  connect() {
    return Promise.resolve();
  }
}

class MockTransport {
  constructor(_opts: any) {}

  handleRequest(_req: Request) {
    return Promise.resolve(new Response("ok"));
  }
}

mock.module("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: MockServer,
}));
mock.module(
  "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js",
  () => ({
    WebStandardStreamableHTTPServerTransport: MockTransport,
  })
);
mock.module("@modelcontextprotocol/sdk/types.js", () => ({
  CallToolRequestSchema,
  ListToolsRequestSchema,
}));

let subs: any[] = [];
let episodesBySub: Record<number, any[]> = {};
let torrentsBySub: Record<number, any[]> = {};
const updateCalls: Array<{ id: number; data: any }> = [];
const createCalls: any[] = [];
const deleteCalls: Array<{ sub: any; opts: any }> = [];

const modelsMock = () => ({
  getAllSubscriptions: () => subs,
  getActiveSubscriptions: () => subs.filter((s) => s.status === "active"),
  getSubscriptionById: (id: number) => subs.find((s) => s.id === id) ?? null,
  getEpisodesBySubscription: (id: number) => episodesBySub[id] ?? [],
  getTorrentsBySubscription: (id: number) => torrentsBySub[id] ?? [],
  updateSubscription: (id: number, data: any) => {
    updateCalls.push({ id, data });
  },
});
mock.module(modulePath("../src/db/models"), modelsMock);
mock.module("../db/models", modelsMock);

const actionsMock = () => ({
  createSubscriptionWithEpisodes: async (payload: any) => {
    createCalls.push(payload);
    return { ok: true, data: { id: 55, ...payload } };
  },
  deleteSubscriptionWithCleanup: async (sub: any, opts: any) => {
    deleteCalls.push({ sub, opts });
    return { ok: true, data: { success: true } };
  },
});
mock.module(modulePath("../src/actions/subscriptions"), actionsMock);
mock.module("../actions/subscriptions", actionsMock);

const tmdbCalls: Array<{ fn: string; args: any[] }> = [];
const tmdbMock = () => ({
  searchTV: async (query: string, page: number) => {
    tmdbCalls.push({ fn: "searchTV", args: [query, page] });
    return {
      page,
      total_pages: 1,
      total_results: 1,
      results: [{ id: 101, name: "TV Hit", vote_average: 8.1 }],
    };
  },
  searchMovie: async (query: string, page: number) => {
    tmdbCalls.push({ fn: "searchMovie", args: [query, page] });
    return {
      page,
      total_pages: 1,
      total_results: 1,
      results: [{ id: 201, title: "Movie Hit", vote_average: 7.6 }],
    };
  },
  searchMulti: async (query: string, page: number) => {
    tmdbCalls.push({ fn: "searchMulti", args: [query, page] });
    return {
      page,
      total_pages: 1,
      total_results: 3,
      results: [
        { id: 301, media_type: "tv", name: "Multi TV" },
        { id: 302, media_type: "movie", title: "Multi Movie" },
        { id: 303, media_type: "person", name: "Ignore Person" },
      ],
    };
  },
  getTVDetail: async (id: number) => {
    tmdbCalls.push({ fn: "getTVDetail", args: [id] });
    return { id, name: "TV Detail", seasons: [] };
  },
  getMovieDetail: async (id: number) => {
    tmdbCalls.push({ fn: "getMovieDetail", args: [id] });
    return { id, title: "Movie Detail" };
  },
  getSeasonDetail: async (id: number, season: number) => {
    tmdbCalls.push({ fn: "getSeasonDetail", args: [id, season] });
    return { id, season_number: season, episodes: [] };
  },
});
mock.module(modulePath("../src/services/tmdb"), tmdbMock);
mock.module("../services/tmdb", tmdbMock);

const bgmCalls: Array<{ fn: string; args: any[] }> = [];
const bgmMock = () => ({
  searchSubjects: async (query: string, opts: any) => {
    bgmCalls.push({ fn: "searchSubjects", args: [query, opts] });
    return {
      total: 1,
      limit: opts.limit,
      offset: opts.offset,
      data: [
        {
          id: 401,
          name: "BGM Name",
          name_cn: "BGM CN",
          summary: "bgm summary",
          date: "2020-01-01",
          rating: { score: 7.9 },
          images: { small: "s", medium: "m", large: "l" },
        },
      ],
    };
  },
  getSubjectDetail: async (id: number) => {
    bgmCalls.push({ fn: "getSubjectDetail", args: [id] });
    return { id, name: "BGM Detail", name_cn: "BGM Detail CN" };
  },
});
mock.module(modulePath("../src/services/bgm"), bgmMock);
mock.module("../services/bgm", bgmMock);

await import("../src/mcp/router?test=mcp-router");

function parseToolText(result: any) {
  expect(result.content?.[0]?.type).toBe("text");
  const raw = result.content[0].text;
  return JSON.parse(raw);
}

async function callTool(name: string, args: any = {}) {
  const handler = handlers.get(CallToolRequestSchema);
  expect(handler).toBeTruthy();
  const result = await handler!({
    params: { name, arguments: args },
  });
  return parseToolText(result);
}

function makeSub(
  id: number,
  mediaType: "anime" | "tv" | "movie",
  status = "active",
  extra: Record<string, any> = {}
) {
  return {
    id,
    source: "tvdb",
    source_id: id * 10,
    media_type: mediaType,
    title: `Sub-${id}`,
    title_original: null,
    overview: null,
    poster_path: null,
    backdrop_path: null,
    first_air_date: null,
    vote_average: null,
    season_number: mediaType === "movie" ? null : 1,
    total_episodes: null,
    status,
    folder_path: null,
    profile_id: null,
    created_at: "2025-01-01 00:00:00",
    updated_at: "2025-01-01 00:00:00",
    ...extra,
  };
}

describe("mcp/router", () => {
  beforeEach(() => {
    subs = [makeSub(1, "tv", "active"), makeSub(2, "tv", "disabled")];
    episodesBySub = {
      1: [{ id: 10, subscription_id: 1 }],
      2: [{ id: 20, subscription_id: 2 }],
    };
    torrentsBySub = {
      1: [{ id: 100, subscription_id: 1 }],
      2: [{ id: 200, subscription_id: 2 }],
    };
    updateCalls.length = 0;
    createCalls.length = 0;
    deleteCalls.length = 0;
    tmdbCalls.length = 0;
    bgmCalls.length = 0;
  });

  it("lists tools with expected names", async () => {
    const handler = handlers.get(ListToolsRequestSchema);
    expect(handler).toBeTruthy();
    const result = await handler!({ params: {} });
    const names = result.tools.map((t: any) => t.name);
    expect(names).toContain("list_subscriptions");
    expect(names).toContain("get_subscription");
    expect(names).toContain("create_subscription");
    expect(names).toContain("update_subscription_status");
    expect(names).toContain("delete_subscription");
    expect(names).toContain("search_media");
    expect(names).toContain("get_media_detail");
    expect(names).toContain("list_subscription_download_status");
    expect(names).toContain("get_subscription_download_status");
  });

  it("returns deterministic errors for invalid tool inputs", async () => {
    expect(await callTool("unknown_tool", {})).toEqual({
      error: "Unknown tool: unknown_tool",
    });
    expect(await callTool("get_subscription", {})).toEqual({
      error: "Missing or invalid id",
    });
    expect(await callTool("create_subscription", { media_type: "doc" })).toEqual({
      error: "Missing or invalid media_type",
    });
    expect(await callTool("update_subscription_status", { id: 1, status: "paused" })).toEqual({
      error: "Invalid status",
    });
    expect(await callTool("delete_subscription", { id: 999 })).toEqual({
      error: "Subscription not found",
    });

    expect(await callTool("search_media", {})).toEqual({
      error: "Missing or invalid query",
    });
    expect(await callTool("search_media", { query: "abc", page: 0 })).toEqual({
      error: "Invalid page",
    });
    expect(await callTool("search_media", { query: "abc", source: "foo" })).toEqual({
      error: "Invalid source",
    });

    expect(await callTool("get_media_detail", { source: "tvdb", media_type: "tv" })).toEqual({
      error: "Missing or invalid id",
    });
    expect(await callTool("get_media_detail", { source: "bgm", id: 1, media_type: "movie" })).toEqual({
      error: "Invalid source/media_type combination",
    });

    expect(await callTool("list_subscription_download_status", { status: "paused" })).toEqual({
      error: "Invalid status",
    });
    expect(await callTool("list_subscription_download_status", { media_type: "doc" })).toEqual({
      error: "Invalid media_type",
    });
    expect(await callTool("list_subscription_download_status", { limit: 0 })).toEqual({
      error: "Invalid limit",
    });
    expect(await callTool("list_subscription_download_status", { offset: -1 })).toEqual({
      error: "Invalid offset",
    });

    expect(await callTool("get_subscription_download_status", {})).toEqual({
      error: "Missing or invalid id",
    });
    expect(await callTool("get_subscription_download_status", { id: 999 })).toEqual({
      error: "Subscription not found",
    });
  });

  it("handles legacy subscription CRUD tool calls", async () => {
    const list = await callTool("list_subscriptions", { status: "active" });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);

    const get = await callTool("get_subscription", {
      id: 1,
      include_episodes: true,
      include_torrents: true,
    });
    expect(get.id).toBe(1);
    expect(get.episodes.length).toBe(1);
    expect(get.torrents.length).toBe(1);

    const created = await callTool("create_subscription", {
      media_type: "tv",
      source: "tvdb",
      source_id: 123,
    });
    expect(created.id).toBe(55);
    expect(createCalls.length).toBe(1);

    const updated = await callTool("update_subscription_status", {
      id: 1,
      status: "disabled",
    });
    expect(updated).toEqual({ success: true });
    expect(updateCalls[0]).toEqual({ id: 1, data: { status: "disabled" } });

    const deleted = await callTool("delete_subscription", {
      id: 1,
      delete_files_on_disk: true,
    });
    expect(deleted).toEqual({ success: true });
    expect(deleteCalls[0].opts).toEqual({ deleteFilesOnDisk: true });
  });

  it("supports media discovery and detail tools", async () => {
    const tvdbSearch = await callTool("search_media", {
      query: "test",
      source: "tvdb",
      type: "multi",
      page: 1,
    });
    expect(tvdbSearch.results.length).toBe(2);
    expect(tvdbSearch.results.every((item: any) => item.source === "tvdb")).toBe(true);

    const bgmSearch = await callTool("search_media", {
      query: "anime",
      source: "bgm",
      page: 1,
    });
    expect(bgmSearch.results.length).toBe(1);
    expect(bgmSearch.results[0].source).toBe("bgm");

    const tvDetail = await callTool("get_media_detail", {
      source: "tvdb",
      id: 123,
      media_type: "tv",
    });
    expect(tvDetail.source).toBe("tvdb");
    expect(tvDetail.media_type).toBe("tv");

    const seasonDetail = await callTool("get_media_detail", {
      source: "tvdb",
      id: 123,
      media_type: "tv",
      season_number: 2,
    });
    expect(seasonDetail.season_number).toBe(2);

    const movieDetail = await callTool("get_media_detail", {
      source: "tvdb",
      id: 777,
      media_type: "movie",
    });
    expect(movieDetail.source).toBe("tvdb");
    expect(movieDetail.media_type).toBe("movie");

    const bgmDetail = await callTool("get_media_detail", {
      source: "bgm",
      id: 456,
      media_type: "tv",
    });
    if (bgmCalls.some((c) => c.fn === "getSubjectDetail")) {
      expect(bgmDetail.source).toBe("bgm");
      expect(bgmDetail.media_type).toBe("tv");
    }

    expect(tvdbSearch.results.some((item: any) => item.media_type === "tv")).toBe(true);
    expect(tvdbSearch.results.some((item: any) => item.media_type === "movie")).toBe(true);
  });

  it("computes subscription download health summary states", async () => {
    subs = [
      makeSub(11, "tv", "active"),
      makeSub(12, "anime", "active"),
      makeSub(13, "tv", "active"),
      makeSub(14, "tv", "active"),
      makeSub(15, "movie", "completed", { first_air_date: "2020-01-01" }),
      makeSub(16, "movie", "active", { first_air_date: "2020-01-01" }),
      makeSub(17, "movie", "active", { first_air_date: "2020-01-01" }),
      makeSub(18, "movie", "active", { first_air_date: "2999-01-01" }),
    ];

    episodesBySub = {
      11: [
        {
          id: 1101,
          subscription_id: 11,
          season_number: 1,
          episode_number: 1,
          air_date: "2020-01-01",
          status: "pending",
          torrent_hash: null,
          file_path: null,
          updated_at: "2025-01-01 00:00:01",
        },
        {
          id: 1102,
          subscription_id: 11,
          season_number: 1,
          episode_number: 2,
          air_date: "2020-01-08",
          status: "completed",
          torrent_hash: "h2",
          file_path: "/media/e2.mkv",
          updated_at: "2025-01-01 00:00:02",
        },
      ],
      12: [
        {
          id: 1201,
          subscription_id: 12,
          season_number: 1,
          episode_number: 1,
          air_date: "2020-01-01",
          status: "downloading",
          torrent_hash: "h1201",
          file_path: null,
          updated_at: "2025-01-01 00:00:03",
        },
        {
          id: 1202,
          subscription_id: 12,
          season_number: 1,
          episode_number: 2,
          air_date: "2020-01-08",
          status: "pending",
          torrent_hash: null,
          file_path: null,
          updated_at: "2025-01-01 00:00:04",
        },
      ],
      13: [
        {
          id: 1301,
          subscription_id: 13,
          season_number: 1,
          episode_number: 1,
          air_date: "2020-01-01",
          status: "pending",
          torrent_hash: null,
          file_path: null,
          updated_at: "2025-01-01 00:00:05",
        },
      ],
      14: [
        {
          id: 1401,
          subscription_id: 14,
          season_number: 1,
          episode_number: 1,
          air_date: "2999-01-01",
          status: "pending",
          torrent_hash: null,
          file_path: null,
          updated_at: "2025-01-01 00:00:06",
        },
      ],
    };

    torrentsBySub = {
      16: [
        {
          id: 1601,
          subscription_id: 16,
          episode_id: null,
          title: "Movie16",
          link: "magnet:?xt=urn:btih:16",
          hash: "16",
          size: null,
          source: "rss",
          status: "downloading",
          download_path: null,
          created_at: "2025-01-01 00:00:10",
          updated_at: "2025-01-01 00:00:10",
        },
      ],
      17: [],
      18: [],
    };

    const summary = await callTool("list_subscription_download_status", {
      status: "all",
      media_type: "all",
      limit: 50,
      offset: 0,
    });

    expect(summary.total).toBe(8);
    const byId = new Map(summary.items.map((item: any) => [item.subscription_id, item]));

    expect(byId.get(11).health_status).toBe("ready");
    expect(byId.get(11).missing_released_episode_count).toBe(1);

    expect(byId.get(12).health_status).toBe("downloading");
    expect(byId.get(12).latest_released_episode_number).toBe(2);

    expect(byId.get(13).health_status).toBe("missing");
    expect(byId.get(14).health_status).toBe("not_released");

    expect(byId.get(15).health_status).toBe("ready");
    expect(byId.get(16).health_status).toBe("downloading");
    expect(byId.get(17).health_status).toBe("missing");
    expect(byId.get(18).health_status).toBe("not_released");
  });

  it("returns detailed subscription download status with episode breakdown", async () => {
    subs = [makeSub(21, "tv", "active")];
    episodesBySub = {
      21: [
        {
          id: 2101,
          subscription_id: 21,
          season_number: 1,
          episode_number: 1,
          air_date: "2020-01-01",
          status: "downloaded",
          torrent_hash: "h1",
          file_path: "/media/e1.mkv",
          updated_at: "2025-01-01 00:00:01",
        },
        {
          id: 2102,
          subscription_id: 21,
          season_number: 1,
          episode_number: 2,
          air_date: "2020-01-08",
          status: "pending",
          torrent_hash: null,
          file_path: null,
          updated_at: "2025-01-01 00:00:02",
        },
        {
          id: 2103,
          subscription_id: 21,
          season_number: 1,
          episode_number: 3,
          air_date: "2999-01-01",
          status: "pending",
          torrent_hash: null,
          file_path: null,
          updated_at: "2025-01-01 00:00:03",
        },
      ],
    };
    torrentsBySub = {};

    const releasedOnly = await callTool("get_subscription_download_status", {
      id: 21,
      include_episodes: true,
      released_only: true,
    });

    expect(releasedOnly.health_status).toBe("missing");
    expect(releasedOnly.latest_released_episode_number).toBe(2);
    expect(releasedOnly.episodes.length).toBe(2);
    expect(releasedOnly.episodes[0].status).toBe("completed");
    expect(releasedOnly.episodes[1].is_latest_released).toBe(true);
    expect(releasedOnly.episodes[1].is_missing).toBe(true);

    const withFuture = await callTool("get_subscription_download_status", {
      id: 21,
      include_episodes: true,
      released_only: false,
    });
    expect(withFuture.episodes.length).toBe(3);
    expect(withFuture.episodes[2].released).toBe(false);

    const noEpisodes = await callTool("get_subscription_download_status", {
      id: 21,
      include_episodes: false,
    });
    expect(noEpisodes.episodes).toBeUndefined();
  });
});
