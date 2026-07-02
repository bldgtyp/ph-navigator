---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Implementation plan for Aperture Builder workflow improvements.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
  - ./decisions.md
---

# PLAN - Aperture Builder Workflow

## Phase 01 - Picker/Paste State - Complete

- Trace current picker, copy-source, and paste state transitions.
- Add or adjust the transition from valid source selection to paste-ready mode.
- Update toolbar icon/highlight state.
- Add focused tests for valid and invalid selection flows.

Status: Complete on `codex/aperture-builder-workflow`; focused Vitest coverage
confirms valid source picks arm paste mode directly and invalid/no-payload
source picks do not.

## Phase 02 - Flip Precedent - Complete

- Inspect Envelope Builder's `Flip left/right` behavior and data transform.
- Identify the Aperture Builder's element/frame data shape.
- Document remapping rules before implementation.

Status: Complete on `codex/aperture-builder-workflow`; accepted remapping
rules are captured in `decisions.md`.

## Phase 03 - Flip Implementation - Complete

- Add the Aperture Builder command.
- Mirror element/segment order.
- Remap left/right frame assignments and preserve head/sill assignments.
- Add tests for single, double, and multi-segment apertures.

Status: Complete on `codex/aperture-builder-workflow`; backend command tests
cover single-column, two-column frame swaps, and multi-segment span mirroring.
Frontend tests cover the toolbar action and disabled/active states.

## Phase 04 - Verification - Complete

- Run full format/CI checks after the Phase 03 implementation.
- Browser-smoke picker-to-paste and flip workflows.
- Update `STATUS.md` with evidence.

Status: Complete on `codex/aperture-builder-workflow`; full format/CI,
graphify, and browser-smoke evidence are recorded in `STATUS.md`.

## Split Guidance

This is likely two work sessions: Phase 01 first, then Phases 02-04 for flip.
