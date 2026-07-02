---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current state for aperture frame compatibility rules.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# STATUS - Aperture Frame Compatibility Rules

## State

`Complete` - Phases 01-04 are implemented and verified. Final archive cleanup
completed on 2026-07-02.

## Phase 01 Baseline Observed On 2026-07-02

- Prior picker-filter work lives at
  `planning/archive/dated/2026-06-27/aperture-frame-picker-filters/`; the
  relevant source-of-truth docs are its `PRD.md` and
  `phases/phase-03-picker-filter-engine.md`.
- Dropdown filtering is centralized in
  `frontend/src/features/apertures/picker-filters.ts`.
- Side compatibility is `top -> Head, Any`, `bottom -> Sill, Any`, and
  `left/right -> Jamb, Any`. It does not yet treat `Mull-H` as compatible with
  head/sill or `Mull-V` as compatible with jamb sides.
- Operation compatibility is `Fixed -> Fixed`,
  `Swing -> Swing/Inswing/Outswing/Casement/Awning/Hopper/Tilt-Turn/Double-Hung`,
  and `Slide -> Slide/Sliding/Double-Hung`.
- `frontend/src/features/apertures/components/FramePicker.tsx` applies
  `filterFrameRows()` to dropdown options and preserves the selected row when
  active filters would otherwise hide it.
- `frontend/src/features/apertures/operation-frame-match.ts` already reuses
  `frameOperationMatchesElement()` for the advisory mismatch warning.
- Frame assignment paths do not enforce compatibility:
  `pickFrame` stores catalog-sourced frame refs and `setElementOperation`
  updates only the element operation. The current compatibility surface is
  dropdown filtering plus frontend advisory warning logic.

## Phase 02 Decisions

- Slider frame pickers exclude catalog rows whose normalized operation is
  `Fixed` when operation compatibility filtering is enabled. When operation
  filtering is off, the picker preserves the existing broad-browse behavior.
- Stationary-panel fixed-frame exceptions are deferred and out of current scope
  until frame assignment knows segment role (`FX-to-FX`, `OP-to-FX`,
  `OP-to-OP`) at pick time.
- Side/location compatibility matrix:
  - `top` / Head side: `Head`, `Mull-H`, `Any`.
  - `bottom` / Sill side: `Sill`, `Mull-H`, `Any`.
  - `left` and `right` / jamb sides: `Jamb`, `Mull-V`, `Any`.
- Excluded side/location cases while side filtering is enabled:
  - `Mull-H` on left/right jamb sides.
  - `Mull-V` on head/sill sides.
  - `Head` on sill or jamb sides.
  - `Sill` on head or jamb sides.
  - `Jamb` on head or sill sides.
- Compatibility remains metadata-based: catalog frame operation plus location
  against aperture element operation plus side. Phase 03 excludes backend
  document validity enforcement; the implementation scope is dropdown filtering
  plus the existing frontend advisory mismatch warning.

## Next Step

Archived under `planning/archive/dated/2026-07-02/aperture-frame-compatibility-rules/`.

## Phase 03 Implementation

- Updated `frontend/src/features/apertures/picker-filters.ts` so side-filtered
  frame pickers include `Mull-H` on top/bottom sides and `Mull-V` on
  left/right jamb sides while preserving `Any`.
- Kept operation-family compatibility centralized in the existing
  `frameOperationMatchesElement()` helper. Slide-family filtering already
  excludes `Fixed` when operation filtering is enabled, and
  `operation-frame-match.ts` already reuses the same helper for advisory
  warnings.
- Updated focused tests in
  `frontend/src/features/apertures/__tests__/picker-filters.test.ts` and
  `frontend/src/features/apertures/__tests__/FramePickerFilterEngine.test.tsx`
  to cover compatible and incompatible `Mull-H`/`Mull-V` side assignments.

## Open Decisions

None for the current implementation scope.

## Verification Ledger

- 2026-07-02: `graphify query "aperture frame dropdown filtering predicate slider swing Mull-H Mull-V frame location compatibility"`
  located `picker-filters.ts`, `operation-frame-match.ts`, and related tests.
- 2026-07-02: source inspection covered
  `frontend/src/features/apertures/picker-filters.ts`,
  `frontend/src/features/apertures/components/FramePicker.tsx`,
  `frontend/src/features/apertures/operation-frame-match.ts`,
  `frontend/src/features/apertures/__tests__/picker-filters.test.ts`, and
  `frontend/src/features/apertures/__tests__/FramePickerFilterEngine.test.tsx`.
- 2026-07-02: `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/picker-filters.test.ts src/features/apertures/__tests__/FramePickerFilterEngine.test.tsx src/features/apertures/__tests__/operation-frame-match.test.ts`
  passed: 3 files, 21 tests.
- 2026-07-02: `cd frontend && pnpm run format` completed; intended changed
  files were unchanged by formatting.
- 2026-07-02: Browser smoke passed against
  `http://localhost:5173/projects/d8ec633a-f1b5-458d-b0db-650778849ace/apertures/builder`
  using `codex@example.com` and the `AGENT-BROWSER` fixture. Evidence:
  - Top frame picker with side filter on included `Head` and `Mull-H`, excluded
    `Mull-V` and `Jamb`.
  - Right frame picker with side filter on included `Jamb` and `Mull-V`,
    excluded `Mull-H` and `Head`.
  - Top frame picker with side filter off exposed `Mull-H`, `Mull-V`, `Jamb`,
    and `Sill`.
  - With operation filtering on and the element set to `Slide`, the top frame
    picker included `Sliding` rows and excluded `Fixed` rows.
- 2026-07-02: `make frontend-dev-check` passed: Prettier check, ESLint
  (0 errors; 15 pre-existing warnings: `react-refresh/only-export-components`
  in Apertures/Climate/shared DataTable files and
  `react-hooks/exhaustive-deps` in `useSliceTableController.ts`), frontend
  structural guards, and production build.
