---
DATE: 2026-06-13
TIME: -
STATUS: Active reference for Model Viewer browser verification
AUTHOR: Codex (for Ed)
SCOPE: Agent browser-access notes for the Model Viewer feature,
  especially in-app Browser / Playwright limitations found during
  Phase 06.
RELATED:
  - context/ENVIRONMENT.md
  - AGENTS.md
  - CLAUDE.md
  - planning/features/model-viewer/README.md
  - planning/features/model-viewer/phases/phase-06-measure-site-sun-polish.md
---

# Model Viewer Agent Browser Notes

Use this before doing interactive Model Viewer browser work. These
notes are intentionally feature-scoped; the general PHN local UI rules
still live in `context/ENVIRONMENT.md`, and reusable cross-feature
browser lessons are summarized in `planning/features/.instructions.md`.

## 1. Canonical Local Path

Use the stable local pair:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Login: `codex@example.com` / `password`

Do not use Vite fallback ports like `5174` unless backend CORS has
also been changed. Do not sign in as `ed@example.com` unless Ed asks;
the auth model has a single-active-session rule and can invalidate
Ed's browser session.

Before opening the browser:

```bash
curl -i http://localhost:8000/api/v1/auth/session
```

Expected when signed out: `401` with `not_authenticated`. That is a
good backend-health signal, not a failure.

Typical setup/repair:

```bash
make backend
make frontend
make seed-agent-user
make object-store-init
```

Run backend and frontend in separate long-lived terminals. If `5173`
is already responding, inspect it instead of starting a second Vite
server.

## 2. Browser Runtime Limitations Seen In Phase 06

The in-app Browser is useful for visual inspection, DOM snapshots, and
screenshots, but it is not a full replacement for Playwright tests or a
Node Playwright script.

Observed limitations:

| Symptom | Cause / constraint | Working approach |
|---|---|---|
| `fill()` / text-entry APIs fail with a virtual clipboard error | In-app Browser text entry routes through its virtual clipboard setup | Use low-level DOM keypress events one character at a time, or prefer Playwright/Node REPL for forms |
| `type()` also fails | It uses the same clipboard-backed path | Same as above: low-level keypress or Playwright |
| Browser evaluate has no `fetch` | The evaluate sandbox is restricted | Do API checks from the shell with `curl`, or use Playwright's normal page/API contexts |
| Browser evaluate has no `XMLHttpRequest` | Same restricted evaluate sandbox | Do not try XHR login/bootstrap from browser evaluate |
| JavaScript cannot install the auth session | The PHN session cookie is `HttpOnly`, correctly inaccessible to page JS | Sign in through the real UI, or use Playwright helpers that preserve cookies through the browser context |
| `document.cookie = ...` appears to work but auth still fails | `HttpOnly` session cookies cannot be created from page JS | Do not use JS cookie injection for PHN auth |
| Page reaches `/model?...` but `window.__phnModelViewer` never appears in the in-app Browser | The debug hook is dev/test-only and the in-app Browser evaluate path may not expose page globals reliably | Verify visible DOM/canvas state with snapshots/screenshots; use Playwright e2e or Node Playwright `page.evaluate` for debug-hook assertions |
| Scene hook/debug state is inaccessible, but the scene visibly renders | Browser tool limitation, not necessarily app failure | Treat DOM/screenshot evidence as the browser-walkthrough signal; use e2e specs for deterministic debug-hook checks |
| Browser shows `SESSION CHECK FAILED` or `Failed to fetch` | Usually backend down, wrong frontend origin, or CORS mismatch | Re-check `localhost:8000`, use `5173`, and do not move to `5174` |

## 3. Reliable Workflows

### Visual walkthrough

Use the in-app Browser for:

- opening the local page;
- signing in if low-level keypress works;
- DOM snapshots;
- verifying visible labels, active controls, hints, and dialogs;
- screenshots for planning assets.

For Model Viewer Phase 06, the reliable visual evidence was:

- signed in as `codex@example.com`;
- deep-linked to a project Model URL with `file=...&lens=site-sun`;
- DOM showed the active Model tab, active Site & Sun lens, file chip,
  scene aria label, and location hint;
- screenshot saved under
  `planning/features/model-viewer/assets/phase-06-site-sun.png`;
- Measure button toggled active and showed the Measure hint;
- screenshot saved under
  `planning/features/model-viewer/assets/phase-06-measure.png`.

### Deterministic assertions

Use Playwright e2e or Node Playwright for:

- login automation;
- `window.__phnModelViewer` access;
- measuring known vertices through `measureBetweenVertices`;
- asserting shade counts, visible object IDs, and debug hook state.

Prefer the checked-in e2e specs when the behavior should be preserved:

```bash
cd frontend && pnpm exec playwright test \
  tests/e2e/model-viewer-files.spec.ts \
  tests/e2e/model-viewer-lenses.spec.ts \
  tests/e2e/model-viewer-themes.spec.ts \
  tests/e2e/model-viewer-measure.spec.ts \
  tests/e2e/model-viewer-site-sun.spec.ts \
  --project=chromium
```

If the Playwright MCP browser profile is locked, use the Node REPL
Playwright fallback with `frontend/node_modules`; keep the same
`5173`/`8000` URLs and the same `codex@example.com` login.

## 4. Model Viewer Debug Hook Rules

The debug hook is an implementation/testing bridge, not user UI:

- It is exposed as `window.__phnModelViewer`.
- It is mounted only in Vite dev/test mode.
- It is intentionally not a production contract.
- It is reliable in Playwright e2e and Node Playwright `page.evaluate`.
- It may be inaccessible from the in-app Browser's restricted evaluate
  sandbox.

Do not spend time trying to force the in-app Browser to read the debug
hook. If visual DOM/canvas state is the goal, use screenshots and
snapshots. If internal scene state is the goal, switch to Playwright.

## 5. Fast Triage Checklist

1. `curl -i http://localhost:8000/api/v1/auth/session` returns `401
   not_authenticated`.
2. Frontend is exactly `http://localhost:5173`.
3. Backend is exactly `http://localhost:8000`.
4. `make seed-agent-user` has been run.
5. Login is `codex@example.com` / `password`.
6. If Browser text entry fails, stop trying `fill()` / `type()` and
   use low-level keypress or Playwright.
7. If Browser evaluate lacks `fetch` / XHR, stop trying API bootstrap
   in evaluate and use shell/Playwright instead.
8. If auth cookie injection seems tempting, do not do it; the session
   cookie is `HttpOnly`.
9. If the debug hook is missing in Browser, verify visible state there
   and move hook assertions to Playwright.
