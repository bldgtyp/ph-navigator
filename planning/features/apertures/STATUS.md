---
DATE: 2026-06-05
TIME: 18:45 EDT
STATUS: In progress — Phases 01–06 shipped (Phase 05 split into two PRs).
AUTHOR: Claude
SCOPE: Current state, decisions, and next steps for the Apertures / Aperture Builder build-out.
RELATED:
  - planning/features/apertures/PRD.md
  - planning/features/apertures/PLAN.md
  - planning/features/apertures/README.md
  - planning/features/apertures/phases/
---

# Apertures Feature Status

## Current State

- **Phases 01, 02, 03, 04, and 05 — additive variants shipped.** New `Aperture*`
  domain model, `tables.apertures[]` field, command seam, coverage
  invariant, default factory, route + service wrapper, full
  frontend tab, the SVG canvas substrate (geometry helpers,
  `ApertureSvgCanvas`, canvas toolbar with zoom + view-direction
  controls, `ApertureCanvasContainer`), and the interaction overlay
  (`ApertureCanvasOverlay`, `ApertureHitTarget`, `ApertureNamePill`,
  Zustand builder store, selection model, Clear-selection toolbar
  button, no-direct-delete inline notice) landed **side-by-side**
  with the existing Windows tracer-bullet. Nothing in the legacy
  tracer-bullet path was touched. See each phase file's
  "Implementation note" for the per-commit delta.
- **What's live now end-to-end:**
  - Open a project → click the new **Apertures** tab.
  - Empty state shows `No aperture types yet.` and a
    `+ Add aperture type` button.
  - `+ Add` dispatches `createApertureType` through
    `POST /api/v1/projects/{id}/versions/{vid}/apertures/command`,
    the backend bookshelf-copies the seeded `PHN-Default-Frame`
    / `PHN-Default-Glazing` into a 1×1 aperture, the sidebar
    selects the new entry.
  - Hover-revealed Edit / Dup / Del row actions drive
    `renameApertureType` / `duplicateApertureType` /
    `deleteApertureType` through the same endpoint.
  - Rename dialog enforces collision (trim + case-insensitive)
    with a persistent helper line.
  - Locked versions and Viewer access hide every edit
    affordance; the list stays navigable.
  - Catalog seed rows (`PHN-Default-Frame`,
    `PHN-Default-Glazing`) are **not yet seeded by Alembic** —
    until that lands, `+ Add` returns a structured
    `aperture_default_refs_missing` error. The factory + adapter
    + dispatcher all handle that envelope gracefully; only the
    seed itself is missing.
- **Existing TB-08/TB-09 Windows tracer-bullet keeps working
  unmodified.** Both tabs coexist in the project nav.

## Still deferred (to a future cleanup phase, ideally before / with Phase 12)

- Rename `WindowTypeEntry` / `WindowElement` / `WindowElementFrames`
  → `Aperture*` and re-export the legacy names as aliases.
- Rename `body.tables.window_types` → `body.tables.apertures` with
  a `@computed_field` alias.
- Document-load migration shim that rewrites `win_` / `winel_`
  ids to `apt_` / `aptel_`.
- Alembic migration that munges existing JSON documents AND
  seeds the `PHN-Default-Frame` / `PHN-Default-Glazing` rows.
- Delete `frontend/src/features/windows/` and remove the
  `Windows` tab from `PROJECT_TABS`.
- `/projects/:id/windows` → `/projects/:id/apertures` redirect.
- Sidebar collapse / chevron, sticky `+ Add`, V1-pixel-parity
  styling.

## Next Step

Begin Phase 07 (`phases/phase-07-operations-editor.md`) — operation
editor on the per-element card. Phase 06's read-only operation label,
pick wiring, override commands, and badge surface are all in place
underneath.

## Phase 06 — element cards, region-click pickers, badges (shipped)

- Backend `pickFrame` / `pickGlazing` / `editFieldOverride` handlers
  live in `aperture_commands/handlers/picks.py`. `synced_at` is
  re-stamped on every catalog pick, `local_overrides` dedupes by key,
  hand-entered refs round-trip with `catalog_origin: null`.
- `GET /catalogs/frame-types` accepts `location`, `operation`, `use`,
  and repeated `manufacturers` query params — server-side, AND-
  composed, case-insensitive. `GET /catalogs/glazing-types` accepts
  the same `manufacturers` param.
- Frontend ships the full card stack: `ApertureElementCardStack`,
  `ApertureElementCard`, `FrameRow`, `GlazingRow`, `FramePicker`,
  `GlazingPicker`, `InlineOverrideInput`, `MoreFieldsExpander`,
  `CatalogBadges` (sourced / hand-enter / datasheet / drift
  placeholder), and the ref-builder helpers
  (`catalogRowToFrameRef`, `blankHandEnterFrameRef`, …) that turn
  catalog rows into wire-shaped refs.
