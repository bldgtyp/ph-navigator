# Frontend — PH-Navigator V2

Vite + React 19 + TypeScript. Currently a scaffold — real surfaces
(sign-in, dashboard, project view, catalog, model viewer) land during
feature work (see `context/USER_STORIES.md` and `context/UI_UX.md`).

## Run

```bash
cd frontend
npm install              # first time / when package-lock.json changes
npm run dev              # Vite dev server on http://localhost:5173
npm test                 # Vitest
npm run test:e2e         # Playwright (Vite must be running)
npm run lint             # ESLint
npm run format           # Prettier
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
