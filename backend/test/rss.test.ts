import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { mockFetch } from "./helpers";
import { modulePath } from "./mockPath";

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

const settingsMock = () => ({
  getSetting: (key: string) => {
    if (key === "eject_title_rules") return JSON.stringify(["RejectMe"]);
    return "";
  },
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

mock.module(modulePath("../src/services/ai"), () => ({
  parseTorrentTitles: async (titles: string[]) =>
    titles.map((t) => ({ englishTitle: t })),
}));

const rss = await import("../src/services/rss?test=rss");

describe("services/rss", () => {
  it("fetches, filters, and annotates RSS results", async () => {
    loggerCalls.length = 0;
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>KeepMe</title>
    <link>magnet:?xt=urn:btih:keep</link>
  </item>
  <item>
    <title>RejectMe</title>
    <link>magnet:?xt=urn:btih:reject</link>
  </item>
</channel></rss>`;

    mockFetch(() => new Response(xml));

    const results = await rss.searchTorrents("test");
    expect(results.length).toBe(2);
    expect(results.every((item) => item.title === "KeepMe")).toBe(true);
    expect(results[0].ai?.englishTitle).toBe("KeepMe");
  });

  it("emits structured failure logs with op and err", async () => {
    loggerCalls.length = 0;
    mockFetch(() => {
      throw new Error("rss network down");
    });

    const results = await rss.fetchMikanRSS("test");
    expect(results).toEqual([]);

    const errorLog = loggerCalls.find(
      (entry) =>
        entry.level === "error" &&
        entry.args[0]?.op === "integration.rss.request_error"
    );
    expect(errorLog).toBeTruthy();
    expect(errorLog?.args[0]?.provider).toBe("mikan");
    expect(errorLog?.args[0]?.err).toBeTruthy();
  });
});
