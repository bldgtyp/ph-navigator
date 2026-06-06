---
DATE: 2026-06-05
TIME: 19:55 EDT
STATUS: In progress — Phases 01–10 shipped (Phase 05 split into two PRs).
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

Begin Phase 11 (`phases/phase-11-manufacturer-filters.md`) —
manufacturer multi-select filters wired through the catalog
filters introduced in Phase 06.

## Phase 10 — HBJSON window-constructions export (shipped)

- Backend `aperture_hbjson_export` module: `identifiers.py`
  (escape rule + `detect_collisions`), `service.py`
  (`export_apertures` / `export_aperture_window_constructions`
  emitting the minimal-stable V1 `WindowConstruction.to_dict()`
  shape with one `EnergyWindowMaterialSimpleGlazSys` material
  per element), `routes.py`
  (`GET /api/v1/projects/{id}/versions/{vid}/apertures/hbjson?source=draft|version`),
  `mcp.py` (`tool_get_aperture_window_constructions`). Mounted in
  `main.py` + registered as the MCP read tool
  `get_aperture_window_constructions`.
- Identifier escape rule
  (`re.sub(r"[^A-Za-z0-9_]", "_", raw)` + collapse + strip) is now
  a stable contract documented in
  `context/technical-requirements/hbjson-export.md`. Empty result
  → 422 `aperture_hbjson_identifier_empty`; cross-aperture
  collisions → 422 `aperture_hbjson_identifier_collision` naming
  both source apertures. No silent suffix disambiguation.
- `u_factor` is the per-element ISO 10077-1 value from the Phase 09
  cache (rounded to 4 dp), `shgc` is `glazing.g_value` (V1 fallback
  `0.5` when null, also rounded), `vt` hardcoded `0.6` until a real
  catalog field exists. V1 shape fixture lives at
  `backend/tests/fixtures/aperture_hbjson_export/v1_shape.json`
  and is asserted exactly by the service test.
- Frontend: `download-file.ts` (DOM-anchor download helper),
  `ExportHbjsonAction` overflow-menu button (lucide `Download` icon,
  PRD-§17 label `Export window constructions (HBJSON)`), wired into
  a new native-`<details>` overflow menu in `AperturesHeader`.
  Hidden for Viewers / projects with no active version; disabled
  when the apertures table is empty. Collision and empty-identifier
  errors surface to the existing `actionError` banner with a
  copywritten message that names the offending apertures.
- Filename: `<bt_slug>_<version_slug>_apertures.hbjson.json`. Slug
  rule is local to the action; identifier escape rule stays
  server-side.

## Phase 10 deviations from the doc

- **Folder layout under `backend/tests/`**, not nested
  `backend/features/aperture_hbjson_export/__tests__/`. Matches the
  repo's existing pytest convention (the Phase 09 U-Value tests
  also live under `backend/tests/`).
- **No Sonner toast** — V2 does not yet have a toast library; the
  action surfaces errors through the existing aperture-page
  `actionError` banner via an `onError` callback. The Phase 13
  follow-up can swap to a toast layer without touching the action's
  public surface.
- **Minimal-stable payload shape** — honeybee_energy's `to_dict()`
  includes a per-call random `properties.ref.identifier` that would
  break determinism; we ship the strictly-required `type` /
  `identifier` / `materials` (and the material's `type` /
  `identifier` / `u_factor` / `shgc` / `vt`) which `from_dict`
  accepts. The fixture pins this exact subset as the contract.
- **REST returns the bare dict, not the V2 envelope** — V1 parity.
  The MCP tool returns the same shape so Rhino / Grasshopper
  scripts written against V1 can switch transports without
  re-wrapping.

## Phase 09 — U-Value service + display chips (shipped)

- Backend `aperture_u_value` module: `service.py` (ISO 10077-1
  composite per element + window-level), `cache.py` (SHA-256
  content hash + bounded LRU; 256 entries), `models.py`
  (`ApertureUValueResult`, `ApertureElementUValue`,
  `ApertureUValueWarning`), `routes.py`
  (`GET /api/v1/projects/{id}/versions/{vid}/apertures/u-values?source=draft|version`).
  Mounted in `main.py`.
- Content hash excludes `operation` and `name` so toggling
  operation type or renaming an element hits the cache instantly.
  Includes `row_heights_mm`, `column_widths_mm`, element spans,
  frame `width_mm` / `u_value_w_m2k` / `psi_g_w_mk`, and glazing
  `u_value_w_m2k`. Other ref fields are excluded because they
  don't enter the calculation.
- Missing frame / glazing assignments report as
  `ApertureUValueWarning` and the element's value falls back to
  zero (excluded from the aggregate). The window-level chip then
  surfaces an italic `(unfinished)` qualifier.
- Audit envelope flags backfilled: every dimension handler
  (`editDimension`, `addRow`, `addColumn`, `deleteRow`,
  `deleteColumn`) carries `affects_u_value=True`;
  `setElementName` carries `affects_u_value=False` explicitly.
  Picks / overrides / merge / split / paste already had the flag
  from earlier phases.
- Frontend: `format-u-value.ts` handles SI (`W/m²K`) and IP
  (`BTU/(hr·ft²·°F)`) labelling with two decimal places and the
  standard 0.1761 conversion factor. `UValueChip` ships in two
  modes (full-size for the header, compact for the per-element
  card) with a PRD §8 tooltip covering the no-films / no-operation
  / no-psi_install convention.
- `useApertureUValues` query keyed by `(project, version, source)`
  with `staleTime: 0`. The aperture mutation hook invalidates the
  U-value query after any successful command whose kind appears in
  a client-side `U_VALUE_AFFECTING_KINDS` set — mirrors the backend
  audit flag so the chip refreshes without waiting for the audit
  envelope.

## Phase 09 deviations from the doc

- **No V1 fixture parity tests.** The V1 source lives in
  `../ph-navigator/` (which V2 doesn't touch on CI), so we tested
  the algorithm against derived expected ranges rather than
  copying V1's fixture corpus. The arithmetic mirrors the V1
  service line-for-line; future parity work can lift fixtures
  into a dated review folder when needed.
- **Debounce omitted.** The mutation-success invalidation already
  fires once per command; 300 ms debounce would only matter under
  rapid sequential edits, which the toolbar gestures don't
  produce. The hook keeps the room for a debounce wrapper but
  doesn't ship one.
- **Cache is FIFO-bounded**, not strict LRU. The OrderedDict moves
  hits to the end so the policy converges to LRU under read
  pressure; the simpler model dodges the Liskov complaint that
  `dict.get`'s narrower stub generates against `ty`.
- **`UValueInfoTooltip` not a separate component.** The chip
  wears its tooltip via the native `title` attribute; the canonical
  copy lives in `U_VALUE_TOOLTIP` exported from
  `UValueChip.tsx` so future polish can spin it into a shadcn
  Popover without churning the API.

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
- Phase 09: this commit. `make ci` green: 558 backend tests pass
  (+7 for `test_aperture_u_value_service.py`), 1362 frontend
  tests pass (+5 for `format-u-value`). Backend Ruff + Ty pass,
  frontend lint + structural guards + production build pass.
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
