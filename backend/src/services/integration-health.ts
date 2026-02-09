import cron from "node-cron";
import { getSetting } from "../db/settings";
import * as aiService from "./ai";
import * as bgmService from "./bgm";
import { logger } from "./logger";
import * as notifactionService from "./notifaction";
import * as qbittorrentService from "./qbittorrent";
import * as tmdbService from "./tmdb";

export type IntegrationKey =
  | "qbit"
  | "ai"
  | "tmdb"
  | "bgm"
  | "notifaction";

export type IntegrationHealthStatus =
  | "unknown"
  | "not_configured"
  | "testing"
  | "ok"
  | "error";

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

type CheckTrigger = "startup" | "scheduled" | "manual";

type RunIntegrationCheckResult =
  | { ok: true; status: IntegrationStatus }
  | { ok: false; reason: "not_found" | "already_running" };

type CheckResult = {
  configured: boolean;
  status: Exclude<IntegrationHealthStatus, "unknown" | "testing">;
  message: string;
  checkedAt: string | null;
};

type IntegrationEntry = {
  key: IntegrationKey;
  label: string;
  category: string;
  description: string;
  schedule: string;
  testSupported: boolean;
  running: boolean;
  configured: boolean;
  status: IntegrationHealthStatus;
  message: string | null;
  checkedAt: string | null;
  task: ReturnType<typeof cron.schedule> | null;
  check: (trigger: CheckTrigger) => Promise<CheckResult>;
};

const INTEGRATION_ORDER: IntegrationKey[] = [
  "qbit",
  "ai",
  "tmdb",
  "bgm",
  "notifaction",
];

const INTEGRATION_SCHEDULES: Record<IntegrationKey, string> = {
  qbit: "0 * * * *",
  ai: "0 */2 * * *",
  tmdb: "0 3 * * *",
  bgm: "5 3 * * *",
  notifaction: "20 * * * *",
};

const entries: Map<IntegrationKey, IntegrationEntry> = new Map();
let started = false;

