import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { initDatabase } from "./db";
import { authMiddleware } from "./middleware/auth";
import settingsRoutes from "./routes/settings";
import searchRoutes from "./routes/search";
import subscriptionRoutes from "./routes/subscriptions";
import torrentRoutes from "./routes/torrents";
import calendarRoutes from "./routes/calendar";
import monitorRoutes from "./routes/monitor";
import integrationsRoutes from "./routes/integrations";
import profileRoutes from "./routes/profiles";
import sonarrRoutes from "./routes/sonarr";
import { registerMcpRoutes } from "./mcp/router";
import { getSetting } from "./db/settings";
import { startMonitor } from "./services/monitor";
import { startIntegrationHealthMonitor } from "./services/integration-health";
import { createRequestId, logger, maskToken, withLogContext } from "./services/logger";

// Initialize database
initDatabase();

// Start background monitor
startMonitor();
startIntegrationHealthMonitor();

const app = new Hono<{ Variables: { requestId: string } }>();

// Global middleware
app.use("*", cors());
app.use("*", async (c, next) => {
  const requestId = createRequestId(c.req.header("x-request-id"));
  const method = c.req.method;
  const path = c.req.path;
  const start = Date.now();

  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  return withLogContext({ requestId }, async () => {
    let hasError = false;
    try {
      await next();
    } catch (err) {
      hasError = true;
      throw err;
    } finally {
      c.header("X-Request-Id", requestId);
      logger.trace(
        {
          op: "http.access",
          method,
          path,
          status: hasError ? 500 : c.res.status,
          durationMs: Date.now() - start,
        },
        hasError ? "HTTP request failed" : "HTTP request completed"
      );
    }
  });
});

app.onError((err, c) => {
  const requestId =
    c.get("requestId") ||
    createRequestId(c.req.header("x-request-id"));
  const method = c.req.method;
  const path = c.req.path;
  const status = err instanceof HTTPException ? err.status : 500;

  return withLogContext({ requestId }, () => {
    logger.error(
      {
        op: "http.unhandled_error",
        method,
        path,
        status,
        err,
      },
      "Unhandled HTTP error"
    );

    if (err instanceof HTTPException) {
      const response = err.getResponse();
      response.headers.set("X-Request-Id", requestId);
      return response;
    }

    const response = c.text("Internal Server Error", 500);
    response.headers.set("X-Request-Id", requestId);
    return response;
  });
});

// Health check (no auth)
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth middleware for API routes
app.use("/api/*", authMiddleware);
app.use("/mcp", authMiddleware);
app.use("/mcp/*", authMiddleware);

// API routes
app.route("/api/settings", settingsRoutes);
app.route("/api/v3", sonarrRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/subscriptions", subscriptionRoutes);
app.route("/api/torrents", torrentRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/monitor", monitorRoutes);
app.route("/api/integrations", integrationsRoutes);
app.route("/api/profiles", profileRoutes);
registerMcpRoutes(app);

const port = parseInt(process.env.PORT || "3001");

logger.info(
  {
    op: "server.start",
    port,
    url: `http://localhost:${port}`,
  },
  "NAS Tools Backend running"
);
logger.info(
  {
    op: "auth.token_loaded",
    maskedApiToken: maskToken(getSetting("api_token")),
  },
  "API token loaded"
);

export default {
  port,
  fetch: app.fetch,
};
