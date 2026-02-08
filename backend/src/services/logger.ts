import pino from "pino";
import { mkdirSync } from "fs";
import { isAbsolute, join } from "path";
import { loadConfig } from "../config";

let currentDestination: any | null = null;

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
    },
    destination
  );
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
