---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Implementation plan for aperture frame compatibility rules.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Aperture Frame Compatibility Rules

## Phase 01 - Rule Discovery

Status: Complete on 2026-07-02.

- Read the archived aperture-frame-picker-filters packet for prior decisions.
- Locate the current frame dropdown filtering predicate.
- Compare Swing and Slider filtering behavior.
- Identify all code paths that assign frame types to aperture sides.

## Phase 02 - Decision

Status: Complete on 2026-07-02.

- Resolve the fixed-frame slider question.
- Define the exact side/location compatibility matrix in `STATUS.md`.
- Record any rejected compatibility cases in this packet before implementation.

## Phase 03 - Implementation

Status: Complete on 2026-07-02.

- Centralize or update the compatibility predicate.
- Apply side/location compatibility to dropdown filtering and operation
  compatibility to both dropdown filtering and the frontend advisory operation
  mismatch warning.
- Add focused frontend/backend tests depending on where the predicate lives.

## Phase 04 - Verification

Status: Complete on 2026-07-02.

- Run focused test suites.
- Browser-smoke the relevant Apertures dropdowns.
- Update `STATUS.md` with evidence and any durable decisions.
