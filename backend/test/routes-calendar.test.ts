import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

const modelsMock = () => ({
  getEpisodesWithAirDateRange: () => [
    { air_date: "2024-01-01", id: 1 },
    { air_date: "2024-01-02", id: 2 },
  ],
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
  it("groups episodes by date", async () => {
    const res = await routes.default.request("/?start=2024-01-01&end=2024-01-10");
    const body = await res.json();
    expect(body.grouped["2024-01-01"].length).toBe(1);
  });
});
