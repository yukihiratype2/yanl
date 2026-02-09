import { Hono } from "hono";
import { getJobStatuses, runJobNow } from "../services/monitor";
import { logger } from "../services/logger";

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
    logger.warn(
      {
        op: "monitor.job.manual_trigger_failed",
        job: name,
        reason: "not_found_or_already_running",
      },
      "Manual monitor job trigger failed"
    );
    return c.json({ error: "Job not found or already running" }, 404);
  }
  logger.info(
    {
      op: "monitor.job.manual_triggered",
      job: name,
    },
    "Manual monitor job trigger accepted"
  );
  return c.json({ success: true, message: `Job "${name}" triggered` });
});

export default monitorRoutes;
