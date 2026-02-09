import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { modulePath } from "./mockPath";

const settingsMock = () => ({
  getSetting: () => "token",
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

const { authMiddleware } = await import("../src/middleware/auth?test=middleware-auth");

describe("middleware/auth", () => {
  it("allows OPTIONS preflight without auth", async () => {
    const app = new Hono();
    app.use("/api/*", authMiddleware);
    app.options("/api/test", (c) => c.text("ok"));

    const res = await app.request("/api/test", { method: "OPTIONS" });
    expect(res.status).toBe(200);
  });

  it("rejects missing token", async () => {
    const app = new Hono();
    app.use("/api/*", authMiddleware);
    app.get("/api/test", (c) => c.text("ok"));

    const res = await app.request("/api/test");
    expect(res.status).toBe(401);
  });

  it("allows private IP without token", async () => {
    const app = new Hono();
    app.use("/api/*", authMiddleware);
    app.get("/api/test", (c) => c.text("ok"));

    const res = await app.request("/api/test", {
      headers: { "x-forwarded-for": "192.168.0.10" },
    });
    expect(res.status).toBe(200);
  });

  it("allows bearer token and rejects invalid tokens", async () => {
    const app = new Hono();
    app.use("/api/*", authMiddleware);
    app.get("/api/test", (c) => c.text("ok"));

    const ok = await app.request("/api/test", {
      headers: { Authorization: "Bearer token" },
    });
    expect(ok.status).toBe(200);

    const bad = await app.request("/api/test", {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(bad.status).toBe(401);
  });

  it("extracts the first x-forwarded-for IP", async () => {
    const app = new Hono();
    app.use("/api/*", authMiddleware);
    app.get("/api/test", (c) => c.text("ok"));

    const res = await app.request("/api/test", {
      headers: { "x-forwarded-for": "192.168.1.10, 8.8.8.8" },
    });
    expect(res.status).toBe(200);
  });

  it("supports ipv6-mapped private IPv4", async () => {
    const app = new Hono();
    app.use("/api/*", authMiddleware);
    app.get("/api/test", (c) => c.text("ok"));

    const res = await app.request("/api/test", {
      headers: { "x-forwarded-for": "::ffff:10.0.0.8" },
    });
    expect(res.status).toBe(200);
  });
});
