---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Build the table inventory and reusable e2e harness skeleton.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - frontend/tests/e2e/_helpers.ts
  - frontend/tests/e2e/table-regression/tableMatrix.ts
  - frontend/tests/e2e/table-regression/tableHelpers.ts
  - frontend/tests/e2e/table-regression/table-harness.spec.ts
---

# Phase 01 - Inventory And Harness Design

## Goal

Create the deterministic test matrix and helper layer needed before any
behavior assertions are added.

## Planned Tasks

1. Confirm exact route paths for all 14 target tables.
2. Confirm table keys used by table-view persistence.
3. Confirm each table's stable core headers.
4. Confirm representative fields for text, number, single-select, and
   linked-record behavior.
5. Confirm deterministic add-row or seed-row requirements.
6. Create `frontend/tests/e2e/table-regression/tableMatrix.ts`.
7. Create `frontend/tests/e2e/table-regression/tableHelpers.ts`.
8. Update Playwright helper auth defaults to `codex@example.com` if still
   needed.

## Deliverables

- A typed matrix that names every target table exactly once.
- Helpers for opening tables, selecting cells by `data-field-key`, editing
  cells, reloading, and reading table payloads.
- No behavior assertions beyond harness sanity checks.

## Verification

```bash
cd frontend && pnpm exec playwright test --list tests/e2e/table-regression
```

## Outcome

Complete. Deliverables shipped under
`frontend/tests/e2e/table-regression/`:

- `tableMatrix.ts` — typed `TableRegressionCase[]` naming all 14 target
  tables exactly once, with route builders, backend/view-state table
  keys, region names, identifier headers, default-visible/hidden core
  headers, representative `field_key`s per field type, built-in
  linked-record targets (incl. incoming/inverse columns + `maxLinks`),
  and add-row specs (inline vs. dialog, required dialog fields, and the
  parent table that must be seeded first for the disabled heat-pump unit
  add buttons). Every fact is cited to its source `file:line`.
- `tableHelpers.ts` — table-agnostic harness: `signInForTables`,
  `openTable` (deep-link `goto` + render wait), `reloadTable`,
  `gridCell` / `firstGridCellForField` / `firstRowId` / `rowIds`
  (stable `data-row-id` + `data-field-key` contract), `commitCellEdit`
  (text/number inline path), and `readDraftTable` (generic
  `draft/tables/{key}` read-back via `page.request`).
- `table-harness.spec.ts` — no-browser sanity checks asserting matrix
  integrity (14 keys, unique ids, identifier-in-headers, hidden/visible
  disjoint, linked-record targets resolve, add-row specs complete) and
  that the helper API is exported. Enumerates one `--list` entry per
  table.

The sanity spec already earned its keep: it caught a missing `addRow`
on the Ventilators entry before any browser run.

### Confirmed facts (authoritative)

- **Routes.** Spaces: `/projects/:id/spaces/space-types` and
  `/spaces/rooms`. Equipment: `/projects/:id/equipment?tab=<key>`
  (`?tab=` seeds the active sub-tab). Heat-pump leaves:
  `/projects/:id/equipment/heat-pumps/<leaf>` (the page derives the
  active tab + leaf from the URL splat, so direct `goto` works). Thermal
  Bridges: `/projects/:id/thermal-bridges`.
- **Table keys.** Backend generic-table key == frontend view-state
  `tableKey` for all 14 tables. The four heat-pump leaves use distinct
  keys (`heat_pumps_{outdoor,indoor}_{equip,units}`) — no shared
  view state. Source: `backend/features/project_document/tables/registry.py`.
- **Region names.** All seven equipment tables and all four heat-pump
  leaves share `aria-label="Equipment"`; Rooms is `"Rooms"`, Space Types
  is `"Space-Types"`, Thermal Bridges is `"Thermal Bridges"`. The
  table-specific add-row button disambiguates which table mounted.
- **Add-row.** Inline blank-row insert for the generic equipment tables,
  Space Types, and Thermal Bridges. Modal dialog for Rooms and all four
  heat-pump leaves; the heat-pump unit leaves disable the add button
  until a parent equipment row exists.

### Open-decision resolution — e2e auth default

Task 8 ("update Playwright helper auth defaults to `codex@example.com`")
is resolved **without** changing the shared `signIn` default. Flipping
the global default would ripple into every existing e2e spec and into
CI, which seeds `ed@example.com`. Instead the table suite owns
`signInForTables(page)` in `tableHelpers.ts`, which defaults to
`codex@example.com` / `password` and honors `E2E_EMAIL` / `E2E_PASSWORD`
overrides. This matches the PLAN's Phase 03/04 run commands (which pass
those env vars explicitly) and keeps the change surgical.

### Verification result

`pnpm exec playwright test --list tests/e2e/table-regression` enumerates
17 entries (2 matrix-level + 14 per-table + 1 helper-API). The
no-browser sanity spec passes 17/17. Prettier + ESLint clean on the new
files.

