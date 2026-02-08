import { Hono } from "hono";
import { getJobStatuses, runJobNow } from "../services/monitor";

const monitorRoutes = new Hono();

// Get all job statuses
monitorRoutes.get("/jobs", (c) => {
  const jobs = getJobStatuses();
  return c.json({ jobs });
});

// Trigger a job immediately
monitorRoutes.post("/jobs/:name/run", async (c) => {
  const name = c.req.param("name");
  const started = await runJobNow(name);
  if (!started) {
    return c.json({ error: "Job not found or already running" }, 404);
  }
  return c.json({ success: true, message: `Job "${name}" triggered` });
});

export default monitorRoutes;
