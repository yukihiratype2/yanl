import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initDatabase } from "./db";
import { authMiddleware } from "./middleware/auth";
import settingsRoutes from "./routes/settings";
import searchRoutes from "./routes/search";
import subscriptionRoutes from "./routes/subscriptions";
import torrentRoutes from "./routes/torrents";
import calendarRoutes from "./routes/calendar";
import monitorRoutes from "./routes/monitor";
import profileRoutes from "./routes/profiles";
import { getSetting } from "./db/settings";
import { startMonitor } from "./services/monitor";

// Initialize database
initDatabase();

// Start background monitor
startMonitor();

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", logger());

// Health check (no auth)
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth middleware for API routes
app.use("/api/*", authMiddleware);

// API routes
app.route("/api/settings", settingsRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/subscriptions", subscriptionRoutes);
app.route("/api/torrents", torrentRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/monitor", monitorRoutes);
app.route("/api/profiles", profileRoutes);

const port = parseInt(process.env.PORT || "3001");

console.log(`NAS Tools Backend running on http://localhost:${port}`);
console.log(`API Token: ${getSetting("api_token")}`);

export default {
  port,
  fetch: app.fetch,
};
