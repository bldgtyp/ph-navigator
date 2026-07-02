---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation plan for aperture frame compatibility rules.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Aperture Frame Compatibility Rules

## Phase 01 - Rule Discovery

- Read the archived aperture-frame-picker-filters packet for prior decisions.
- Locate the current frame dropdown filtering predicate.
- Compare Swing and Slider filtering behavior.
- Identify all code paths that assign frame types to aperture sides.

## Phase 02 - Decision

- Resolve the fixed-frame slider question.
- Define the exact side/location compatibility matrix:
  - `Head` side: `Head`, `Mull-H`
  - `Sill` side: `Sill`, `Mull-H`
  - `Left/Right` jamb sides: `Jamb`, `Mull-V`
- Record any rejected compatibility cases in this packet before implementation.

## Phase 03 - Implementation

- Centralize or update the compatibility predicate.
- Apply the same predicate to dropdown filtering and any validation path.
- Add focused frontend/backend tests depending on where the predicate lives.

## Phase 04 - Verification

- Run focused test suites.
- Browser-smoke the relevant Apertures dropdowns.
- Update `STATUS.md` with evidence and any durable decisions.

