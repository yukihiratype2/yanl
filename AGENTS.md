# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Bun + Hono API, SQLite access, monitor jobs, and integrations.
  - Core code lives in `backend/src/` (`routes/`, `services/`, `usecases/`, `middleware/`).
  - Backend tests live in `backend/test/` as `*.test.ts` files.
- `frontend/`: Next.js + Tailwind UI.
  - App routes/components are under `frontend/src/app/`, `frontend/src/components/`, and `frontend/src/lib/`.
- `data/`: runtime artifacts (`config.yaml`, `nas-tools.db`). Treat as local-only.
- `test/`: reserved for top-level/shared test assets.

## Build, Test, and Development Commands
- `bun install`: install workspace dependencies.
- `bun run dev`: run frontend + backend in workspace dev mode.
- `bun run dev:backend` / `bun run dev:frontend`: run one service only.
- `cd backend && bun run start`: run backend once (no watch).
- `cd backend && bun run test`: run backend unit/integration tests.
- `cd backend && bun run test:watch`: watch backend tests.
- `cd frontend && bun run lint`: run ESLint checks.
- `cd frontend && bun run build`: verify production Next.js build.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM) across backend and frontend.
- Follow existing style: 2-space indentation, semicolons, double quotes, focused functions.
- API routes follow `/api/<resource>` (example: `/api/subscriptions`).
- Prefer descriptive file names; React components use `PascalCase` (`ThemeToggle.tsx`), utility/service files use lowercase or kebab-style names.

## Testing Guidelines
- Backend uses `bun test`; place tests in `backend/test/` with `*.test.ts` suffix.
- Add/adjust tests with functional changes (routes, monitor jobs, service logic).
- Prefer mocks/stubs for external APIs (TMDB, Bangumi, qBittorrent, AI); avoid real torrent actions in tests.
- For UI changes, run `frontend` lint and include manual verification notes when no UI test exists.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects; Conventional Commit prefixes are encouraged (`feat:`, `fix:`, `refactor:`).
- Keep commits focused; avoid mixing backend, frontend, and infra refactors without need.
- PRs should include: purpose, key changes, test evidence (commands/output), and screenshots for UI changes.
- Link related issues/tasks and call out config or migration impacts explicitly.

## Security & Configuration Tips
- Never commit secrets or runtime data (`data/config.yaml`, `*.db`, logs).
- Keep API tokens and service credentials out of code and screenshots.
- When testing monitor/torrent flows, target a safe qBittorrent instance.
