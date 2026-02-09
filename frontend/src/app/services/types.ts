export type IntegrationKey =
  | "qbit"
  | "ai"
  | "tmdb"
  | "bgm"
  | "mikan"
  | "dmhy"
  | "notifaction";

export type IntegrationHealth =
  | "unknown"
  | "not_configured"
  | "testing"
  | "ok"
  | "error";

export interface IntegrationStatusState {
  key: IntegrationKey;
  label: string;
  description: string;
  configured: boolean;
  testSupported: boolean;
  status: IntegrationHealth;
  message: string | null;
  checkedAt: string | null;
  running: boolean;
  schedule: string;
  nextCheckAt: string | null;
  loading: boolean;
}

export interface BulkRunResult {
  name: string;
  description: string;
  ok: boolean;
  message: string;
}

export interface BulkRunState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  currentJob: string | null;
  results: BulkRunResult[];
  summary: string | null;
}

export interface ServicesSummaryMetrics {
  totalJobs: number;
  runningJobs: number;
  needsAttention: number;
  nextDueAt: string | null;
  nextDueLabel: string;
}
