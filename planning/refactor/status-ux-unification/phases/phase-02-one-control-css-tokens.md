---
DATE: 2026-08-03
STATUS: Complete
AUTHOR: Codex with Ed May
SCOPE: Consolidate editable and read-only status controls, DataTable status
  columns, and status color tokens without changing stored values.
RELATED:
  - ../PLAN.md
  - ../PRD.md
  - ../decisions.md
---

# Phase 02 — One control and CSS tokens

## Outcome

- Aperture Glazings/Frames editing now uses the shared `StatusSelect` rather
  than `AutocompleteSelect` plus a bespoke dot.
- Report viewers and built-in DataTable status cells render the same shared
  `StatusPill`; bespoke DataTable complete/needed icons and status CSS are
  removed.
- Equipment, Heat Pump, and Thermal Bridge tables use one
  `equipment/lib/statusColumn.ts` builder.
- `--report-status-missing` is retired. Non-status amber consumers use
  `--attention-amber`; `--report-status-needed` aliases that neutral color
  token inside the single status-color block.
- `context/DESIGN_SYSTEM.md` and `frontend/src/styles/README.md` identify the
  consolidated controls and token ownership.

## Verification evidence

- Focused Vitest passed for Aperture reports, DataTable grid rendering,
  Ventilators, and Heat Pumps (72 tests before the explicit status-select
  regression was added).
- Production frontend build passed.
- Browser screenshots/inspection covered Documentation, Materials, Glazings,
  Frames, and an Equipment DataTable. The seeded report datasets were empty;
  the Equipment fixture was given one local draft row and visibly rendered the
  shared Needed pill/dropdown. Component tests cover populated report rows and
  the Aperture editor control.
- Simplify review findings were reconciled: the column builder consumes the
  shared DataTable contract, status typing is canonical, and stale/unused
  control markup and comments were removed. Efficiency review was clean.
- Docs pass updated the established design-system and style-token inventories.
- Full CI passed: backend 1,830 passed / 7 skipped; frontend 2,391 passed;
  production build and static gates green.

## Invariants

- Status values and DataTable option ids are unchanged.
- Project-document schema version and fingerprint are unchanged.
- Non-status warning semantics do not use a status-named token.
