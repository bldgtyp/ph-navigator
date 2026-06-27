---
DATE: 2026-06-27
TIME: 08:56 EDT
STATUS: Planned - detailed phase handoffs drafted
AUTHOR: Codex
SCOPE: Apertures Builder frame-picker side and operation filter controls,
  operation-family matching, and per-project preference persistence decision.
RELATED:
  - planning/features/aperture-frame-picker-filters/PRD.md
  - planning/features/aperture-frame-picker-filters/research.md
  - planning/features/aperture-frame-picker-filters/PLAN.md
  - planning/features/aperture-frame-picker-filters/phases/
  - frontend/src/features/apertures/components/FramePicker.tsx
  - frontend/src/features/apertures/picker-filters.ts
  - frontend/src/features/apertures/operation-frame-match.ts
---

# Aperture Frame Picker Filters

## Scope

Add user-controlled frame-picker filters to the Apertures Builder so the
attribute-card frame dropdowns can be narrowed by side and, optionally, by
operation family.

The requested behavior:

- "Filter frames by side" lives in the existing Aperture actions `AppMenu`
  (`.app-menu__trigger` surface), defaults on, and controls whether top/right/
  bottom/left rows narrow by Head/Jamb/Sill.
- "Filter frames by operation" lives in the same menu, defaults off, and
  controls whether frame dropdowns narrow by Fixed/Swing/Slide family.
- Swing-family matching includes real catalog operation labels such as
  Inswing, Outswing, Tilt-Turn, Casement, Awning, Hopper, and Double-Hung.

This packet is planning only. It does not implement the controls.

## Read order

1. `research.md` - current code paths and existing persistence patterns.
2. `PRD.md` - target behavior and decisions.
3. `PLAN.md` - high-level implementation sequence.
4. `phases/phase-00-decisions-and-readiness.md` - implementer intake.
5. Continue through `phases/phase-01-*.md` to `phase-06-*.md`.
6. `STATUS.md` - current state, blockers, and next step.

## Phase map

| Phase | File | Purpose |
|---|---|---|
| 00 | `phases/phase-00-decisions-and-readiness.md` | Confirm behavior decisions and source context before code edits. |
| 01 | `phases/phase-01-menu-preferences.md` | Add shared checkbox menu item and localStorage preference hook. |
| 02 | `phases/phase-02-actions-menu-context.md` | Wire the Aperture actions menu and picker preference context. |
| 03 | `phases/phase-03-picker-filter-engine.md` | Implement optional side and operation-family filtering. |
| 04 | `phases/phase-04-operation-warning.md` | Align mismatch warnings with the operation-family matcher. |
| 05 | `phases/phase-05-catalog-option-seeds.md` | Add Awning and Hopper catalog operation options. |
| 06 | `phases/phase-06-verification-and-dev-data.md` | Run focused tests, browser smoke, dev-data refresh, and final gates. |

## Key design pressure

The requested "preserve selection per project" behavior is not just a UI
detail. The repo has three different persistence patterns nearby:

- project-document state, e.g. `tables.manufacturer_filters`, which is shared,
  versioned, and draft-affecting;
- server-backed per-user preference, e.g. `users.units_preference`;
- local browser preference, e.g. Apertures dimension display format in
  `localStorage`.

This plan recommends the smallest first step: project-keyed local browser
preference for these display-only picker filters. If the setting must follow a
user across browsers or machines, build the missing `user_project_preferences`
infrastructure first instead of putting display-only controls into the project
document.

## Out of scope

- Clearing or rewriting existing frame assignments when filters change.
- Making frame operation compatibility a backend validity constraint.
- Changing U-value calculations or cache invalidation.
- Redesigning the Project Settings modal.
- Reworking manufacturer filters, except for composition with the new filters.
