---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Planned - detailed phase handoffs drafted
AUTHOR: Codex
SCOPE: Implementation sequence for Apertures Builder frame-picker filter
  controls.
RELATED:
  - planning/features/aperture-frame-picker-filters/PRD.md
  - planning/features/aperture-frame-picker-filters/research.md
---

# Plan

## Detailed phase handoff files

Use the phase files as the implementation source of truth:

1. `phases/phase-00-decisions-and-readiness.md`
2. `phases/phase-01-menu-preferences.md`
3. `phases/phase-02-actions-menu-context.md`
4. `phases/phase-03-picker-filter-engine.md`
5. `phases/phase-04-operation-warning.md`
6. `phases/phase-05-catalog-option-seeds.md`
7. `phases/phase-06-verification-and-dev-data.md`

The sections below remain the compact summary.

## Phase 00 - Confirm persistence and taxonomy decisions

Resolved decisions:

1. Persistence scope:
   - use localStorage keyed by `project.id`, per browser/user;
   - do not add project-document state for these display preferences.
2. `location=Any` appears in all side-filtered dropdowns.
3. `Double-Hung` appears in both Swing and Slide operation filters.
4. Add `Awning` and `Hopper` to frame catalog operation option seeds.

## Phase 01 - Shared checkbox menu item and preference hook

Files:

- `frontend/src/shared/ui/AppMenu.tsx`
- `frontend/src/shared/ui/__tests__/AppMenu.test.tsx`
- `frontend/src/styles/base.css`
- `frontend/src/features/apertures/hooks/useFramePickerFilterPreferences.ts`

Work:

- Add `AppMenuCheckboxItem` using `role="menuitemcheckbox"` and
  `aria-checked`.
- Reuse `.app-menu__item` grid and add minimal checkbox mark CSS.
- Support `data-tooltip`, `title`, and `aria-description` on checkbox rows.
- Add a hook that reads/writes defaults:
  - `filterFramesBySide: true`
  - `filterFramesByOperation: false`
- Key localStorage by project, for example one JSON map under
  `phn.apertures.frame_picker_filters.v1`.
- Tolerate missing/invalid stored JSON and `window` absence.

Verification:

- `cd frontend && pnpm exec vitest run src/shared/ui/__tests__/AppMenu.test.tsx`
- focused hook tests if the hook gets its own test file.

## Phase 02 - Wire Apertures action menu and picker context

Files:

- `frontend/src/features/apertures/routes/AperturesTab.tsx`
- `frontend/src/features/apertures/hooks/useManufacturerFilter.ts` or a new
  sibling picker-filter context file
- `frontend/src/features/apertures/components/FramePicker.tsx`
- `frontend/src/features/apertures/components/FrameRow.tsx`

Work:

- Add the two checkbox items to the existing `Aperture actions` menu.
- Keep "Configure manufacturer filters" in the same menu.
- Provide picker filter preferences from `AperturesTab` to `FramePicker`.
- Preserve current isolated-render test ergonomics by giving `FramePicker`
  sensible defaults when no provider is mounted.

Verification:

- component test that the menu defaults to side on / operation off.
- component test that toggles persist per project key.

## Phase 03 - Replace exact operation filter with family filtering

Files:

- `frontend/src/features/apertures/picker-filters.ts`
- `frontend/src/features/apertures/hooks/useFrameCatalog.ts`
- `frontend/src/features/apertures/components/FramePicker.tsx`
- `frontend/src/features/apertures/__tests__/picker-filters.test.ts`
- `frontend/src/features/apertures/__tests__/PickerPortal.test.tsx` or a new
  focused FramePicker test.

Work:

- Replace `operationForElement(...).type` as the picker query value with an
  operation-family helper:
  - `operationsForElement(operation)` returns the planned family labels.
  - operation filtering can be skipped entirely when the toggle is off.
- Prefer client-side family filtering over backend multi-operation query
  expansion for the first implementation:
  - keep backend manufacturer filters where useful;
  - apply side and operation-family filters in the hook/component so
    multi-value rules like `Head + Any` and `Swing + Double-Hung` work without
    a backend API change.
- Continue prepending the selected row if it falls outside active filters.

Verification:

- Fixed element + side on: Head/Jamb/Sill narrowing still works.
- Fixed element + side on: `Any` rows are also visible for every side.
- Operation off: Casement/Tilt-Turn/Sliding rows are visible.
- Operation on + Swing: Casement/Tilt-Turn/Inswing/Outswing/Awning/Hopper rows
  are visible.
- Operation on + Swing: Double-Hung rows are also visible.
- Operation on + Slide: Sliding and Double-Hung rows are visible.
- Selected row outside filters stays visible.

## Phase 04 - Align mismatch warning with operation families

Files:

- `frontend/src/features/apertures/operation-frame-match.ts`
- `frontend/src/features/apertures/__tests__/operation-frame-match.test.ts`

Work:

- Reuse the same operation-family matcher used by the picker.
- Keep hand-entered/null-operation skip rules.
- Keep the warning as advisory only.

Verification:

- Swing + Casement/Tilt-Turn: no warning.
- Swing + Fixed: warning.
- Fixed + Casement: warning.
- Swing + Double-Hung: no warning.
- Slide + Sliding/Double-Hung: no warning.

## Phase 05 - Catalog option seeds

Files:

- `backend/features/catalogs/_option_seeds.py`
- `backend/tests/test_catalog_field_options.py`
- `backend/tests/test_catalogs_frame_types.py`

Work:

- Add `Awning` and `Hopper` to the seeded `frame_types.operation` list.
- Keep import behavior unchanged.

Verification:

- focused backend catalog option tests.

## Phase 06 - Browser smoke

Use the standard local route:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`
- login: `codex@example.com`

Smoke:

- Open Apertures Builder with seeded project.
- Verify side filter default on: top frame picker shows Head rows.
- Verify `Any` rows appear in top/right/bottom/left pickers while side filter
  is on.
- Turn side filter off: top frame picker can show Jamb/Sill/Mull rows.
- Verify operation filter default off: Swing element still shows Casement and
  Tilt-Turn rows.
- Turn operation filter on: Swing element narrows to swing-family rows,
  including Double-Hung.
- Switch to Slide: Sliding and Double-Hung rows are visible.
- Change a Swing element with a Casement frame to Fixed: assignment remains,
  mismatch warning appears.

DB note:

- Adding `Awning` and `Hopper` to the option seeds may require resetting and
  reseeding the local dev DB to see the new single-select options in existing
  local catalog state.

Final gate for implementation:

- focused Vitest tests listed above;
- `make frontend-dev-check` for frontend-only implementation;
- full closeout gate only when the feature is ready to commit.