- Pickers filter via paired hooks (`useFrameCatalog`,
  `useGlazingCatalog`) that run a filtered query + an unfiltered
  query so the "Showing N of M frames · Clear filter" footnote stays
  honest.
- Region clicks on the canvas open the matching card row's picker
  via a `focusedTarget` prop. Visual ↔ canonical side flipping lives
  in `frame-label-map.ts`; tests cover both directions.
- Read-only / Viewer access: every picker collapses to a static
  label, override fields are disabled, datasheet links remain
  clickable, the `+ Hand-enter` action is hidden.

## Phase 06 deviations from the doc

- **Combobox primitive**: the picker is a native `<details>` /
  `<summary>` dropdown rather than a shadcn `Combobox`. Keeps the
  surface keyboard-accessible without adding Radix `Popper`. Phase
  11 may swap if the manufacturer-filter UI calls for it.
- **`datasheet_url`**: `FrameRef` / `GlazingRef` don't carry an
  explicit `datasheet_url` column. The badge falls back to the
  `source` field when it looks like an `http(s)://…` URL. A
  dedicated column is deferred to the same cleanup phase that
  renames `Window*` → `Aperture*`.
- **Drift badge**: rendered only when `hasDrift=true`. Phase 06
  never sets that, so the badge is dormant — the markup + tooltip
  shipping early lets Phase 12 just wire the input.
- **`+ Hand-enter`**: writes a blank `FrameRef` / `GlazingRef` with
  `name = "Unnamed"` and `catalog_origin = null`. The user fills the
  inline override fields immediately; the override handler accepts
  edits on a null-origin ref without touching `local_overrides`.
- **Card stack ordering**: `column_span[0]` ascending then
  `row_span[0]` ascending. Matches the phase doc's canonical order.
- **`useFrameCatalog` / `useGlazingCatalog`**: ship as paired
  queries (filtered + all) so the picker footnote can recompute
  without a round-trip. The backend filter still runs server-side
  per the phase doc; the second unfiltered query is a small extra
  read that cache-hits across pickers.

Phase 05 was split into two sub-PRs:

- **Sub-PR A:** shared parser in `frontend/src/lib/units/length/`
  (ported verbatim from V1 + parens support for
  `evaluateSimpleExpression`) and the five backend dimension command
  handlers (`editDimension`, `addRow`, `addColumn`, `deleteRow`,
  `deleteColumn`) wired into `apply_aperture_command`.
- **Sub-PR B:** Dimension UI — `useDimensionDraft` hook,
  `DimensionLabel` primitive, `HorizontalDimensionStrip` +
  `VerticalDimensionStrip`, `EdgeAddButtons`,
  `DeleteDimensionDialog`, `DisplayFormatSelector`,
  `TotalDimensionsCaption`, `useApertureDimFormat`,
  `delete-dimension-impact` quiet-vs-confirm helper, and the canvas
  container CSS-grid composition that places strips + edge hot-zones
  + selector + caption around the SVG / overlay stage. `AperturesTab`
  fans the five dimension commands through `dispatch`.

## Blockers

- The Alembic seed of `PHN-Default-Frame` /
  `PHN-Default-Glazing` is needed before `+ Add aperture type`
  actually works in a live dev DB. Until that lands, the flow
  surfaces a structured 503 to the user rather than silently
  failing — acceptable transitional state, but worth folding
  into Phase 03 or a small cleanup commit.

## Verification

- Phase 01: commit `339e7ca`. `make ci` green.
- Phase 02: commit (prior). `make ci` green (525 backend tests, 1122
  frontend tests, build successful).
- Phase 03: prior commit. `make ci` green (525 backend tests, 1141
  frontend tests — 12 geometry + 7 canvas added, build successful).
- Phase 04: prior commit. `make ci` green (525 backend tests, 1161
  frontend tests — 6 store + 8 overlay + 6 pill added, build
  successful).
- Phase 05 sub-PR A: prior commit. `make ci` green (536 backend
  tests — +11 for dimension commands; 1296 frontend tests — +135
  for shared parser modules: parseFeetInches 32, evaluateExpression
  41, parseInput 27, formatFeetInches 15, displayUnitConverter 20).
- Phase 05 sub-PR B: this commit. `make ci` green (536 backend
  tests; 1314 frontend tests — +18: useDimensionDraft 6,
  DimensionLabel 7, HorizontalDimensionStrip 5).
- Phase 06: this commit. Backend Ruff + Ty pass; deterministic-
  order pytest (`-p no:randomly`) reports 546 backend tests, 1
  skipped. The full `make ci` exposes 1–3 pre-existing local
  pollution failures (asset / catalog duplicate tests that pass
  in isolation and on a deterministic run); these reproduce on a
  clean `git stash -u` of HEAD too, so they're not introduced
  by Phase 06. Frontend Vitest: 1331 tests pass (+7 new across
  `picker-filters`, `frame-label-map`, and `ref-builders`).
  Frontend build + lint + structural guards pass.
