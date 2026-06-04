---
DATE: 2026-06-03
TIME: 22:00 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7)
SCOPE: End-to-end round-trip against a real seed file, Playwright
       MCP smoke, and docs fold-back.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - phase-01-backend-external-id.md
  - phase-02-backend-import-pipeline.md
  - phase-03-frontend-overflow-menu.md
  - ../../../../research/Material Data-Grid view.csv
---

# Phase 4 — Verification + Docs

## Objective

Prove the end-to-end pipeline works against a realistic dataset,
capture an MCP smoke trace, and fold accepted decisions back into
`context/` so future agents read a consistent story.

## Work

### 1. Build a seed JSON from the reference CSV

`research/Material Data-Grid view.csv` is the canonical real-world
dataset (~hundreds of WUFI / manufacturer rows). Build a one-shot
script (kept in `research/` or `working/`, **not** shipped in the
app) that:

- Reads the CSV.
- Maps CSV columns to the canonical field keys:
  - `name` → `name`
  - `category` → `category` (lower-case + map to option id;
    e.g. `"Insulations"` → `"insulation"`, `"Air: Downward
    Heatflow"` → `"air_downward_heat_flow"`)
  - `density_kg_m3`, `specific_heat_capacity_J_kg_K` →
    `density_kg_m3`, `specific_heat_j_kgk`
  - `conductivity_w_mk` → `conductivity_w_mk`
  - `emissivity` → `emissivity`
  - `ARGB_COLOR` (`"255,255,255,0"`) → `color` (`#ffffff`, alpha
    dropped)
  - `source` → `source`
  - `comments` → `comments`
  - Drop the rest (`conductivity_btu_hr_ft_F`,
    `resistivity_hr_ft2_F_Btu_in`, `display_name`,
    `DATASHEET`).
- Emits no `external_id` (let the importer assign them on insert).
- Writes `working/materials-seed.json` with the v1 envelope.

This script is **not** the production import path — it's the
input-generator for verification. The production path is the
backend `/import/preview` + `/import/commit` flow.

### 2. End-to-end round-trip

On a fresh local DB:

1. `make dev` → backend + frontend running.
2. From the Materials Catalog page, **Import JSON…** →
   `working/materials-seed.json` → confirm.
3. Inspect counts: expect `new = N` (where N = CSV row count),
   `matched = 0`, `errored = 0`. Some `warnings` are acceptable
   (CSV categories the option-id map didn't cover should surface
   as `unknown_category` if the script left them through).
4. **Export JSON** → save as `working/materials-after-import.json`.
5. Re-import `working/materials-after-import.json`. Expect
   `new = 0`, `matched = N`. Confirm — DB unchanged.
6. Open `working/materials-after-import.json` in an editor.
   Verify: pretty-printed, key order stable, every row has an
   `external_id`, units are SI.

### 3. Playwright MCP smoke

Follow the smoke plan in Phase 3. Capture screenshots into
`planning/features/materials-catalog-import-export/assets/`:

- `assets/01-overflow-menu-open.png`
- `assets/02-import-dialog-report.png`
- `assets/03-imported-rows-in-grid.png`

### 4. `make ci`

From repo root: `make format && make ci`. Must be green. Mirror
the pattern from the prior closeout (materials-catalog-datatable
STATUS: 1010 frontend / 440+1 skipped backend).

### 5. Docs fold-back

- `context/PRD.md`: add a one-paragraph note under the catalogs
  section that catalog data is portable via JSON import/export and
  that `external_id` is the durable identity. Link this feature
  folder.
- `context/GLOSSARY.md`: add `external_id` (catalog row).
- `context/technical-requirements/data-table.md`: if any decision
  here flipped a previously-deferred item (e.g. catalog-scoped
  view-state — it didn't, but check), update accordingly.
- `planning/features/materials-catalog-datatable/STATUS.md`: cross-link
  this feature as a successor (one-line entry under "Follow-ups").

### 6. STATUS.md closeout

Mark this feature's `STATUS.md`:

- Status → `Merged to main` (after PR merge) or
  `Implemented on branch` while review pends.
- All Verification boxes checked.
- "Next step" → None (or any deferred follow-up explicitly named).

## Verification

- `make ci` green from repo root.
- Round-trip on the seed file produces 0 inserts on re-import.
- Three MCP screenshots committed under `assets/`.
- Context-doc fold-back diff exists in the PR.
- PR opened and ready for review.

## Out of scope

- A productionized CSV→JSON converter (the seed script is a
  one-shot, lives in `working/` or `research/`).
- Round-trip across schema versions — there's only v1 today.
  When v2 lands, that round-trip test gets added with the v2
  migration.
- Frame / Glazing catalog parity.
