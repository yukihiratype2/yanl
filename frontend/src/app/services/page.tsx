"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getIntegrationStatuses,
  getMonitorJobs,
  getStoredToken,
  runMonitorJob,
  setToken,
  testIntegration,
  type IntegrationStatus,
  type JobStatus,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import IntegrationStatusGrid from "./components/IntegrationStatusGrid";
import ServicesJobsSection from "./components/ServicesJobsSection";
import ServicesSummaryCards from "./components/ServicesSummaryCards";
import type { IntegrationStatusState, ServicesSummaryMetrics } from "./types";
import { formatRelativeTime } from "./utils/format";

const POLL_INTERVAL_MS = 15_000;

function isAuthErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    message.includes("401") ||
    normalized.includes("invalid token") ||
    normalized.includes("missing authorization")
  );
}

function mergeIntegrations(
  prev: IntegrationStatusState[],
  incoming: IntegrationStatus[]
): IntegrationStatusState[] {
  const prevMap = new Map(prev.map((item) => [item.key, item]));
  return incoming.map((item) => {
    const existing = prevMap.get(item.key);
    return {
      ...item,
      status: (existing?.loading || existing?.running) ? existing.status : item.status,
      message: (existing?.loading || existing?.running) ? existing.message : item.message,
      loading: existing?.loading ?? false,
      running: existing?.loading || item.running,
    };
  });
}

export default function ServicesPage() {
  const [token, setTokenState] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatusState[]>([]);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) {
      setJobsLoading(true);
      setIntegrationsLoading(true);
      setActionMessage(null);
    }

    const [jobsResult, integrationsResult] = await Promise.allSettled([
      getMonitorJobs(),
      getIntegrationStatuses(),
    ]);

    let sawAuthError = false;

    if (jobsResult.status === "fulfilled") {
      setJobs(jobsResult.value.jobs);
      setJobsError(null);
      setNeedsAuth(false);
    } else {
      const message = getErrorMessage(jobsResult.reason, "Failed to load background jobs");
      if (isAuthErrorMessage(message)) {
        sawAuthError = true;
      } else {
        setJobsError(message);
      }
    }

    if (integrationsResult.status === "fulfilled") {
      setIntegrations((prev) => mergeIntegrations(prev, integrationsResult.value.integrations));
      setIntegrationsError(null);
      setNeedsAuth(false);
    } else {
      const message = getErrorMessage(
        integrationsResult.reason,
        "Failed to load integration health"
      );
      if (isAuthErrorMessage(message)) {
        sawAuthError = true;
      } else {
        setIntegrationsError(message);
      }
    }

    if (sawAuthError) {
      setNeedsAuth(true);
      setGlobalError("Authentication required. Enter a valid API token.");
    } else {
      setNeedsAuth(false);
      setGlobalError(null);
    }

    setJobsLoading(false);
    setIntegrationsLoading(false);
    setInitialLoading(false);
  }, []);

  useEffect(() => {
    setTokenState(getStoredToken());
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !needsAuth) {
        void loadData({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(id);
    };
  }, [loadData, needsAuth]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !needsAuth) {
        void loadData({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadData, needsAuth]);

  function handleTokenSave() {
    setToken(token);
    setInitialLoading(true);
    setNeedsAuth(false);
    void loadData();
  }

  async function runJob(name: string) {
    try {
      setRunningJobs((prev) => new Set(prev).add(name));
      setGlobalError(null);
      setActionMessage(null);
      await runMonitorJob(name);
      setActionMessage(`Triggered job: ${name}`);
      setTimeout(() => {
        void loadData({ silent: true });
      }, 800);
    } catch (err: unknown) {
      setGlobalError(getErrorMessage(err, "Failed to run background job"));
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  async function runIntegrationTest(key: IntegrationStatusState["key"]) {
    setGlobalError(null);
    setActionMessage(null);

    setIntegrations((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              loading: true,
              running: true,
              status: "testing",
              message: "Testing now...",
            }
          : item
      )
    );

    try {
      const result = await testIntegration(key);
      setIntegrations((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                ...result.status,
                loading: false,
              }
            : item
        )
      );
      setActionMessage(`Integration test completed: ${result.status.label}`);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to test integration");
      if (message.toLowerCase().includes("already running")) {
        setActionMessage("Integration check is already running.");
      } else {
        setGlobalError(message);
      }
      setIntegrations((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, loading: false, running: false } : item
        )
      );
    } finally {
      setTimeout(() => {
        void loadData({ silent: true });
      }, 800);
    }
  }

  const metrics = useMemo<ServicesSummaryMetrics>(() => {
    const jobsRunning = jobs.filter((job) => job.running || runningJobs.has(job.name)).length;
    const jobsNeedingAttention = jobs.filter((job) => Boolean(job.lastRunError)).length;

    const integrationsTotal = integrations.length;
    const integrationsHealthy = integrations.filter(
      (integration) => integration.status === "ok"
    ).length;
    const integrationsNeedingAttention = integrations.filter(
      (integration) => integration.status === "error"
    ).length;

    const nextCandidates = [
      ...jobs.map((job) => job.nextRunAt).filter(Boolean),
      ...integrations.map((integration) => integration.nextCheckAt).filter(Boolean),
    ] as string[];
    const nextActivityAt = nextCandidates.sort()[0] ?? null;

    return {
      totalJobs: jobs.length,
      runningJobs: jobsRunning,
      jobsNeedingAttention,
      integrationsHealthy,
      integrationsTotal,
      integrationsNeedingAttention,
      nextActivityAt,
      nextActivityLabel: nextActivityAt ? formatRelativeTime(nextActivityAt) : "None scheduled",
    };
  }, [jobs, integrations, runningJobs]);

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
          {globalError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{globalError}</AlertDescription>
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" /> Services
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor background jobs and integration health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void loadData()}
            disabled={jobsLoading || integrationsLoading}
          >
            {(jobsLoading || integrationsLoading) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {globalError && (
        <Alert variant="destructive">
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {actionMessage && (
        <Alert className="border-success/40 bg-success/10 text-success [&>svg]:text-success">
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      )}

      <ServicesSummaryCards metrics={metrics} />

      {jobsError && (
        <Alert variant="destructive">
          <AlertDescription>{jobsError}</AlertDescription>
        </Alert>
      )}

      <ServicesJobsSection
        jobs={jobs}
        loading={jobsLoading}
        onRefresh={() => void loadData()}
        onRunJob={(name) => void runJob(name)}
        runningJobs={runningJobs}
      />

      {integrationsError && (
        <Alert variant="destructive">
          <AlertDescription>{integrationsError}</AlertDescription>
        </Alert>
      )}

      <IntegrationStatusGrid
        integrations={integrations}
        loading={integrationsLoading}
        onTest={(key) => void runIntegrationTest(key)}
      />
    </div>
  );
}
