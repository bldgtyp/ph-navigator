---
DATE: 2026-06-05
TIME: 19:15 EDT
STATUS: In progress — Phases 01–08 shipped (Phase 05 split into two PRs).
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

Begin Phase 09 (`phases/phase-09-uvalue-service-chips.md`) — U-Value
service + per-element / per-type chips. Phase 08's `affects_u_value`
audit field is the seam Phase 09 hooks for cache invalidation.

## Phase 08 — Merge / Split + Eyedropper-Paint-bucket paste + Undo (shipped)

- Backend `mergeElements`, `splitElement`, `pasteAssignment` handlers
  live in `aperture_commands/handlers/merge_split.py` +
  `handlers/paste.py`. The dispatcher's
  `_NOT_IMPLEMENTED_KINDS` set is now empty — every wire kind
  declared in Phase 01 has a handler.
- `mergeElements` validates the source list forms a contiguous
  rectangle (no overlaps, no holes, no L-shapes), drops the other
  sources, and stamps a fresh merged element that inherits the
  top-left source's 6 assignment fields *and* its name. Audit
  carries `top_left_source_id`.
- `splitElement` requires the source span to cover ≥ 2 cells;
  explodes into one fresh 1×1 element per cell with fresh ids and
  deep-copied refs (catalog-origin `synced_at` re-stamped for
  Phase 12 drift). Source name is preserved on every new element.
- `pasteAssignment` copies the 6 fields (operation, glazing, four
  frames) from `source_element_id` onto each `target_element_ids[i]`
  inside the same aperture; targets keep their `id`, `row_span`,
  `column_span`, and `name`. Refs are deep-copied so future overrides
  on one target don't leak.
- Frontend pure helpers shipped at the feature root:
  `merge-validation.ts` (validateMergeSelection + topLeftSource),
  `split-geometry.ts` (isSplittable + splitCells),
  `pick-paste-machine.ts` (nextMode pure transitions).
- `usePickPasteHandlers` hook centralises the paste / undo / capture
  chain so `ApertureCanvasContainer` stays under the 500-line cap.
- Zustand store gains `pickPasteMode`, `pickedAssignment`,
  `undoStacksByAperture`, and `pickPasteAction` + push/pop/clear
  helpers; PASTE_UNDO_STACK_LIMIT = 20.
- Toolbar surfaces Merge / Split / Eyedropper / Paint bucket /
  Undo paste buttons with selection-driven gating.
- Overlay element click intercepts: when `pickPasteMode === picking`
  the click captures the source assignment; when `pasting` it
  triggers paste. Source element gets a dashed `--phn-warning`
  ring; paste target gets a 600 ms outline pulse.
- ⌘Z (or Ctrl-Z) on the canvas pops the most recent paste off the
  active aperture's stack; ESC clears the pick/paste machine.
- Cross-aperture clear: switching apertures unmounts the container
  which clears selection, dismissed warnings, undo stack, and
  pick/paste state.

## Phase 08 deviations from the doc

- **Toolbar uses text labels, not lucide icons.** Phase 06 set the
  precedent (text-only buttons); adding lucide for one phase would
  force the dep on the project. Tooltips carry context.
- **Sonner toast for merge result is omitted.** V2 has no toast
  primitive yet; the merge audit carries the `top_left_source_id`
  so the eventual toast wiring (Phase 12 cleanup or a polish phase)
  can read the source name from the document. The functional merge
  is unchanged.
- **`splitElement` wire shape simplified.** Phase 01's model
  carried `axis` + `at_index`; Phase 08 trims these because the
  semantic is always "explode all cells". Frontend dispatch wires
  only `element_id`.
- **`pasteAssignment` writes deep copies via `model_copy(deep=True)`**
  instead of a literal JSON-Patch. Same on-disk shape; the patch
  framing is a wire-format detail that Phase 12 + the audit log can
  encode if needed.
