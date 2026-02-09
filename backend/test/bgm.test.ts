import { describe, expect, it } from "bun:test";
import { makeJsonResponse, mockFetch } from "./helpers";

const bgm = await import("../src/services/bgm?test=bgm");

describe("services/bgm", () => {
  it("searches subjects via POST", async () => {
    const { calls } = mockFetch(() =>
      makeJsonResponse({ total: 0, limit: 20, offset: 0, data: [] })
    );
    await bgm.searchSubjects("test");
    expect(String(calls[0].input)).toContain("/search/subjects");
    expect(calls[0].init?.method).toBe("POST");
  });
});
