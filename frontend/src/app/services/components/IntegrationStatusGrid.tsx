"use client";

import Link from "next/link";
import {
  Bell,
  Brain,
  Download,
  ExternalLink,
  Film,
  Loader2,
  PlugZap,
  Tv,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { IntegrationKey, IntegrationStatusState } from "../types";
import { formatDateTime, formatRelativeTime } from "../utils/format";

type Props = {
  integrations: IntegrationStatusState[];
  onTest: (key: IntegrationKey) => void;
  disabled?: boolean;
};

function statusMeta(status: IntegrationStatusState["status"]): {
  label: string;
  className: string;
} {
  switch (status) {
    case "ok":
      return {
        label: "Healthy",
        className: "border-success/40 bg-success/10 text-success",
      };
    case "error":
      return {
        label: "Error",
        className: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    case "testing":
      return {
        label: "Testing",
        className: "border-primary/40 bg-primary/10 text-primary",
      };
    case "not_configured":
      return {
        label: "Not configured",
        className: "border-warning/40 bg-warning/10 text-warning",
      };
    default:
      return {
        label: "Pending",
        className: "border-border bg-muted/40 text-muted-foreground",
      };
  }
}

function integrationIcon(key: IntegrationKey) {
  switch (key) {
    case "qbit":
      return <Download className="h-4 w-4" />;
    case "ai":
      return <Brain className="h-4 w-4" />;
    case "tmdb":
      return <Film className="h-4 w-4" />;
    case "bgm":
      return <Tv className="h-4 w-4" />;
    case "notifaction":
      return <Bell className="h-4 w-4" />;
    default:
      return <PlugZap className="h-4 w-4" />;
  }
}

export default function IntegrationStatusGrid({
  integrations,
  onTest,
  disabled = false,
}: Props) {
  return (
    <Card className="py-0">
      <CardHeader className="gap-0 border-b py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Integration Health</CardTitle>
            <CardDescription className="mt-1">
              Backend-driven continuous monitoring with manual test triggers.
            </CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/settings/integrations">
              Edit Integrations
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="py-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {integrations.map((integration) => {
            const badge = statusMeta(integration.status);
            const checkedAtLabel = integration.checkedAt
              ? `Last checked ${formatRelativeTime(integration.checkedAt)}`
              : integration.configured
                ? "Waiting for first health check"
                : "Configure in Settings";
            const nextCheckLabel = integration.nextCheckAt
              ? `Next check ${formatRelativeTime(integration.nextCheckAt)}`
              : "No next check scheduled";
            const message =
              integration.message ||
              (integration.configured ? "No status yet" : "Not configured");

            return (
              <div
                key={integration.key}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {integrationIcon(integration.key)}
                    {integration.label}
                  </div>
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">{integration.description}</p>
                <p
                  className={`mt-2 text-sm ${
                    integration.status === "error"
                      ? "text-destructive"
                      : integration.status === "not_configured"
                        ? "text-warning"
                        : "text-foreground"
                  }`}
                >
                  {message}
                </p>

                <div className="mt-3 space-y-1">
                  <p
                    className="text-xs text-muted-foreground"
                    title={
                      integration.checkedAt
                        ? formatDateTime(integration.checkedAt)
                        : undefined
                    }
                  >
                    {checkedAtLabel}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    title={
                      integration.nextCheckAt
                        ? formatDateTime(integration.nextCheckAt)
                        : integration.schedule
                    }
                  >
                    {nextCheckLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">Schedule: {integration.schedule}</p>
                </div>

                {integration.testSupported && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      disabled={disabled || integration.loading || integration.running}
                      onClick={() => onTest(integration.key)}
                    >
                      {integration.loading || integration.running ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {integration.loading || integration.running ? "Testing..." : "Test now"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
