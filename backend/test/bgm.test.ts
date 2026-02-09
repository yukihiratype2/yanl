import { describe, expect, it, mock } from "bun:test";
import { makeJsonResponse, mockFetch } from "./helpers";
import { modulePath } from "./mockPath";

mock.restore();

const loggerCalls: Array<{ level: string; args: any[] }> = [];
const loggerMock = () => ({
  logger: {
    debug: (...args: any[]) => loggerCalls.push({ level: "debug", args }),
    warn: (...args: any[]) => loggerCalls.push({ level: "warn", args }),
    error: (...args: any[]) => loggerCalls.push({ level: "error", args }),
    info: (...args: any[]) => loggerCalls.push({ level: "info", args }),
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

const bgm = await import("../src/services/bgm?test=bgm");

describe("services/bgm", () => {
  it("searches subjects via POST", async () => {
    loggerCalls.length = 0;
    const { calls } = mockFetch(() =>
      makeJsonResponse({ total: 0, limit: 20, offset: 0, data: [] })
    );
    await bgm.searchSubjects("test");
    expect(String(calls[0].input)).toContain("/search/subjects");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("emits structured failure logs with op and err", async () => {
    loggerCalls.length = 0;
    mockFetch(() => new Response("bad", { status: 500, statusText: "Server Error" }));

    await expect(bgm.searchSubjects("test")).rejects.toThrow("BGM API error");

    const errorLog = loggerCalls.find(
      (entry) =>
        entry.level === "error" &&
        entry.args[0]?.op === "integration.bgm.request_error"
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog?.args[0]?.provider).toBe("bgm");
    expect(errorLog?.args[0]?.err).toBeTruthy();
  });
});
