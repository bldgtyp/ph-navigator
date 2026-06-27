---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Side and operation-family filtering used by frame picker dropdown rows.
RELATED:
  - planning/features/aperture-frame-picker-filters/phases/phase-02-actions-menu-context.md
  - frontend/src/features/apertures/components/FramePicker.tsx
  - frontend/src/features/apertures/hooks/useFrameCatalog.ts
  - frontend/src/features/apertures/picker-filters.ts
  - frontend/src/features/apertures/__tests__/PickerPortal.test.tsx
---

# Phase 03 - Picker Filter Engine

## Goal

Replace the always-on exact operation query with optional client-side
operation-family filtering, and make side filtering optional while including
`Any` location rows for every side.

## Expected source edits

- `frontend/src/features/apertures/picker-filters.ts`
- `frontend/src/features/apertures/hooks/useFrameCatalog.ts`
- `frontend/src/features/apertures/components/FramePicker.tsx`
- new `frontend/src/features/apertures/__tests__/picker-filters.test.ts`
- `frontend/src/features/apertures/__tests__/PickerPortal.test.tsx` or a new
  focused FramePicker test file

## Recommended filter strategy

Prefer client-side side/operation-family filtering after a manufacturer-scoped
catalog fetch.

Rationale:

- The backend endpoint accepts one exact `location` and one exact `operation`.
- The requested behavior needs multi-value filters:
  - side `top` means `Head` plus `Any`;
  - Swing means several labels;
  - `Double-Hung` belongs to both Swing and Slide.
- The frame seed is small enough that fetching active frame rows by
  manufacturer and narrowing in the hook/component is simpler than expanding
  the backend API for multi-value filters.

## Filter helpers

Implement these in `picker-filters.ts` or equivalent:

```ts
type FrameSideLocation = "head" | "jamb" | "sill";

function sideLocationFamily(side: ApertureSide): readonly string[];
function operationFamilyForElement(operation: ApertureOperation | null): readonly string[];
function frameLocationMatchesSide(rowLocation: string | null, side: ApertureSide): boolean;
function frameOperationMatchesElement(
  frameOperation: string | null,
  operation: ApertureOperation | null,
): boolean;
```

Expected families:

| Element operation | Matching catalog labels |
|---|---|
| Fixed | Fixed |
| Swing | Swing, Inswing, Outswing, Casement, Awning, Hopper, Tilt-Turn, Double-Hung |
| Slide | Slide, Sliding, Double-Hung |

Expected side families:

| Aperture side | Matching catalog locations |
|---|---|
| top | Head, Any |
| right | Jamb, Any |
| bottom | Sill, Any |
| left | Jamb, Any |

Normalize case, trim whitespace, and tolerate hyphen/space variants where
reasonable. Do not rewrite stored catalog labels.

## Implementation plan

1. Change `FramePicker` to read preferences from the Phase 02 hook.
2. Adjust `useFrameCatalog` usage:
   - keep manufacturer filtering in the query args;
   - stop sending exact `operation` when operation filtering is off;
   - avoid sending exact `location` when side filtering needs `Any` included
     unless the backend gains multi-location support.
3. Filter returned active rows client-side:
   - apply side matcher only when `filterFramesBySide` is true;
   - apply operation matcher only when `filterFramesByOperation` is true.
4. Preserve the selected-row prepend behavior.
   - Use the same all-rows lookup currently in `FramePicker`.
   - If a selected row is outside current filters, prepend it once.
5. Improve the empty message if practical:
   - distinguish "no catalog frames available" from "no frames match current
     filters";
   - include a hint to adjust side/operation/manufacturer filters.

## Edge cases

- `location=null` rows: visible only when side filtering is off unless product
  decides null should mean Any. The current confirmed Any rule is only for the
  literal `Any` location label.
- Mull-H/Mull-V rows: hidden when side filtering is on; visible when side
  filtering is off.
- Unknown operation labels: visible when operation filtering is off; hidden
  when operation filtering is on.
- Manufacturer filters compose first. If manufacturer filtering leaves zero
  rows, side/operation toggles cannot create rows.
- `Double-Hung` must match both Swing and Slide.

## Verification

- `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/picker-filters.test.ts`
- Focused picker test cases:
  - side on + top includes Head and Any;
  - side on + right includes Jamb and Any;
  - side off includes Head/Jamb/Sill/Mull-H/Mull-V/Any rows;
  - operation off includes all operations;
  - operation on + Swing includes Casement, Inswing, Outswing, Tilt-Turn,
    Awning, Hopper, and Double-Hung;
  - operation on + Slide includes Sliding and Double-Hung;
  - selected row outside current filters is still present and selected.
- Existing portal behavior in `PickerPortal.test.tsx` still passes.

## Handoff acceptance

- Default behavior narrows by side but not operation.
- Users can turn side filtering off to browse all frame locations.
- Users can turn operation filtering on to narrow by operation family.
- Existing assignments are never cleared by these filters.

## Completion evidence

Implemented on 2026-06-27:

- Added side and operation-family helpers in `picker-filters.ts`.
- Switched `FramePicker` to fetch manufacturer-scoped active rows and apply
  side/operation filters client-side.
- Preserved selected-row prepending when active filters would otherwise hide the
  current assignment.
- Added a filter-aware empty message for rows excluded by current filters.

Verification passed:

```bash
cd frontend && pnpm exec vitest run src/features/apertures/__tests__/picker-filters.test.ts src/features/apertures/__tests__/FramePickerFilterEngine.test.tsx src/features/apertures/__tests__/PickerPortal.test.tsx
```
