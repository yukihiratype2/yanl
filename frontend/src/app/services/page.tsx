"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, Play, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMonitorJobs,
  getStoredToken,
  runMonitorJob,
  setToken,
  type JobStatus,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import ServicesJobsSection from "./components/ServicesJobsSection";

function isAuthErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    message.includes("401") ||
    normalized.includes("invalid token") ||
    normalized.includes("missing authorization")
  );
}

export default function ServicesPage() {
  const [token, setTokenState] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkCurrentJob, setBulkCurrentJob] = useState<string | null>(null);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) {
      setJobsLoading(true);
    }
    try {
      const data = await getMonitorJobs();
      setJobs(data.jobs);
      setNeedsAuth(false);
      if (!opts.silent) {
        setError(null);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to load background jobs");
      if (isAuthErrorMessage(message)) {
        setNeedsAuth(true);
      } else if (!opts.silent) {
        setError(message);
      }
    } finally {
      setJobsLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    setTokenState(getStoredToken());
    void loadJobs();
  }, [loadJobs]);

  function handleTokenSave() {
    setToken(token);
    setInitialLoading(true);
    void loadJobs();
  }

  async function runJob(name: string) {
    try {
      setRunningJobs((prev) => new Set(prev).add(name));
      setError(null);
      await runMonitorJob(name);
      setTimeout(() => {
        void loadJobs({ silent: true });
      }, 1000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to run background job"));
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  async function runAllJobs() {
    if (bulkRunning || jobs.length === 0) return;

    setBulkRunning(true);
    setBulkCurrentJob(null);
    setBulkSummary(null);
    setError(null);

    const failed: string[] = [];

    for (const job of jobs) {
      setBulkCurrentJob(job.name);
      try {
        setRunningJobs((prev) => new Set(prev).add(job.name));
        await runMonitorJob(job.name);
      } catch {
        failed.push(job.description);
      } finally {
        setRunningJobs((prev) => {
          const next = new Set(prev);
          next.delete(job.name);
          return next;
        });
      }
    }

    setBulkRunning(false);
    setBulkCurrentJob(null);

    if (failed.length === 0) {
      setBulkSummary(`Triggered ${jobs.length}/${jobs.length} jobs successfully.`);
    } else {
      setBulkSummary(
        `Triggered ${jobs.length - failed.length}/${jobs.length} jobs. Failed: ${failed.join(", ")}`
      );
    }

    setTimeout(() => {
      void loadJobs({ silent: true });
    }, 1000);
  }

  if (needsAuth && !initialLoading) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Activity className="w-6 h-6" /> Services
        </h1>
        <div className="bg-card rounded-xl p-6 border border-border">
          <label className="block text-sm font-medium mb-2">API Token</label>
          <p className="text-xs text-muted-foreground mb-4">
            An API token is required for remote access. Local network access does not require a token.
          </p>
          <Input
            type="text"
            value={token}
            onChange={(e) => setTokenState(e.target.value)}
            placeholder="Your API token"
          />
          <Button
            onClick={() => void handleTokenSave()}
            className="mt-4 w-full"
          >
            Connect
          </Button>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" /> Services
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dedicated controls for monitor background jobs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void loadJobs()}
            disabled={jobsLoading || bulkRunning}
          >
            {jobsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
          <Button
            onClick={() => void runAllJobs()}
            disabled={bulkRunning || jobs.length === 0}
          >
            {bulkRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {bulkRunning ? `Run All (${bulkCurrentJob ?? "running"})` : "Run All Jobs"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {bulkSummary && (
        <Alert
          className={
            bulkSummary.includes("Failed:")
              ? "border-warning/40 bg-warning/10 text-warning [&>svg]:text-warning"
              : "border-success/40 bg-success/10 text-success [&>svg]:text-success"
          }
        >
          <AlertDescription>{bulkSummary}</AlertDescription>
        </Alert>
      )}

      <ServicesJobsSection
        jobs={jobs}
        loading={jobsLoading}
        onRefresh={() => void loadJobs()}
        onRunJob={(name) => void runJob(name)}
        runningJobs={runningJobs}
        bulkRunning={bulkRunning}
        bulkCurrentJob={bulkCurrentJob}
      />
    </div>
  );
}