function truncate(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function createCheckResult(
  configured: boolean,
  status: Exclude<IntegrationHealthStatus, "unknown" | "testing">,
  message: string,
  checkedAt: string | null = new Date().toISOString()
): CheckResult {
  return { configured, status, message, checkedAt };
}

function createEntry(
  key: IntegrationKey,
  label: string,
  category: string,
  description: string,
  check: (trigger: CheckTrigger) => Promise<CheckResult>
): IntegrationEntry {
  return {
    key,
    label,
    category,
    description,
    schedule: INTEGRATION_SCHEDULES[key],
    testSupported: true,
    running: false,
    configured: false,
    status: "unknown",
    message: "Waiting for first health check",
    checkedAt: null,
    task: null,
    check,
  };
}

async function checkQbit(): Promise<CheckResult> {
  const configured = Boolean(getSetting("qbit_url")?.trim());
  if (!configured) {
    return createCheckResult(
      false,
      "not_configured",
      "Not configured",
      null
    );
  }

  const probe = qbittorrentService.testConnection;
  if (typeof probe !== "function") {
    return createCheckResult(true, "error", "qBittorrent health probe unavailable");
  }
  const result = await probe();
  if (!result.ok) {
    return createCheckResult(
      true,
      "error",
      result.error || "Connection failed"
    );
  }

  return createCheckResult(
    true,
    "ok",
    result.version ? `Connected (v${result.version})` : "Connected"
  );
}

async function checkAI(): Promise<CheckResult> {
  const configured = Boolean(
    getSetting("ai_api_url")?.trim() &&
      getSetting("ai_api_token")?.trim() &&
      getSetting("ai_model")?.trim()
  );
  if (!configured) {
    return createCheckResult(
      false,
      "not_configured",
      "Not configured",
      null
    );
  }

  try {
    const response = (await aiService.testAIConfig())?.trim();
    return createCheckResult(
      true,
      "ok",
      response ? `Healthy: ${truncate(response, 100)}` : "Healthy"
    );
  } catch (error: any) {
    return createCheckResult(
      true,
      "error",
      error?.message || "AI health check failed"
    );
  }
}

async function checkTMDB(): Promise<CheckResult> {
  const configured = Boolean(getSetting("tmdb_token")?.trim());
  if (!configured) {
    return createCheckResult(
      false,
      "not_configured",
      "Not configured",
      null
    );
  }

  const probe = tmdbService.testTMDBConnection;
  if (typeof probe !== "function") {
    return createCheckResult(true, "error", "TMDB health probe unavailable");
  }
  const result = await probe();
  if (!result.ok) {
    return createCheckResult(
      true,
      "error",
      result.error || "TMDB health check failed"
    );
  }
  return createCheckResult(true, "ok", "Connected");
}

async function checkBGM(): Promise<CheckResult> {
  const probe = bgmService.testBGMConnection;
  if (typeof probe !== "function") {
    return createCheckResult(true, "error", "BGM health probe unavailable");
  }
  const result = await probe();
  if (!result.ok) {
    return createCheckResult(
      true,
      "error",
      result.error || "BGM health check failed"
    );
  }
  return createCheckResult(true, "ok", "Connected");
}

async function checkNotifaction(trigger: CheckTrigger): Promise<CheckResult> {
  const readinessProbe = notifactionService.getNotifactionReadiness;
  if (typeof readinessProbe !== "function") {
    return createCheckResult(
      false,
      "not_configured",
      "Notification readiness probe unavailable",
      null
    );
  }
  const readiness = readinessProbe();
  if (!readiness.configured) {
    return createCheckResult(
      false,
      "not_configured",
      readiness.message,
      null
    );
  }

  if (trigger !== "manual") {
    return createCheckResult(true, "ok", readiness.message);
  }

  const deliveryProbe = notifactionService.testNotifactionDelivery;
  if (typeof deliveryProbe !== "function") {
    return createCheckResult(true, "error", "Notification delivery probe unavailable");
  }
  const result = await deliveryProbe();
  return createCheckResult(
    true,
    result.ok ? "ok" : "error",
    result.message
  );
}

function ensureInitialized() {
  if (entries.size > 0) return;
  entries.set(
    "qbit",
    createEntry(
      "qbit",
      "qBittorrent",
      "Download client connectivity and API health.",
      checkQbit
    )
  );
  entries.set(
    "ai",
    createEntry(
      "ai",
      "AI Parser",
      "OpenAI-compatible parser endpoint health.",
      checkAI
    )
  );
  entries.set(
    "tmdb",
    createEntry(
      "tmdb",
      "TMDB",
      "TMDB token and API connectivity health.",
      checkTMDB
    )
  );
  entries.set(
    "bgm",
    createEntry(
      "bgm",
      "Bangumi",
      "bgm.tv API availability health.",
      checkBGM
    )
  );
  entries.set(
    "notifaction",
    createEntry(
      "notifaction",
      "Notifications",
      "Configured destination readiness and manual delivery test.",
      checkNotifaction
    )
  );
}

function toStatus(entry: IntegrationEntry): IntegrationStatus {
  return {
    key: entry.key,
    label: entry.label,
    category: entry.category,
    description: entry.description,
    configured: entry.configured,
    testSupported: entry.testSupported,
    status: entry.status,
    message: entry.message,
    checkedAt: entry.checkedAt,
    running: entry.running,
    schedule: entry.schedule,
    nextCheckAt: entry.task?.getNextRun()?.toISOString() ?? null,
  };
}

async function runCheckInternal(
  entry: IntegrationEntry,
  trigger: CheckTrigger
): Promise<IntegrationStatus | null> {
  if (entry.running) return null;

  entry.running = true;
  entry.status = "testing";
  entry.message =
    trigger === "manual" ? "Testing now..." : "Running scheduled check...";

  try {
    const result = await entry.check(trigger);
    entry.configured = result.configured;
    entry.status = result.status;
    entry.message = result.message;
    entry.checkedAt = result.checkedAt;
  } catch (error: any) {
    entry.configured = true;
    entry.status = "error";
    entry.message = error?.message || "Health check failed";
    entry.checkedAt = new Date().toISOString();
    logger.error({ integration: entry.key, err: error }, "Integration check failed");
  } finally {
    entry.running = false;
  }

  return toStatus(entry);
}

export function startIntegrationHealthMonitor() {
  ensureInitialized();
  if (started) return;
  started = true;

  logger.info("Starting integration health monitor...");

  for (const key of INTEGRATION_ORDER) {
    const entry = entries.get(key);
    if (!entry) continue;
    entry.task = cron.schedule(entry.schedule, () => {
      void runCheckInternal(entry, "scheduled");
    });
  }

  for (const key of INTEGRATION_ORDER) {
    const entry = entries.get(key);
    if (!entry) continue;
    void runCheckInternal(entry, "startup");
  }
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
  if (entry.running) {
    return { ok: false, reason: "already_running" };
  }

  const status = await runCheckInternal(entry, "manual");
  if (!status) {
    return { ok: false, reason: "already_running" };
  }
  return { ok: true, status };
}
