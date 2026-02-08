import { Hono } from "hono";
import { getEpisodesWithAirDateRange } from "../db/models";

const calendarRoutes = new Hono();

// Get episodes for calendar view
calendarRoutes.get("/", (c) => {
  const start = c.req.query("start");
  const end = c.req.query("end");

  if (!start || !end) {
    return c.json(
      { error: "Missing 'start' and 'end' query parameters (YYYY-MM-DD)" },
      400
    );
  }

  const episodes = getEpisodesWithAirDateRange(start, end);

  // Group by date for calendar view
  const grouped: Record<
    string,
    typeof episodes
  > = {};

  for (const ep of episodes) {
    const date = ep.air_date || "unknown";
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(ep);
  }

  return c.json({ episodes, grouped });
});

export default calendarRoutes;
