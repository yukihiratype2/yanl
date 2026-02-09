import { beforeEach, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

let profiles: any[] = [{ id: 1, name: "P" }];
const createCalls: any[] = [];
const updateCalls: Array<{ id: number; data: any }> = [];
const setDefaultCalls: number[] = [];

const modelsMock = () => ({
  getAllProfiles: () => profiles,
  getProfileById: (id: number) => profiles.find((p) => p.id === id),
  createProfile: (data: any) => {
    if (data.name === "Dup") throw new Error("UNIQUE constraint failed");
    createCalls.push(data);
    const p = { id: 2, ...data };
    profiles.push(p);
    return p;
  },
  updateProfile: (id: number, data: any) => {
    if (data.name === "Dup") throw new Error("UNIQUE constraint failed");
    updateCalls.push({ id, data });
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx >= 0) profiles[idx] = { ...profiles[idx], ...data };
  },
  deleteProfile: (id: number) => {
    profiles = profiles.filter((p) => p.id !== id);
  },
  setDefaultProfile: (id: number) => {
    setDefaultCalls.push(id);
  },
  getEpisodesWithAirDateRange: () => [],
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
});
mock.module(modulePath("../src/db/models"), modelsMock);
mock.module("../db/models", modelsMock);

const routes = await import("../src/routes/profiles?test=routes-profiles");

describe("routes/profiles", () => {
  beforeEach(() => {
    profiles = [{ id: 1, name: "P", is_default: 0 }];
    createCalls.length = 0;
    updateCalls.length = 0;
    setDefaultCalls.length = 0;
  });

  it("lists profiles", async () => {
    const res = await routes.default.request("/");
    const body = await res.json();
    expect(body.length).toBe(1);
  });

  it("gets profile by id and returns 404 when missing", async () => {
    const ok = await routes.default.request("/1");
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.id).toBe(1);

    const notFound = await routes.default.request("/99");
    expect(notFound.status).toBe(404);
  });

  it("validates profile name on create", async () => {
    const res = await routes.default.request("/", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("creates profile", async () => {
    const res = await routes.default.request("/", {
      method: "POST",
      body: JSON.stringify({
        name: " New ",
        resolutions: ["1080p"],
        preferred_keywords: ["dual audio"],
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.name).toBe("New");
    expect(createCalls[0].name).toBe("New");
    expect(createCalls[0].resolutions).toBe("[\"1080p\"]");
    expect(createCalls[0].preferred_keywords).toBe("[\"dual audio\"]");
  });

  it("returns 409 on create name conflict", async () => {
    const res = await routes.default.request("/", {
      method: "POST",
      body: JSON.stringify({ name: "Dup" }),
    });
    expect(res.status).toBe(409);
  });

  it("updates profile and serializes fields", async () => {
    const res = await routes.default.request("/1", {
      method: "PUT",
      body: JSON.stringify({
        name: " Updated ",
        qualities: ["WEB-DL"],
        is_default: false,
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe("Updated");
    expect(updateCalls[0]).toEqual({
      id: 1,
      data: { name: "Updated", qualities: "[\"WEB-DL\"]", is_default: 0 },
    });
  });

  it("sets default profile on create and update", async () => {
    const created = await routes.default.request("/", {
      method: "POST",
      body: JSON.stringify({ name: "New", is_default: true }),
    });
    expect(created.status).toBe(201);
    expect(setDefaultCalls[0]).toBe(2);

    const updated = await routes.default.request("/1", {
      method: "PUT",
      body: JSON.stringify({ is_default: true }),
    });
    expect(updated.status).toBe(200);
    expect(setDefaultCalls[1]).toBe(1);
  });

  it("returns 404 when updating missing profile", async () => {
    const res = await routes.default.request("/99", {
      method: "PUT",
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 on update name conflict", async () => {
    const res = await routes.default.request("/1", {
      method: "PUT",
      body: JSON.stringify({ name: "Dup" }),
    });
    expect(res.status).toBe(409);
  });

  it("deletes profile and handles missing profile", async () => {
    const ok = await routes.default.request("/1", {
      method: "DELETE",
    });
    expect(ok.status).toBe(200);

    const missing = await routes.default.request("/1", {
      method: "DELETE",
    });
    expect(missing.status).toBe(404);
  });
});
