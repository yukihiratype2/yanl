export type IntegrationKey =
  | "qbit"
  | "ai"
  | "tmdb"
  | "bgm"
  | "mikan"
  | "dmhy"
  | "notifaction";

export type IntegrationHealth =
  | "not_used"
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

export interface ServicesSummaryMetrics {
  totalJobs: number;
  runningJobs: number;
  jobsNeedingAttention: number;
  integrationsHealthy: number;
  integrationsTotal: number;
  integrationsNeedingAttention: number;
  nextActivityAt: string | null;
  nextActivityLabel: string;
}
