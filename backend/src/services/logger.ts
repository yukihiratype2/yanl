import pino from "pino";
import { mkdirSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "log");
mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = join(LOG_DIR, "backend.log");

const destination = pino.destination({
  dest: LOG_FILE,
  sync: false,
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  destination
);

