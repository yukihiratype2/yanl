import { Hono } from "hono";
import {
  getIntegrationStatuses,
  runIntegrationCheck,
} from "../services/integration-health";

const integrationsRoutes = new Hono();

integrationsRoutes.get("/status", (c) => {
  const integrations = getIntegrationStatuses();
  return c.json({ integrations });
});

integrationsRoutes.post("/:key/test", async (c) => {
  const key = c.req.param("key");
  const result = await runIntegrationCheck(key);

  if (result.reason === "not_found") {
    return c.json({ error: "Integration not found" }, 404);
  }
  return c.json(
    { error: "Manual integration health checks are disabled in passive mode" },
    405
  );
});

export default integrationsRoutes;
