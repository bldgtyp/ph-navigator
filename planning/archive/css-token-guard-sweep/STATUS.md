---
DATE: 2026-06-14
TIME: 15:50 EDT
STATUS: Complete
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: current state + next step
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Token sweep + guard extension + scale pass

**State:** Complete. Implemented in the main worktree 2026-06-14 and verified
with the mandatory closeout gate.

**Completed scope:**

- Feature/shared CSS color-function literals are behind tokens.
- `check:hex` covers `.css`, `.ts`, `.tsx`, hex, and function-form color
  literals.
- Sanctioned `.ts` data-color modules and fixture skips are explicit in the
  guard.
- PRD-listed literal `border-radius` values are folded into tokens.
- Spacing/type scale deletion was audited and not performed because every
  spacing/type token remains in active use.

**Deferred:** none for this feature packet.

**Verification:**

- `cd frontend && pnpm run check:hex` — green.
- `cd frontend && pnpm run check:css-vars` — green.
- `make format` — green; no edited files changed.
- `make ci` — green:
  - backend: Ruff format/lint, ty, Alembic, pytest (`840 passed, 2 skipped`).
  - frontend: frozen install, Prettier check, ESLint, structural guards
    including extended `check:hex`, Vitest (`1621 passed`), production build.
- Browser smoke (`http://localhost:5173`, `codex@example.com`): Rooms
  DataTable rendered; Add Field modal scrim resolved to the expected 45% black;
  Model tab file-chip shadow resolved from `--shadow-model-chip`.

**Residual noise:** `make ci` still reports existing frontend ESLint
fast-refresh warnings and existing React `act(...)` test warnings, but no
failures.
