import cron from "node-cron";
import { logger } from "../logger";
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
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  lastRunError: string | null;
  task: ReturnType<typeof cron.schedule> | null;
  fn: () => Promise<void>;
}

type JobName = "checkNewEpisodes" | "searchAndDownload" | "monitorDownloads";

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
    lastRunAt: null,
    lastRunDurationMs: null,
    lastRunError: null,
    task: null,
    fn,
  };

  entry.task = cron.schedule(schedule, () => {
    runJobInternal(entry);
  });

  jobs.set(name, entry);
}

async function runJobInternal(entry: JobEntry) {
  if (entry.running) {
    logger.warn({ job: entry.name }, "Job already running, skipping.");
    return;
  }

  entry.running = true;
  entry.lastRunError = null;
  const start = Date.now();
  logger.info({ job: entry.name }, "Running job");

  try {
    await entry.fn();
  } catch (err: any) {
    entry.lastRunError = err?.message || String(err);
    logger.error({ job: entry.name, err }, "Job failed");
  } finally {
    entry.lastRunAt = new Date();
    entry.lastRunDurationMs = Date.now() - start;
    entry.running = false;
  }
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
  runJobInternal(entry);
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
  if (entry) runJobInternal(entry);
}
