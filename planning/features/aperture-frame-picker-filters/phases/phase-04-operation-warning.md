---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Align operation mismatch warning with the picker operation-family
  matcher.
RELATED:
  - planning/features/aperture-frame-picker-filters/phases/phase-03-picker-filter-engine.md
  - frontend/src/features/apertures/operation-frame-match.ts
  - frontend/src/features/apertures/__tests__/operation-frame-match.test.ts
  - frontend/src/features/apertures/picker-filters.ts
---

# Phase 04 - Operation Warning

## Goal

Make the existing "operation changed" warning use the same operation-family
matcher as the picker. The warning must stay advisory and must not introduce
backend enforcement or frame clearing.

## Expected source edits

- `frontend/src/features/apertures/operation-frame-match.ts`
- `frontend/src/features/apertures/__tests__/operation-frame-match.test.ts`
- shared helper export from
  `frontend/src/features/apertures/picker-filters.ts`

## Implementation plan

1. Export the Phase 03 operation-family matcher.
2. Replace exact-string comparison in `operation-frame-match.ts` with that
   matcher.
3. Preserve existing skip rules:
   - no frame -> no mismatch;
   - hand-entered frame (`catalog_origin === null`) -> no mismatch;
   - frame operation missing/null -> no mismatch;
   - element operation unavailable -> no mismatch.
4. Keep warning copy and dismissal behavior unchanged unless tests show copy is
   tightly coupled to exact matching.

## Expected warning behavior

| Element operation | Frame operation | Result |
|---|---|---|
| Swing | Casement | no warning |
| Swing | Tilt-Turn | no warning |
| Swing | Double-Hung | no warning |
| Swing | Fixed | warning |
| Fixed | Fixed | no warning |
| Fixed | Casement | warning |
| Slide | Sliding | no warning |
| Slide | Double-Hung | no warning |
| Slide | Fixed | warning |

## Edge cases

- Legacy labels like `Swing (Left)` currently exist in tests. Treat them as
  Swing-family if the matcher can safely parse the prefix; otherwise update the
  test fixture to seeded-style labels and document the choice.
- Unknown imported operations should warn when operation filtering would exclude
  them, because the row is not known to match the aperture element operation.

## Verification

- `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/operation-frame-match.test.ts`
- Existing Aperture element card warning tests, if present.

## Handoff acceptance

- Picker and warning use one shared operation-family definition.
- A frame that the operation filter intentionally allows does not immediately
  trigger an operation mismatch warning.
