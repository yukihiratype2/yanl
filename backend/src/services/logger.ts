import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { loadConfig } from "../config";

type LogContext = Record<string, unknown>;

const LOG_SERVICE_NAME = "nas-tools-backend";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const REDACT_PATHS: string[] = [
  "authorization",
  "cookie",
  "token",
  "apiToken",
  "api_token",
  "password",
  "qbit_password",
  "ai_api_token",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.query.apikey",
  "req.query.token",
  'headers["x-api-key"]',
  'req.headers["x-api-key"]',
  "*.authorization",
  "*.cookie",
  "*.token",
  "*.apiToken",
  "*.api_token",
  "*.password",
  "*.qbit_password",
  "*.ai_api_token",
  "*.*.token",
  "*.*.apiToken",
  "*.*.api_token",
  "*.*.password",
  "*.*.qbit_password",
  "*.*.ai_api_token",
];

const logContextStorage = new AsyncLocalStorage<LogContext>();
let currentDestination: any | null = null;

function getLogContext(): LogContext {
  return logContextStorage.getStore() ?? {};
}

function resolveLogDir(dir: string): string {
  if (!dir) return join(process.cwd(), "log");
  return isAbsolute(dir) ? dir : join(process.cwd(), dir);
}

function buildDestination(): any {
  const config = loadConfig();
  const dir = resolveLogDir(process.env.LOG_DIR || config.log?.dir || join(process.cwd(), "log"));

  mkdirSync(dir, { recursive: true });
  const file = join(dir, "backend.log");

  return pino.destination({
    dest: file,
    sync: false,
  });
}

function buildLogger(): pino.Logger {
  const config = loadConfig();
  const level = process.env.LOG_LEVEL || config.log?.level || "warn";

  let destination: any;
  try {
    destination = buildDestination();
  } catch (err) {
    // If the file destination can't be opened, fall back to stdout to avoid losing logs.
    console.error("Failed to initialize log file destination:", err);
    destination = pino.destination(1);
  }

  currentDestination = destination;

  return pino(
    {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: REDACT_PATHS,
        censor: "[REDACTED]",
      },
      mixin() {
        return {
          ...getLogContext(),
          service: LOG_SERVICE_NAME,
        };
      },
    },
    destination
  );
}

export function withLogContext<T>(context: LogContext, fn: () => T): T {
  const nextContext = {
    ...getLogContext(),
    ...context,
  };
  return logContextStorage.run(nextContext, fn);
}

export function createRequestId(incoming?: string | null): string {
  const candidate = typeof incoming === "string" ? incoming.trim() : "";
  if (candidate && REQUEST_ID_PATTERN.test(candidate)) {
    return candidate;
  }
  return `req-${randomUUID()}`;
}

export function maskToken(token: string | null | undefined): string {
  const value = (token || "").trim();
  if (!value) return "(empty)";
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

export let logger = buildLogger();

export function reconfigureLogger(): pino.Logger {
  try {
    currentDestination?.flush?.();
    currentDestination?.end?.();
    currentDestination?.destroy?.();
  } catch {
    // Best-effort: old destination might already be closed.
  }

  logger = buildLogger();
  return logger;
}
