import { describe, expect, it } from "bun:test";
import { err, ok } from "../src/lib/result";

describe("result helpers", () => {
  it("creates ok results", () => {
    const value = ok({ id: 42 });
    expect(value).toEqual({ ok: true, data: { id: 42 } });
  });

  it("creates err results", () => {
    const value = err(404, "Not Found", { resource: "show" });
    expect(value).toEqual({
      ok: false,
      status: 404,
      error: "Not Found",
      details: { resource: "show" },
    });
  });
});
