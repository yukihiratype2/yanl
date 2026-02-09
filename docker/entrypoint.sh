#!/usr/bin/env bash
set -euo pipefail

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
export BACKEND_INTERNAL_URL="${BACKEND_INTERNAL_URL:-http://127.0.0.1:${BACKEND_PORT}}"

echo "Starting backend on port ${BACKEND_PORT}"
PORT="${BACKEND_PORT}" bun --cwd /app/backend run start &
BACKEND_PID=$!

echo "Starting frontend on port ${FRONTEND_PORT}"
bun --cwd /app/frontend run start -- --hostname 0.0.0.0 --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!

shutdown() {
  kill -TERM "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
  wait "${BACKEND_PID}" 2>/dev/null || true
  wait "${FRONTEND_PID}" 2>/dev/null || true
}

trap shutdown SIGINT SIGTERM

set +e
wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
EXIT_CODE=$?
set -e

shutdown
exit "${EXIT_CODE}"
