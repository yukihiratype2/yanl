import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { makeJsonResponse, mockFetch } from "./helpers";
import { modulePath } from "./mockPath";

const loggerCalls: Array<{ level: string; args: any[] }> = [];

const loggerMock = () => ({
  logger: {
    warn: (...args: any[]) => loggerCalls.push({ level: "warn", args }),
    error: (...args: any[]) => loggerCalls.push({ level: "error", args }),
    debug: (...args: any[]) => loggerCalls.push({ level: "debug", args }),
    info: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

mock.module(modulePath("../src/config"), () => ({
  loadConfig: () => ({
    ai: { api_url: "http://ai.test", api_token: "token", model: "model" },
  }),
}));

const ai = await import("../src/services/ai?test=ai");

describe("services/ai", () => {
  it("parses titles with AI response", async () => {
    loggerCalls.length = 0;
    mockFetch(() =>
      makeJsonResponse({
        choices: [
          {
            message: {
              content: "```json\n[{\"englishTitle\":\"A\"}]\n```",
            },
          },
        ],
      })
    );

    const result = await ai.parseTorrentTitles(["A"]);
    expect(result?.[0]?.englishTitle).toBe("A");
  });

  it("returns null on invalid JSON", async () => {
    loggerCalls.length = 0;
    mockFetch(() =>
      makeJsonResponse({
        choices: [{ message: { content: "not json" } }],
      })
    );

    const result = await ai.parseTorrentTitles(["A"]);
    expect(result).toBeNull();
  });

  it("emits structured failure logs with op and err", async () => {
    loggerCalls.length = 0;
    mockFetch(() => new Response("oops", { status: 500, statusText: "Server Error" }));

    const result = await ai.parseTorrentTitles(["A"]);
    expect(result).toBeNull();

    const requestError = loggerCalls.find(
      (entry) =>
        entry.level === "error" &&
        entry.args[0]?.op === "integration.ai.request_error"
    );
    expect(requestError).toBeTruthy();
    expect(requestError?.args[0]?.provider).toBe("ai");
    expect(requestError?.args[0]?.err).toBeTruthy();
  });
});
