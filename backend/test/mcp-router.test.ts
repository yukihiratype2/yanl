import { beforeEach, describe, expect, it, mock } from "bun:test";
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
  // Keep API-compatible constructor signature.
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
const updateCalls: Array<{ id: number; data: any }> = [];
const createCalls: any[] = [];
const deleteCalls: Array<{ sub: any; opts: any }> = [];

const modelsMock = () => ({
  getAllSubscriptions: () => subs,
  getActiveSubscriptions: () => subs.filter((s) => s.status === "active"),
  getSubscriptionById: (id: number) => subs.find((s) => s.id === id) ?? null,
  getEpisodesBySubscription: (id: number) => [{ id: id * 10, subscription_id: id }],
  getTorrentsBySubscription: (id: number) => [{ id: id * 100, subscription_id: id }],
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

describe("mcp/router", () => {
  beforeEach(() => {
    subs = [
      { id: 1, title: "A", status: "active" },
      { id: 2, title: "B", status: "disabled" },
    ];
    updateCalls.length = 0;
    createCalls.length = 0;
    deleteCalls.length = 0;
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
  });

  it("handles happy-path tool calls and returns parseable JSON text payload", async () => {
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
});
