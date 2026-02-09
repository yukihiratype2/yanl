import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

const integrationHealthMock = () => ({
  getIntegrationStatuses: () => [{ key: "qbit", status: "ok" }],
  runIntegrationCheck: async (key: string) => {
    if (key === "qbit") return { ok: false as const, reason: "manual_disabled" as const };
    return { ok: false as const, reason: "not_found" as const };
  },
  reportIntegrationSuccess: () => {},
  reportIntegrationFailure: () => {},
});
mock.module(modulePath("../src/services/integration-health"), integrationHealthMock);
mock.module("../services/integration-health", integrationHealthMock);

const routes = await import("../src/routes/integrations?test=routes-integrations");

describe("routes/integrations", () => {
  it("lists integration statuses", async () => {
    const res = await routes.default.request("/status");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.integrations.length).toBe(1);
  });

  it("returns 405 for manual test in passive mode", async () => {
    const res = await routes.default.request("/qbit/test", { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(405);
    expect(body.error).toContain("disabled");
  });

  it("maps unknown key to 404", async () => {
    const res = await routes.default.request("/unknown/test", { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toContain("not found");
  });

});
