---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Aperture frame option compatibility rules for slider operations and
  mullion-location assignment.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - planning/archive/dated/2026-06-27/aperture-frame-picker-filters/README.md
---

# Aperture Frame Compatibility Rules

## Scope

Correct and consolidate aperture frame filtering rules:

- Slider operation dropdowns should not offer incompatible fixed frame options.
- `Mull-H` frame locations should be assignable to aperture head and sill sides.
- `Mull-V` frame locations should be assignable to aperture jamb sides.

## Read Order

1. `PRD.md` - compatibility behavior contract.
2. `PLAN.md` - investigation and implementation phases.
3. `STATUS.md` - current state and next action.

## Classification

`planning/refactor` because this tightens existing compatibility predicates and
picker filtering across Apertures/Catalogs rather than adding a new surface.

## Completion

Completed and archived on 2026-07-02 after focused Vitest coverage, browser
smoke against the `AGENT-BROWSER` fixture, and `make frontend-dev-check`.
