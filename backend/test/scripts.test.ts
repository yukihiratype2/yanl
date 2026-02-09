import { afterAll, describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

let logged = "";
const originalLog = console.log;
console.log = (msg?: any) => {
  logged = String(msg ?? "");
};

mock.module(modulePath("../src/services/ai"), () => ({
  parseTorrentTitles: async () => [{ englishTitle: "A" }],
}));

const loggerMock = () => ({
  logger: {
    info: () => {},
    error: () => {},
  },
  reconfigureLogger: () => ({ info: () => {} }),
});
mock.module(modulePath("../src/services/logger"), loggerMock);
mock.module("../services/logger", loggerMock);

const script = await import("../src/scripts/test-ai?test=scripts");

describe("scripts/test-ai", () => {
  it("runs AI test script", async () => {
    await script.runAITest(["Title"]);
    expect(logged).toContain("englishTitle");
  });
});

afterAll(() => {
  console.log = originalLog;
});
