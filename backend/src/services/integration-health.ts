import { loadConfig } from "../config";
import { getSetting } from "../db/settings";
import { logger } from "./logger";

export type IntegrationKey =
  | "qbit"
  | "ai"
  | "tmdb"
  | "bgm"
  | "mikan"
  | "dmhy"
  | "notifaction";

export type IntegrationHealthStatus = "not_used" | "ok" | "error";

export interface IntegrationStatus {
  key: IntegrationKey;
  label: string;
  category: string;
  description: string;
  configured: boolean;
  testSupported: boolean;
  status: IntegrationHealthStatus;
  message: string | null;
  checkedAt: string | null;
  running: boolean;
  schedule: string;
  nextCheckAt: string | null;
}

type RunIntegrationCheckResult =
  | { ok: false; reason: "not_found" | "manual_disabled" };

type IntegrationEntry = {
  key: IntegrationKey;
  label: string;
  category: string;
  description: string;
  status: IntegrationHealthStatus;
  message: string | null;
  checkedAt: string | null;
};

const INTEGRATION_ORDER: IntegrationKey[] = [
  "qbit",
  "ai",
  "tmdb",
  "bgm",
  "mikan",
  "dmhy",
  "notifaction",
];

const entries: Map<IntegrationKey, IntegrationEntry> = new Map();
let started = false;

function ensureInitialized() {
  if (entries.size > 0) return;

  entries.set("qbit", {
    key: "qbit",
    label: "qBittorrent",
    category: "download",
    description: "Availability based on real qBittorrent API calls.",
    status: "not_used",
    message: "No calls yet",
    checkedAt: null,
  });

  entries.set("ai", {
    key: "ai",
    label: "AI Parser",
    category: "ai",
    description: "Availability based on real AI API calls.",
    status: "not_used",
    message: "No calls yet",
    checkedAt: null,
  });

  entries.set("tmdb", {
    key: "tmdb",
    label: "TMDB",
    category: "metadata",
    description: "Availability based on real TMDB API calls.",
    status: "not_used",
    message: "No calls yet",
    checkedAt: null,
  });

  entries.set("bgm", {
    key: "bgm",
    label: "Bangumi",
    category: "metadata",
    description: "Availability based on real bgm.tv API calls.",
    status: "not_used",
    message: "No calls yet",
    checkedAt: null,
  });

  entries.set("mikan", {
    key: "mikan",
    label: "Mikan RSS",
    category: "rss",
    description: "Availability based on real Mikan RSS calls.",
    status: "not_used",
    message: "No calls yet",
    checkedAt: null,
  });

  entries.set("dmhy", {
    key: "dmhy",
    label: "DMHY RSS",
    category: "rss",
    description: "Availability based on real DMHY RSS calls.",
    status: "not_used",
    message: "No calls yet",
    checkedAt: null,
  });

  entries.set("notifaction", {
    key: "notifaction",
    label: "Notifications",
    category: "notification",
    description: "Availability based on real notification delivery attempts.",
    status: "not_used",
    message: "No calls yet",
    checkedAt: null,
  });
}

function getConfigured(key: IntegrationKey): boolean {
  switch (key) {
    case "qbit":
      return Boolean(getSetting("qbit_url")?.trim());
    case "ai":
      return Boolean(
        getSetting("ai_api_url")?.trim() &&
          getSetting("ai_api_token")?.trim() &&
          getSetting("ai_model")?.trim()
      );
    case "tmdb":
      return Boolean(getSetting("tmdb_token")?.trim());
    case "notifaction":
      try {
        return loadConfig().notifactions.some((notifaction) => notifaction.enabled);
      } catch {
        return false;
      }
    case "bgm":
    case "mikan":
    case "dmhy":
      return true;
    default:
      return true;
  }
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

function toStatus(entry: IntegrationEntry): IntegrationStatus {
  return {
    key: entry.key,
    label: entry.label,
    category: entry.category,
    description: entry.description,
    configured: getConfigured(entry.key),
    testSupported: false,
    status: entry.status,
    message: entry.message,
    checkedAt: entry.checkedAt,
    running: false,
    schedule: "Passive (on usage)",
    nextCheckAt: null,
  };
}

function recordIntegrationStatus(
  key: IntegrationKey,
  status: IntegrationHealthStatus,
  message: string
): void {
  ensureInitialized();
  const entry = entries.get(key);
  if (!entry) return;

  entry.status = status;
  entry.message = message;
  entry.checkedAt = new Date().toISOString();
}

export function reportIntegrationSuccess(
  key: IntegrationKey,
  message: string = "Last call succeeded"
): void {
  recordIntegrationStatus(key, "ok", message);
}

export function reportIntegrationFailure(
  key: IntegrationKey,
  error: unknown,
  fallbackMessage = "Call failed"
): void {
  const message = toMessage(error, fallbackMessage);
  recordIntegrationStatus(key, "error", message);
}

export function startIntegrationHealthMonitor() {
  ensureInitialized();
  if (started) return;
  started = true;
  logger.info("Starting integration usage monitor (passive mode)...");
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  ensureInitialized();
  return INTEGRATION_ORDER.map((key) => toStatus(entries.get(key)!));
}

export async function runIntegrationCheck(
  key: string
): Promise<RunIntegrationCheckResult> {
  ensureInitialized();
  const entry = entries.get(key as IntegrationKey);
  if (!entry) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: false, reason: "manual_disabled" };
}