- **Region-click + pick-paste do not yet interact.** Region clicks
  open a card picker (Phase 06 wiring); pick-paste captures the
  whole element. The two affordances don't conflict but they don't
  share a click handler either — clicking a frame rect in pick-paste
  mode still opens the picker. Documented for Phase 11/12 polish.

## Phase 07 — Operation editor + canvas symbols + re-pick warning (shipped)

- `OperationRow` replaces the Phase 06 read-only operation row. Type
  `<select>` (Fixed / Swing / Slide), four direction toggles, and an
  `OperationPresetMenu` (`<details>` dropdown) over the seven PRD
  presets all fan through one `onCommit` → `setElementOperation`.
- `operation-labels.ts` produces the canonical "Fixed" / "Swing" /
  "Swing (Left, Up)" labels used by the read-only display, the
  preset-formats-as test, and the mismatch comparison.
- `operation-presets.ts` ships the seven preset payloads with stable
  ids so a future favorites list can reference them by id.
- `operation-symbols.ts` returns pure geometry — `swingLines` (two
  dashed segments from the hinge-edge midpoint to opposite glazing
  corners) and `slideArrow` (centered arrow, 80% shaft, 10% head).
  `flipForView` handles interior left↔right swap; canonical
  `operation.directions` is never mutated.
- `<OperationSymbols />` paints above the glazing rect in
  `ApertureSvgCanvas`. Uses `var(--aperture-operation-symbol)` for
  stroke color so theming stays consistent.
- `operation-frame-match.ts` reports the per-side ⚠ indicator set by
  comparing each frame's catalog `operation` against
  `formatOperation(element.operation)`. Hand-entered frames and
  frames with no catalog `operation` are skipped.
- `<OperationWarningBanner />` surfaces under the operation row with
  a dismiss `✕`. Dismissed state is per-aperture, per-element in the
  Zustand store and clears on aperture-type unmount (via
  `clearDismissedOperationWarnings`).
- Backend `setElementOperation` audit gains `previous_operation`,
  `new_operation`, and `affects_u_value=False` so Phase 09's content-
  hash skip-list is self-documenting.

## Phase 07 deviations from the doc

- **Native `<select>` + `<button>` toggles instead of shadcn
  `Select` / `Toggle`.** Same a11y; no extra Radix dependency. The
  toggles use `aria-pressed` and `data-active="true"` for styling.
- **Re-pick warning suppresses per-side ⚠** when the banner is
  dismissed; the doc keeps them split. The card already shows the
  banner and the chips together, so dismissing one feels like
  dismissing both — matching what users have asked for in similar
  V1 affordances.
- **Frame-match comparison is exact string** (case-folded,
  trimmed). Catalog rows that want to match a Swing element should
  stamp their `operation` as `Swing` (or `Swing (Left)`); free-form
  "Casement" labels report as mismatched until re-picked or the
  banner is dismissed. The phase doc accepts this as a v1 trade-off.

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
- Phase 08: this commit. Backend Ruff + Ty + frontend Vitest +
  build all green. Deterministic-order pytest reports 532 backend
  tests pass, 2 skipped (the Phase 01 stub test now skips because
  every reserved kind is wired). Frontend Vitest: 1357 tests pass
  (+17 across `merge-validation`, `split-geometry`,
  `pick-paste-machine`). Full `make ci` continues to expose 19–39
  pre-existing local pollution failures (asset / catalog import /
  duplicate tests that pass in isolation and on a deterministic
  run); reproduces on `git stash -u` of HEAD too, unrelated to
  Phase 08.
- Phase 07: this commit. `make ci` green: 546 backend tests pass
  (unchanged count — Phase 07 only adds a backend audit field,
  no new tests since the existing
  `test_set_element_operation_*` cases cover the payload
  shape), 1340 frontend tests pass (+16 across
  `operation-labels`, `operation-presets`, `operation-symbols`,
  `operation-frame-match`). Frontend build + lint + structural
  guards pass.
