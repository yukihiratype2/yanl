import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const queryCalls: Array<{ start: string; end: string }> = [];

const modelsMock = () => ({
  getEpisodesWithAirDateRange: (start: string, end: string) => {
    queryCalls.push({ start, end });
    return [
      { air_date: "2024-01-01", id: 1 },
      { air_date: "2024-01-02", id: 2 },
    ];
  },
  getAllSubscriptions: () => [],
  getActiveSubscriptions: () => [],
  getSubscriptionById: () => null,
  getEpisodesBySubscription: () => [],
  getTorrentsBySubscription: () => [],
  getTorrentByLink: () => null,
  getTorrentByHash: () => null,
  getTorrentByEpisodeId: () => null,
  createSubscription: () => ({ id: 1 }),
  updateSubscription: () => {},
  deleteSubscription: () => {},
  createEpisode: () => {},
  updateEpisode: () => {},
  createTorrent: () => ({ id: 1 }),
  getAllProfiles: () => [],
  getProfileById: () => null,
  createProfile: () => ({ id: 1 }),
  updateProfile: () => {},
  deleteProfile: () => {},
  setDefaultProfile: () => {},
});
mock.module(modulePath("../src/db/models"), modelsMock);
mock.module("../db/models", modelsMock);

const routes = await import("../src/routes/calendar?test=routes-calendar");

describe("routes/calendar", () => {
  beforeEach(() => {
    queryCalls.length = 0;
  });

  it("returns 400 when start and end are missing", async () => {
    const res = await routes.default.request("/");
    expect(res.status).toBe(400);
  });

  it("returns 400 when start or end date is invalid", async () => {
    const invalidStart = await routes.default.request(
      "/?start=invalid&end=2024-01-10"
    );
    expect(invalidStart.status).toBe(400);

    const invalidEnd = await routes.default.request(
      "/?start=2024-01-01&end=2024-02-30"
    );
    expect(invalidEnd.status).toBe(400);

    const nonCanonical = await routes.default.request(
      "/?start=2024-1-1&end=2024-01-10"
    );
    expect(nonCanonical.status).toBe(400);
  });

  it("returns 400 when start is after end", async () => {
    const res = await routes.default.request(
      "/?start=2024-01-10&end=2024-01-01"
    );
    expect(res.status).toBe(400);
  });

  it("accepts canonical dates and groups episodes by date", async () => {
    const res = await routes.default.request("/?start=2024-01-01&end=2024-01-10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.grouped["2024-01-01"].length).toBe(1);
    expect(queryCalls).toEqual([{ start: "2024-01-01", end: "2024-01-10" }]);
  });
});
