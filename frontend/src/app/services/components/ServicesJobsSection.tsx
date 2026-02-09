"use client";

import type { ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import type { JobStatus } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatRelativeTime, formatSchedule } from "../utils/format";

type Props = {
  jobs: JobStatus[];
  loading: boolean;
  runningJobs: Set<string>;
  onRefresh: () => void;
  onRunJob: (name: string) => void;
};

function jobStatusMeta(job: JobStatus, isRunning: boolean): {
  label: string;
  className: string;
  icon?: ReactNode;
} {
  if (isRunning) {
    return {
      label: "Running",
      className: "border-primary/40 bg-primary/10 text-primary",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    };
  }

  if (job.lastRunError) {
    return {
      label: "Error",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    };
  }

  if (job.lastRunAt) {
    return {
      label: "Healthy",
      className: "border-success/40 bg-success/10 text-success",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }

  return {
    label: "Idle",
    className: "border-border bg-muted/40 text-muted-foreground",
    icon: <Clock3 className="h-3 w-3" />,
  };
}

function JobCard({
  job,
  isRunning,
  onRun,
}: {
  job: JobStatus;
  isRunning: boolean;
  onRun: () => void;
}) {
  const status = jobStatusMeta(job, isRunning);
  const runDisabled = isRunning;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{job.description}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {job.name}
            </span>
            <Badge variant="outline" className={status.className}>
              {status.icon}
              {status.label}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatSchedule(job.schedule)}
            </span>
            {job.lastRunAt && (
              <span
                className="inline-flex items-center gap-1"
                title={formatDateTime(job.lastRunAt)}
              >
                Last: {formatRelativeTime(job.lastRunAt)}
                {job.lastRunDurationMs != null && (
                  <span className="text-muted-foreground/70">
                    ({(job.lastRunDurationMs / 1000).toFixed(1)}s)
                  </span>
                )}
              </span>
            )}
            {job.nextRunAt && (
              <span
                className="inline-flex items-center gap-1"
                title={formatDateTime(job.nextRunAt)}
              >
                Next: {formatRelativeTime(job.nextRunAt)}
              </span>
            )}
          </div>

          {job.lastRunError && (
            <div className="mt-3 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{job.lastRunError}</span>
            </div>
          )}
        </div>

        <Button
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          disabled={runDisabled}
          onClick={onRun}
          title="Run now"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run now
        </Button>
      </div>
    </div>
  );
}

export default function ServicesJobsSection({
  jobs,
  loading,
  runningJobs,
  onRefresh,
  onRunJob,
}: Props) {
  const sortedJobs = [...jobs].sort((a, b) => {
    const aRunning = a.running || runningJobs.has(a.name);
    const bRunning = b.running || runningJobs.has(b.name);

    const rank = (job: JobStatus, running: boolean) => {
      if (running) return 0;
      if (job.lastRunError) return 1;
      if (!job.lastRunAt) return 2;
      return 3;
    };

    return rank(a, aRunning) - rank(b, bRunning);
  });

  return (
    <Card className="py-0">
      <CardHeader className="gap-0 border-b py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Background Jobs
            </CardTitle>
            <CardDescription className="mt-1">
              Scheduled monitor tasks with live run state and recent execution signals.
            </CardDescription>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

      </CardHeader>

      <CardContent className="py-5">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No monitor jobs registered.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedJobs.map((job) => (
              <JobCard
                key={job.name}
                job={job}
                isRunning={job.running || runningJobs.has(job.name)}
                onRun={() => onRunJob(job.name)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
