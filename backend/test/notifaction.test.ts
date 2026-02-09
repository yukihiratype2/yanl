import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

let notifactions: any[] = [];
const configMock = () => ({
  loadConfig: () => ({
    notifactions,
  }),
});
mock.module(modulePath("../src/config"), configMock);
mock.module("../config", configMock);

const logCalls: Array<{ level: string; args: any[] }> = [];
const loggerMock = () => ({
  logger: {
    info: (...args: any[]) => logCalls.push({ level: "info", args }),
    warn: (...args: any[]) => logCalls.push({ level: "warn", args }),
    error: (...args: any[]) => logCalls.push({ level: "error", args }),
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

const service = await import("../src/services/notifaction?test=notifaction");

function baseEvent(type: "media_released" | "download_completed" | "media_moved") {
  return {
    type,
    subscription: {
      id: 1,
      title: "Sample Show",
      media_type: "tv",
      source: "tvdb",
      source_id: 100,
      season_number: 1,
    },
    data: {
      episode_number: 1,
    },
  };
}

describe("services/notifaction", () => {
  beforeEach(() => {
    notifactions = [];
    logCalls.length = 0;
    (globalThis as any).fetch = async () => new Response("", { status: 200 });
  });

  it("filters notifactions by enabled flag and event type", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      return new Response("", { status: 200 });
    };

    notifactions = [
      {
        id: "n1",
        name: "Release Webhook",
        enabled: true,
        provider: "webhook",
        events: ["media_released"],
        config: {
          url: "https://example.com/release",
          headers: { Authorization: "Bearer token" },
        },
      },
      {
        id: "n2",
        name: "Disabled Webhook",
        enabled: false,
        provider: "webhook",
        events: ["media_released"],
        config: { url: "https://example.com/disabled", headers: {} },
      },
    ];

    service.emitNotifactionEvent(baseEvent("download_completed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchCalls.length).toBe(0);

    service.emitNotifactionEvent(baseEvent("media_released"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]?.url).toBe("https://example.com/release");
    const body = JSON.parse(String(fetchCalls[0]?.init?.body || "{}"));
    expect(body.type).toBe("media_released");
    const headers = fetchCalls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token");
  });

  it("sends telegram notifaction using bot token and chat id", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    notifactions = [
      {
        id: "t1",
        name: "Telegram",
        enabled: true,
        provider: "telegram",
        events: ["download_completed"],
        config: {
          bot_token: "123:abc",
          chat_id: "-100777",
        },
      },
    ];

    service.emitNotifactionEvent(baseEvent("download_completed"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]?.url).toContain("https://api.telegram.org/bot123:abc/sendMessage");
    const body = String(fetchCalls[0]?.init?.body || "");
    const params = new URLSearchParams(body);
    expect(params.get("chat_id")).toBe("-100777");
    expect(params.get("text")).toContain("download_completed");
  });

  it("dispatches in fire-and-forget mode without waiting for response", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    let fetchCalled = false;
    (globalThis as any).fetch = async () => {
      fetchCalled = true;
      return pendingFetch;
    };

    notifactions = [
      {
        id: "n-fire-and-forget",
        name: "Webhook",
        enabled: true,
        provider: "webhook",
        events: ["media_moved"],
        config: {
          url: "https://example.com/fire",
          headers: {},
        },
      },
    ];

    const result = service.emitNotifactionEvent(baseEvent("media_moved"));
    expect(result).toBeUndefined();
    expect(fetchCalled).toBe(true);

    resolveFetch(new Response("", { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
