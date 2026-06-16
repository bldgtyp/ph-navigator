---
DATE: 2026-06-16
TIME: 12:14 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Confirm native-FK link architecture and decide reverse-overlay
  location before implementation.
RELATED:
  - planning/features/heat-pump-link-fields/PRD.md
  - frontend/src/features/equipment/heat-pumps/indoor-unit-columns.tsx
  - frontend/src/features/equipment/heat-pumps/components/IndoorUnitsTable.tsx
  - backend/features/heat_pumps/service.py
---

# Phase 01 - Audit And Decision

## Preconditions

- Feature packet exists and is discoverable from `planning/STATUS.md`.
- No runtime behavior changes have been made.

## Tasks

1. Confirm current field wiring:
   - `indoor-unit-columns.tsx`
   - `IndoorUnitsTable.tsx`
   - `outdoor-unit-columns.tsx`
   - `IndoorEquipTable.tsx`
   - `OutdoorUnitsTable.tsx`
2. Confirm backend reference semantics:
   - `backend/features/heat_pumps/models.py`
   - `backend/features/heat_pumps/service.py`
   - `backend/features/project_document/document.py`
   - `backend/tests/features/heat_pumps/`
3. Decide D1 from the PRD:
   - client-computed reverse columns from the loaded Heat Pumps slice; or
   - backend-provided Heat Pumps inverse overlay.
4. Record the decision in `PRD.md` or `decisions.md` before Phase 02.
5. Identify exact tests to modify/add for Phase 02 and Phase 03.

## Acceptance Criteria

- Decision D1 is resolved and documented.
- Implementation files are listed in `STATUS.md`.
- The plan still preserves the current persisted row shape unless a
  rejected assumption is found.

## Stop Conditions

- Stop before Phase 02 if the audit finds generic `linked_record`
  storage is required for business reasons, because that becomes a
  migration/refactor feature rather than a UI adapter.
- Stop before Phase 02 if the target reverse surfaces need server/API
  availability for non-frontend consumers.

## Verification

No required test run for this docs-only phase. If D1 chooses backend
overlay changes, run the focused backend Heat Pumps tests before Phase
02 starts.

## Result - 2026-06-16

D1 resolved to client-computed reverse columns from the loaded Heat
Pumps slice. Backend response shape remains unchanged because Heat
Pumps already returns all four sub-tables together and the native FK
fields remain the source of truth.
