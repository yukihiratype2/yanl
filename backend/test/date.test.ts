import { describe, expect, it } from "bun:test";
import {
  compareDateOnly,
  isCanonicalDateOnly,
  isOnOrBeforeDateOnly,
  normalizeDateOnly,
  parseCanonicalDateOnly,
  todayLocalDateOnly,
} from "../src/lib/date";

describe("lib/date", () => {
  it("parses only canonical date strings", () => {
    const canonical = parseCanonicalDateOnly("2024-01-02");
    const nonPadded = parseCanonicalDateOnly("2024-1-2");
    expect(canonical).not.toBeNull();
    expect(nonPadded).toBeNull();
  });

  it("normalizes to YYYY-MM-DD", () => {
    expect(normalizeDateOnly("2024-1-2")).toBe("2024-01-02");
    expect(normalizeDateOnly("2024-01-02")).toBe("2024-01-02");
  });

  it("validates canonical format", () => {
    expect(isCanonicalDateOnly("2024-01-02")).toBe(true);
    expect(isCanonicalDateOnly("2024-1-2")).toBe(false);
    expect(isCanonicalDateOnly(" 2024-01-02")).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(parseCanonicalDateOnly("2024-02-30")).toBeNull();
    expect(parseCanonicalDateOnly("2024/01/01")).toBeNull();
    expect(normalizeDateOnly("not-a-date")).toBeNull();
  });

  it("compares date-only values", () => {
    expect(compareDateOnly("2024-01-01", "2024-01-02")).toBe(-1);
    expect(compareDateOnly("2024-01-02", "2024-01-02")).toBe(0);
    expect(compareDateOnly("2024-01-03", "2024-01-02")).toBe(1);
    expect(compareDateOnly("bad", "2024-01-02")).toBeNull();
  });

  it("checks on-or-before relation", () => {
    expect(isOnOrBeforeDateOnly("2024-1-2", "2024-01-02")).toBeNull();
    expect(isOnOrBeforeDateOnly("2024-01-03", "2024-01-02")).toBe(false);
    expect(isOnOrBeforeDateOnly("bad", "2024-01-02")).toBeNull();
  });

  it("formats today as local YYYY-MM-DD", () => {
    expect(todayLocalDateOnly()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
