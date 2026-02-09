"use client";

import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListChecks,
  PlugZap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ServicesSummaryMetrics } from "../types";
import { formatDateTime } from "../utils/format";

type Props = {
  metrics: ServicesSummaryMetrics;
};

type MetricCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  subvalue?: string;
  tone?: "default" | "success" | "danger";
};

function MetricCard({
  label,
  value,
  icon,
  subvalue,
  tone = "default",
}: MetricCardProps) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : "text-foreground";

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
        {subvalue && <p className="mt-1 text-xs text-muted-foreground">{subvalue}</p>}
      </CardContent>
    </Card>
  );
}

export default function ServicesSummaryCards({ metrics }: Props) {
  const nextActivitySubvalue = metrics.nextActivityAt
    ? formatDateTime(metrics.nextActivityAt)
    : "No upcoming scheduled activity";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Jobs Total"
        value={String(metrics.totalJobs)}
        icon={<ListChecks className="h-4 w-4" />}
      />
      <MetricCard
        label="Jobs Running"
        value={String(metrics.runningJobs)}
        icon={<Activity className="h-4 w-4" />}
        tone={metrics.runningJobs > 0 ? "success" : "default"}
      />
      <MetricCard
        label="Jobs Needing Attention"
        value={String(metrics.jobsNeedingAttention)}
        icon={<AlertTriangle className="h-4 w-4" />}
        tone={metrics.jobsNeedingAttention > 0 ? "danger" : "success"}
      />
      <MetricCard
        label="Integrations Healthy"
        value={`${metrics.integrationsHealthy}/${metrics.integrationsTotal}`}
        icon={<CheckCircle2 className="h-4 w-4" />}
        tone={
          metrics.integrationsHealthy === metrics.integrationsTotal
            ? "success"
            : "default"
        }
      />
      <MetricCard
        label="Integrations Needing Attention"
        value={String(metrics.integrationsNeedingAttention)}
        icon={<PlugZap className="h-4 w-4" />}
        tone={metrics.integrationsNeedingAttention > 0 ? "danger" : "success"}
      />
      <MetricCard
        label="Next Scheduled Activity"
        value={metrics.nextActivityLabel}
        subvalue={nextActivitySubvalue}
        icon={<Clock3 className="h-4 w-4" />}
      />
    </div>
  );
}
