# Frontend — PH-Navigator V2

Vite + React 19 + TypeScript. Currently a scaffold — real surfaces
(sign-in, dashboard, project view, catalog, model viewer) land during
feature work (see `context/USER_STORIES.md`, the relevant
`context/user-stories/*.md` file, and `context/UI_UX.md`).

## Run

```bash
cd frontend
pnpm install             # first time / when pnpm-lock.yaml changes
pnpm run dev             # Vite dev server on http://localhost:5173
pnpm test                # Vitest
pnpm run test:e2e        # Playwright (Vite must be running)
pnpm run lint            # ESLint
pnpm run format          # Prettier
```

Or from the repo root: `make frontend`, `make test-frontend`, `make e2e`.

## Layout

- `src/main.tsx` — React entrypoint
- `src/App.tsx` — placeholder root component
- `tests/setup.ts` — Vitest global setup
- `tests/e2e/` — Playwright specs
- `playwright.config.ts` — Playwright runner config
- `vite.config.ts` — Vite + Vitest config (jsdom)
- `eslint.config.js`, `.prettierrc.json` — code quality

For interactive verification during development, prefer the Playwright
MCP server (`.mcp.json` at repo root) over the CLI runner. CLI runner
is for regression-level coverage.
