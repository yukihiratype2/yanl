"use client";

import {
  Activity,
  RefreshCw,
  Loader2,
  Clock,
  Check,
  AlertCircle,
  Play,
} from "lucide-react";
import type { JobStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Section } from "./Section";

type Props = {
  jobs: JobStatus[];
  loading: boolean;
  onRefresh: () => void;
  onRunJob: (name: string) => void;
  runningJobs: Set<string>;
};

export default function JobsSection({ jobs, loading, onRefresh, onRunJob, runningJobs }: Props) {
  return (
    <Section title="Background Jobs" icon={<Activity className="w-5 h-5" />}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          Scheduled tasks that run automatically in the background.
        </p>
        <Button
          onClick={onRefresh}
          disabled={loading}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.name}
              job={job}
              triggering={runningJobs.has(job.name)}
              onRun={() => onRunJob(job.name)}
            />
          ))}
          {jobs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">No jobs found</p>
          )}
        </div>
      )}
    </Section>
  );
}

function formatSchedule(cron: string): string {
  const map: Record<string, string> = {
    "0 0 * * *": "Daily at midnight",
    "0 * * * *": "Every hour",
    "*/5 * * * *": "Every 5 minutes",
    "*/10 * * * *": "Every 10 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
  };
  return map[cron] || cron;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  if (absDiff < 60_000) {
    const secs = Math.round(absDiff / 1000);
    return isFuture ? `in ${secs}s` : `${secs}s ago`;
  }
  if (absDiff < 3_600_000) {
    const mins = Math.round(absDiff / 60_000);
    return isFuture ? `in ${mins}m` : `${mins}m ago`;
  }
  if (absDiff < 86_400_000) {
    const hrs = Math.round(absDiff / 3_600_000);
    return isFuture ? `in ${hrs}h` : `${hrs}h ago`;
  }
  const days = Math.round(absDiff / 86_400_000);
  return isFuture ? `in ${days}d` : `${days}d ago`;
}

function JobCard({
  job,
  triggering,
  onRun,
}: {
  job: JobStatus;
  triggering: boolean;
  onRun: () => void;
}) {
  const isRunning = job.running || triggering;

  return (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{job.description}</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatSchedule(job.schedule)}
            </span>

            {job.lastRunAt && (
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                Last: {formatRelativeTime(job.lastRunAt)}
                {job.lastRunDurationMs != null && (
                  <span className="text-muted-foreground/60">
                    ({(job.lastRunDurationMs / 1000).toFixed(1)}s)
                  </span>
                )}
              </span>
            )}

            {job.nextRunAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Next: {formatRelativeTime(job.nextRunAt)}
              </span>
            )}
          </div>

          {job.lastRunError && (
            <div className="flex items-start gap-1 mt-2 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="break-all">{job.lastRunError}</span>
            </div>
          )}
        </div>

        <Button
          onClick={onRun}
          disabled={isRunning}
          title="Run now"
          size="sm"
          className="h-8 gap-1.5 text-xs shrink-0"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run Now
        </Button>
      </div>
    </div>
  );
}
