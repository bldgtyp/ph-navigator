---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation plan for Aperture Builder workflow improvements.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Aperture Builder Workflow

## Phase 01 - Picker/Paste State

- Trace current picker, copy-source, and paste state transitions.
- Add or adjust the transition from valid source selection to paste-ready mode.
- Update toolbar icon/highlight state.
- Add focused tests for valid and invalid selection flows.

## Phase 02 - Flip Precedent

- Inspect Envelope Builder's `Flip left/right` behavior and data transform.
- Identify the Aperture Builder's element/frame data shape.
- Document remapping rules before implementation.

## Phase 03 - Flip Implementation

- Add the Aperture Builder command.
- Mirror element/segment order.
- Remap left/right frame assignments and preserve head/sill assignments.
- Add tests for single, double, and multi-segment apertures.

## Phase 04 - Verification

- Run focused frontend checks and relevant unit tests.
- Browser-smoke picker-to-paste and flip workflows.
- Update `STATUS.md` with evidence.

## Split Guidance

This is likely two work sessions: Phase 01 first, then Phases 02-04 for flip.

