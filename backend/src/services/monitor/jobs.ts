import cron from "node-cron";
import { createRequestId, logger, withLogContext } from "../logger";
import { checkNewEpisodes } from "./discovery";
import { searchAndDownload } from "./downloads";
import { monitorDownloads } from "./download-monitor";

export interface JobStatus {
  name: string;
  description: string;
  schedule: string;
  running: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastRunError: string | null;
  nextRunAt: string | null;
}

interface JobEntry {
  name: string;
  description: string;
  schedule: string;
  running: boolean;
  activeJobRunId: string | null;
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  lastRunError: string | null;
  task: ReturnType<typeof cron.schedule> | null;
  fn: () => Promise<void>;
}

type JobName = "checkNewEpisodes" | "searchAndDownload" | "monitorDownloads";
type JobTrigger = "schedule" | "manual" | "startup";

const JOB_SCHEDULES: Record<JobName, string> = {
  checkNewEpisodes: "0 0 * * *", // Every day at midnight
  searchAndDownload: "0 * * * *", // Every hour
  monitorDownloads: "*/5 * * * *", // Every 5 minutes
};

const jobs: Map<string, JobEntry> = new Map();

function registerJob(
  name: string,
  description: string,
  schedule: string,
  fn: () => Promise<void>
) {
  const entry: JobEntry = {
    name,
    description,
    schedule,
    running: false,
    activeJobRunId: null,
    lastRunAt: null,
    lastRunDurationMs: null,
    lastRunError: null,
    task: null,
    fn,
  };

  entry.task = cron.schedule(schedule, () => {
    void runJobInternal(entry, "schedule");
  });

  jobs.set(name, entry);
}

async function runJobInternal(entry: JobEntry, trigger: JobTrigger) {
  if (entry.running) {
    logger.warn(
      {
        op: "monitor.job.skipped",
        job: entry.name,
        trigger,
        activeJobRunId: entry.activeJobRunId,
      },
      "Job already running, skipping"
    );
    return;
  }

  const jobRunId = createRequestId();
  entry.running = true;
  entry.activeJobRunId = jobRunId;
  entry.lastRunError = null;
  const start = Date.now();

  await withLogContext({ job: entry.name, jobRunId, trigger }, async () => {
    logger.info(
      {
        op: "monitor.job.start",
        schedule: entry.schedule,
      },
      "Running job"
    );

    let failedErr: unknown = null;
    try {
      await entry.fn();
    } catch (err) {
      failedErr = err;
      entry.lastRunError = (err as any)?.message || String(err);
    } finally {
      const durationMs = Date.now() - start;
      entry.lastRunAt = new Date();
      entry.lastRunDurationMs = durationMs;
      entry.running = false;
      entry.activeJobRunId = null;

      if (failedErr) {
        logger.error(
          {
            op: "monitor.job.failed",
            durationMs,
            err: failedErr,
          },
          "Job failed"
        );
        return;
      }

      logger.info(
        {
          op: "monitor.job.success",
          durationMs,
        },
        "Job completed"
      );
    }
  });
}

export function getJobStatuses(): JobStatus[] {
  return Array.from(jobs.values()).map((j) => ({
    name: j.name,
    description: j.description,
    schedule: j.schedule,
    running: j.running,
    lastRunAt: j.lastRunAt?.toISOString() ?? null,
    lastRunDurationMs: j.lastRunDurationMs,
    lastRunError: j.lastRunError,
    nextRunAt: j.task?.getNextRun()?.toISOString() ?? null,
  }));
}

export async function runJobNow(name: string): Promise<boolean> {
  const entry = jobs.get(name);
  if (!entry) return false;
  // Run in background, don't await
  void runJobInternal(entry, "manual");
  return true;
}

export function startMonitor() {
  logger.info("Starting background monitor...");

  registerJob(
    "checkNewEpisodes",
    "Check TMDB for newly aired episodes",
    JOB_SCHEDULES.checkNewEpisodes,
    checkNewEpisodes
  );
  registerJob(
    "searchAndDownload",
    "Search RSS feeds and start downloads",
    JOB_SCHEDULES.searchAndDownload,
    searchAndDownload
  );
  registerJob(
    "monitorDownloads",
    "Monitor active downloads and organize files",
    JOB_SCHEDULES.monitorDownloads,
    monitorDownloads
  );

  // Initial run on startup
  const entry = jobs.get("checkNewEpisodes");
  if (entry) void runJobInternal(entry, "startup");
}
