"use client";

import type { ReactNode } from "react";
import { Activity, AlertTriangle, Clock3, ListChecks } from "lucide-react";
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
  const nextDueSubvalue = metrics.nextDueAt
    ? formatDateTime(metrics.nextDueAt)
    : "No upcoming run";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Total Jobs"
        value={String(metrics.totalJobs)}
        icon={<ListChecks className="h-4 w-4" />}
      />
      <MetricCard
        label="Running"
        value={String(metrics.runningJobs)}
        icon={<Activity className="h-4 w-4" />}
        tone={metrics.runningJobs > 0 ? "success" : "default"}
      />
      <MetricCard
        label="Needs Attention"
        value={String(metrics.needsAttention)}
        icon={<AlertTriangle className="h-4 w-4" />}
        tone={metrics.needsAttention > 0 ? "danger" : "success"}
      />
      <MetricCard
        label="Next Due"
        value={metrics.nextDueLabel}
        subvalue={nextDueSubvalue}
        icon={<Clock3 className="h-4 w-4" />}
      />
    </div>
  );
}
