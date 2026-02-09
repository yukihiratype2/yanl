import { Hono } from "hono";
import { getAllSettings, setSettings, getSetting } from "../db/settings";
import { testAIConfig } from "../services/ai";
import { reconfigureLogger } from "../services/logger";

const settingsRoutes = new Hono();

// Get all settings
settingsRoutes.get("/", (c) => {
  const settings = getAllSettings();
  // Don't expose api_token in the listing
  const { api_token, ...rest } = settings;
  return c.json(rest);
});

// Update settings
settingsRoutes.put("/", async (c) => {
  let body: Record<string, string>;
  try {
    const parsed = await c.req.json<unknown>();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    body = parsed as Record<string, string>;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  // Prevent changing api_token through this endpoint
  delete body.api_token;
  setSettings(body);
  // Apply log settings (dir/level) immediately when updated.
  reconfigureLogger();
  return c.json({ success: true });
});

// Get API token (separate endpoint for security)
settingsRoutes.get("/token", (c) => {
  const token = getSetting("api_token");
  return c.json({ token });
});

// Test qBittorrent connection
settingsRoutes.post("/test-qbit", async (c) => {
  const { testConnection } = await import("../services/qbittorrent");
  const result = await testConnection();
  return c.json(result);
});

// Test AI configuration
settingsRoutes.post("/ai/test", async (c) => {
  try {
    const result = await testAIConfig();
    return c.json({ response: result });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default settingsRoutes;
