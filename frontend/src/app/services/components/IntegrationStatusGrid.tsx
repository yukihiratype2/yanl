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
  Rss,
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
  loading?: boolean;
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
    case "not_used":
      return {
        label: "Not used",
        className: "border-border bg-muted/40 text-muted-foreground",
      };
    default:
      return {
        label: "Unknown",
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
    case "mikan":
    case "dmhy":
      return <Rss className="h-4 w-4" />;
    case "notifaction":
      return <Bell className="h-4 w-4" />;
    default:
      return <PlugZap className="h-4 w-4" />;
  }
}

export default function IntegrationStatusGrid({
  integrations,
  onTest,
  loading = false,
  disabled = false,
}: Props) {
  return (
    <Card className="py-0">
      <CardHeader className="gap-0 border-b py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Integration Health</CardTitle>
            <CardDescription className="mt-1">
              Passive backend monitoring from real integration usage.
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
        {loading && integrations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : integrations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No integrations available.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {integrations.map((integration) => {
            const badge = statusMeta(integration.status);
            const checkedAtLabel = integration.checkedAt
              ? `Last checked ${formatRelativeTime(integration.checkedAt)}`
              : "Not used yet";
            const nextCheckLabel = integration.nextCheckAt
              ? `Next check ${formatRelativeTime(integration.nextCheckAt)}`
              : "Passive monitor (on usage)";
            const message =
              integration.message ||
              "No calls yet";

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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {integration.configured ? "Configured" : "Not configured"}
                  </p>
                  <p
                    className={`mt-2 text-sm ${
                      integration.status === "error"
                        ? "text-destructive"
                        : integration.status === "not_used"
                          ? "text-muted-foreground"
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
        )}
      </CardContent>
    </Card>
  );
}
