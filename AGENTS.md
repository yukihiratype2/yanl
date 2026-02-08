# Project Overview
NAS Tools is a self-hosted media manager that searches anime/TV/movies (TMDB/Bangumi), subscribes to shows, pulls torrents (Mikan/DMHY), dispatches them to qBittorrent, and organizes completed downloads into structured media folders via a Bun/TypeScript backend and a Next.js/Tailwind frontend.

## Repository Structure
- `backend/` – Bun + Hono API server, SQLite DB, background monitor jobs, external service integrations.
- `frontend/` – Next.js 16 app with Tailwind 4, sidebar layout, API client utilities.
- `data/` – Runtime config and SQLite DB outputs (`config.yaml`, `nas-tools.db`).
- `test/` – Placeholder for automated tests.  
- `node_modules/`, `bun.lock`, `bun.lockb` – Workspace dependencies and locks.
- `README.md` – High-level setup and feature overview.

## Build & Development Commands
```bash
# Install (workspace-aware)
bun install

# Run full dev stack (frontend + backend via workspaces)
bun run dev

# Backend only
cd backend
bun run dev           # watch mode
bun run start         # single run

# Frontend only
cd frontend
bun run dev           # Next dev server
bun run build         # production build
bun run start         # serve built app
bun run lint          # ESLint

# Tests
cd backend && bun run test:ai   # AI config smoke test (hits configured AI endpoint)
# TODO: add broader unit/integration tests

# Type-check
# TODO: add explicit type-check script (tsc) for backend/frontend
```

## Code Style & Conventions
- Language: TypeScript (ESM) for both backend and frontend.
- Formatting: Rely on project defaults; no Prettier config present. Keep lines ≤ ~100 chars.
- Linting: Frontend uses `eslint` with `eslint-config-next`; backend has no dedicated linter.
- Naming: HTTP routes follow `/api/<resource>`; services encapsulate external systems (`services/*.ts`).
- Commits: No template provided. Use clear, imperative subjects (e.g., `Add TMDB season fetch retry`).

## Architecture Notes
```mermaid
flowchart TD
  UI[Next.js/Tailwind frontend] -->|REST /api| API[Hono (Bun) server]
  API --> DB[(SQLite /data/nas-tools.db)]
  API --> Qbit[qBittorrent WebUI]
  API --> TMDB[TMDB API (TV/Movie metadata)]
  API --> BGM[BGM.tv API (anime metadata)]
  API --> RSS[RSS feeds: Mikan, DMHY]
  API --> AI[Configurable AI chat API]
  API --> FS[Media directories on host]
```
Backend boots SQLite, exposes authenticated `/api/*` routes, and runs cron-driven monitor jobs (episode checks, RSS search/download, download monitoring). Media folders are created per subscription and season. Frontend calls the REST API (token stored in `localStorage`) and renders sidebar-driven pages.

## Testing Strategy
- Backend: `bun run test:ai` validates configured AI endpoint; no other automated tests yet.
- Frontend: `bun run lint` for static checks; no unit/e2e suites yet.
- CI: > TODO: document CI runners and required checks (lint/tests/type-check).
- Recommended: add backend unit tests around services/DB and integration tests for routes; add frontend component tests and API client mocks.

## Security & Compliance
- Auth: Bearer token from `data/config.yaml` (`core.api_token`), enforced on `/api/*` via middleware.
- Secrets: Stored in `data/config.yaml`; printed API token on backend start—avoid sharing logs. Never commit populated `data/config.yaml` or `nas-tools.db`.
- External services: qBittorrent credentials and TMDB/Bangumi/AI tokens pulled from config; treat as secrets.
- File safety: `fileManager.deleteMediaFolder` guards against deleting outside configured media dirs.
- Dependency scanning/licenses: > TODO: specify tooling (e.g., `bun audit`, `npm audit`, license policy).  
- Network calls: RSS/AI/TMDB/Bangumi are outbound; ensure egress rules allow them in deployments.

## Agent Guardrails
- Do not edit or commit `data/config.yaml`, `data/nas-tools.db`, or `backend/log/` contents.
- Avoid modifying `bun.lock`/`bun.lockb` unless intentionally changing dependencies.
- Keep API tokens/credentials out of code, logs, and version control.
- When running monitor jobs or torrent actions, ensure qBittorrent points to a test instance to avoid unintended downloads.
- Large deletions (media folders) are irreversible—double-check paths before invoking file operations.

## Extensibility Hooks
- Configuration: `data/config.yaml` keys for core token, qBittorrent, TMDB, media dirs, AI endpoint/token/model.
- Frontend API base: `NEXT_PUBLIC_API_URL` to target different backend hosts.
- Background jobs: Add/adjust cron schedules or register new jobs in `backend/src/services/monitor.ts`.
- RSS/Torrent parsing: Extend sources in `services/rss.ts`; enhance AI parsing via `services/ai.ts`.
- Profiles: Customize quality/format rules via `/api/profiles` CRUD and default profile selection.
- Media dirs: Change per-type directories via settings or config to integrate with other organizers.

## Further Reading
- `README.md`
- `backend/src/index.ts`
- `backend/src/services/monitor.ts`
- `backend/src/services/rss.ts`
- `backend/src/services/qbittorrent.ts`
- `frontend/src/lib/api.ts`
