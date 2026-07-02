---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Final verification and durable docs updates.
RELATED:
  - ../PLAN.md
  - ./phase-01-api-guardrails.md
  - ./phase-02-rooms-affordance.md
  - ./phase-03-cascade-ux.md
---

# Phase 04 - Verification and Docs

## Goal

Prove the feature is safe across shared DataTable paths and record the durable
contract outside the feature packet.

## Verification

- Backend targeted tests for allowlisted/protected option edits.
- Frontend unit tests for FieldConfig modal, SingleSelect popover create gating,
  paste unknown-label behavior, and cascade delete behavior.
- Browser smoke on Rooms:
  - add Floor option
  - rename Zone option
  - reorder Floor options
  - delete unused option
  - exercise referenced delete behavior selected in Phase 00
- Browser smoke on one protected `status` table:
  - no manage-options affordance
  - no inline create
  - pasted unknown status label rejected

## Docs

- Update `context/technical-requirements/data-table.md` with the final option
  mutability contract.
- Update `STATUS.md` with exact tests run and any deferred follow-up.
- Archive or mark superseded any phase notes that are folded into durable
  context docs.

## Exit Criteria

- The feature is not dependent on memory of this packet for future DataTable
  work.
- All protected/allowlisted semantics are covered by tests.
