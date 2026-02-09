import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

let subs: any[] = [];
const updateCalls: Array<{ id: number; data: any }> = [];
const deleteCalls: Array<{ sub: any; opts: any }> = [];
const createCalls: any[] = [];
let createShouldFail = false;
let deleteShouldFail = false;

const modelsMock = () => ({
  getAllSubscriptions: () => subs,
  getActiveSubscriptions: () => subs.filter((s) => s.status === "active"),
  getSubscriptionById: (id: number) => subs.find((s) => s.id === id) ?? null,
  updateSubscription: (id: number, data: any) => {
    updateCalls.push({ id, data });
  },
  getEpisodesBySubscription: (id: number) => [{ id: id * 10, subscription_id: id }],
  getTorrentsBySubscription: (id: number) => [{ id: id * 100, subscription_id: id }],
  getTorrentByLink: () => null,
  getTorrentByHash: () => null,
  getTorrentByEpisodeId: () => null,
  createEpisode: () => {},
  createSubscription: () => ({ id: 1 }),
  updateEpisode: () => {},
  createTorrent: () => ({ id: 1 }),
  deleteSubscription: () => {},
  getAllProfiles: () => [],
  getProfileById: () => null,
  createProfile: () => ({ id: 1 }),
  updateProfile: () => {},
  deleteProfile: () => {},
  setDefaultProfile: () => {},
  getEpisodesWithAirDateRange: () => [],
});
mock.module(modulePath("../src/db/models"), modelsMock);
mock.module("../db/models", modelsMock);

const actionsMock = () => ({
  createSubscriptionWithEpisodes: async (payload: any) => {
    createCalls.push(payload);
    if (createShouldFail) {
      return { ok: false, error: "invalid source", status: 400, details: { field: "source" } };
    }
    return { ok: true, data: { id: 2 } };
  },
  deleteSubscriptionWithCleanup: async (sub: any, opts: any) => {
    deleteCalls.push({ sub, opts });
    if (deleteShouldFail) {
      return { ok: false, error: "cleanup failed", status: 500 };
    }
    return { ok: true, data: { success: true } };
  },
});
mock.module(modulePath("../src/actions/subscriptions"), actionsMock);
mock.module("../actions/subscriptions", actionsMock);

const routes = await import("../src/routes/subscriptions?test=routes-subscriptions");

describe("routes/subscriptions", () => {
  beforeEach(() => {
    subs = [
      { id: 1, title: "A", status: "active" },
      { id: 2, title: "B", status: "disabled" },
    ];
    updateCalls.length = 0;
    deleteCalls.length = 0;
    createCalls.length = 0;
    createShouldFail = false;
    deleteShouldFail = false;
  });

  it("lists subscriptions", async () => {
    const res = await routes.default.request("/");
    const body = await res.json();
    expect(body.length).toBe(2);
  });

  it("lists active subscriptions when status=active", async () => {
    const res = await routes.default.request("/?status=active");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe(1);
  });

  it("returns subscription detail with episodes and torrents", async () => {
    const res = await routes.default.request("/1");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(1);
    expect(body.episodes.length).toBe(1);
    expect(body.torrents.length).toBe(1);
  });

  it("returns 404 for unknown subscription detail", async () => {
    const res = await routes.default.request("/999");
    expect(res.status).toBe(404);
  });

  it("creates subscription", async () => {
    const payload = { media_type: "tv", source_id: 1 };
    const res = await routes.default.request("/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.id).toBe(2);
    expect(createCalls[0]).toEqual(payload);
  });

  it("returns usecase error on create", async () => {
    createShouldFail = true;
    const res = await routes.default.request("/", {
      method: "POST",
      body: JSON.stringify({ media_type: "tv", source_id: 1 }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid source");
    expect(body.field).toBe("source");
  });

  it("validates and updates status", async () => {
    const missing = await routes.default.request("/1", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    expect(missing.status).toBe(400);

    const invalid = await routes.default.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
    expect(invalid.status).toBe(400);

    const ok = await routes.default.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ status: "disabled" }),
    });
    expect(ok.status).toBe(200);
    expect(updateCalls[0]).toEqual({ id: 1, data: { status: "disabled" } });
  });

  it("returns 404 when patching missing subscription", async () => {
    const res = await routes.default.request("/999", {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes subscription and parses delete_files from query", async () => {
    const res = await routes.default.request("/1?delete_files_on_disk=true", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(deleteCalls[0].sub.id).toBe(1);
    expect(deleteCalls[0].opts).toEqual({ deleteFilesOnDisk: true });
  });

  it("parses delete_files alias from request body", async () => {
    const res = await routes.default.request("/1", {
      method: "DELETE",
      body: JSON.stringify({ delete_files: true }),
    });
    expect(res.status).toBe(200);
    expect(deleteCalls[0].opts).toEqual({ deleteFilesOnDisk: true });
  });

  it("returns 404 when deleting missing subscription", async () => {
    const res = await routes.default.request("/999", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("returns usecase error on delete failure", async () => {
    deleteShouldFail = true;
    const res = await routes.default.request("/1", {
      method: "DELETE",
    });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("cleanup failed");
  });

  it("gets episodes for a subscription", async () => {
    const res = await routes.default.request("/1/episodes");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.length).toBe(1);
    expect(body[0].subscription_id).toBe(1);
  });

  it("returns 404 on episodes endpoint for missing subscription", async () => {
    const res = await routes.default.request("/999/episodes");
    expect(res.status).toBe(404);
  });
});
