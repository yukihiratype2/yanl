import { describe, expect, it, mock } from "bun:test";
import { makeJsonResponse, mockFetch } from "./helpers";
import { modulePath } from "./mockPath";

const loggerCalls: any[] = [];

const loggerMock = () => ({
  logger: {
    warn: (...args: any[]) => loggerCalls.push(["warn", ...args]),
    error: (...args: any[]) => loggerCalls.push(["error", ...args]),
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
    mockFetch(() =>
      makeJsonResponse({
        choices: [{ message: { content: "not json" } }],
      })
    );

    const result = await ai.parseTorrentTitles(["A"]);
    expect(result).toBeNull();
  });
});
