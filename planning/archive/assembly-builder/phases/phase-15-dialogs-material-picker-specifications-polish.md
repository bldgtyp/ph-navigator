---
DATE: 2026-05-27
TIME: 21:23 EDT
STATUS: Implemented on branch; review and browser evidence remain.
AUTHOR: Codex
SCOPE: Assembly Builder UI/Layout parity, phase 15.
RELATED:
  - planning/archive/assembly-builder/PRD.md
  - planning/archive/assembly-builder/assets/_v1_segment_attribute_modal.png
  - planning/archive/assembly-builder/assets/_v1_ip_metric_swtich.png
  - frontend/src/features/envelope/components/dialogs/SegmentDialog.tsx
  - frontend/src/features/envelope/components/dialogs/SegmentMaterialPicker.tsx
  - frontend/src/features/envelope/components/ProjectMaterialEditor.tsx
  - frontend/src/features/envelope/components/SpecificationsPanel.tsx
  - frontend/src/features/envelope/components/MaterialDrift.tsx
---

# Phase 15 - Dialogs, Material Picker, And Specifications Polish

## Goal

Bring the editor surfaces around the canvas up to the same standard as
the new shell and canvas: V1-familiar segment editing, cleaner material
selection, shared project-material editing, and Specifications cards
that work as the project-material QA surface without feeling like a
generic form dump.

## In Scope

- Rework Segment Properties around the V1 mental model:
  - material selection first;
  - material preview;
  - segment width;
  - steel-stud spacing;
  - continuous-insulation flag;
  - save/cancel/delete actions.
- Preserve the in-modal IP/SI toggle pattern for focused numeric
  editors.
- Replace plain catalog/project material selects with a more scannable
  picker surface:
  - "In this project";
  - "From catalog";
  - hand-enter custom material;
  - detach to custom material.
- Keep the shared `ProjectMaterialEditor` as the one value-editing path
  from Segment Properties and Specifications.
- Polish Specifications material cards:
  - status and drift badges;
  - datasheet cell;
  - use-site notes/photos;
  - unused material section and confirmation.
- Replace remaining browser-native confirmation where feasible with app
  dialogs/toasts.

## Out Of Scope

- Canvas hover controls. Phase 14 owns them.
- New material-catalog manager features.
- Bulk Specifications operations.
- Runtime custom fields.
- Backend command semantics unless a UI bug exposes a missing guard.

## Implementation Notes

- Preserve V2's changed product model: project-material status,
  datasheets, notes, and catalog drift live on `project_materials[]`;
  use-site notes and photos live on segments.
- The material picker should not load the catalog until the picker is
  opened from an editable surface.
- Add a focused check that the catalog is not requested before the
  "From catalog" picker opens and is not reloaded unnecessarily within
  one picker session.
- Keep all physical value writes SI canonical.
- Avoid mounting controlled editors for every material card. Keep the
  Phase 4 on-demand editing lesson intact.
- Dialogs should be sized for real material names and notes without
  pushing actions below inaccessible scroll regions.

## Implementation Notes - 2026-05-27

- Segment Properties now opens as a material-first dialog with assigned
  material preview, project/catalog/hand-enter picker tabs, geometry
  controls, and the shared project-material editor available from the
  same surface.
- The Materials catalog query is gated until the user opens the "From
  catalog" tab, and repeated active-tab clicks avoid no-op picker state
  updates.
- The shared `ProjectMaterialEditor` remains a standalone form when used
  inside Segment Properties, so Enter in material fields updates the
  material form instead of submitting segment geometry.
- Focused frontend coverage now verifies catalog-query gating and
  project-material plus hand-enter command payloads from the segment
  picker.
- Specifications QA cards were kept on the existing Phase 4/6/7 surface;
  Phase 16 should browser-smoke those cards together with the new dialog
  flow before release closeout.

## Verification

- `git diff --check`
- `cd frontend && pnpm run format`
- `cd frontend && pnpm exec eslint src/features/envelope`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- Add or extend frontend tests for:
  - project-material pick;
  - catalog pick;
  - hand-enter material;
  - detach to custom material;
  - material value editing from Segment Properties;
  - material value editing from Specifications;
  - use-site note update.
- Browser smoke:
  - open Segment Properties on assigned and null segments;
  - exercise one representative material-source change;
  - verify catalog query gating from the picker surface;
  - edit physical values in IP and SI;
  - edit Specifications status/notes/evidence;
  - verify viewer/locked modes are read-only.

## Exit Criteria

- Segment Properties looks and behaves like the V2 replacement for the
  V1 modal, not a stack of raw fields.
- Material picking is scannable enough for the current catalog scale.
- Specifications is usable as the project-material QA sweep surface.

## Risks

- Material picker polish can accidentally couple every Envelope render to
  catalog reads. Keep catalog query gating intact.
- Specifications can become card-heavy. Favor dense, scannable cards over
  decorative layout.
