---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Claude)
SCOPE: Current state of the record identity model refactor planning.
RELATED:
  - planning/refactor/record-identity-model/README.md
  - planning/refactor/record-identity-model/PRD.md
  - planning/refactor/record-identity-model/PLAN.md
---

# Record Identity Model - Status

## Current State

`Active - planning complete, awaiting implementation`.

No code changes have been made. This packet was authored from the
2026-06-16 consistency review and an owner decision on identifier
semantics. PRD, plan, and four phase files are ready for handoff.

This refactor **precedes** the data-table-consolidation refactor; that
folder's Phase 02 and Phase 04 should inherit this identity model.

## Next Step

Begin Phase 00:

`planning/refactor/record-identity-model/phases/phase-00-backend-identity-guarantee.md`

## Phase Status

| Phase | State |
|---|---|
| 00 - Backend identity guarantee | Planned |
| 01 - Display Name rename + migration | Planned |
| 02 - Tag as ordinary field | Planned |
| 03 - Verification, docs, closeout | Planned |

## Blockers

None for starting Phase 00. Phase 01 is gated on the conditional
forward-fill migration design (preserve user renames) and the
schema-version decision.

## Decisions Recorded

- User-facing identifier label is **Display Name** (not "ID" or "Name").
- **Tag** is demoted to an ordinary field and seeded built-in on the
  equipment tables; it is not the identity column.
- The user-facing label is **never unique-constrained**; duplicates show
  the existing warning chip. Heat Pumps drops its hard block.
- The hidden `row.id` remains the only enforced-unique identity, with a
  universal `validate_unique_ids` guard.
- The stable `record_id` field_key and `row.id` minting do not change.
- Ships as a **standalone refactor that precedes** the
  data-table-consolidation work.
- Identity model mirrors Honeybee `identifier` / `display_name` for
  forward-compatible model round-tripping.

## Open Questions Carried From The PRD

1. Tag seed coverage (all 7 equipment tables vs a subset).
2. "Display Name" + "Name" coexistence on Rooms / Thermal Bridges.
3. Schema-version bump vs non-breaking forward-fill.
4. Heat-Pump interim UI after the backend hard block is removed but
   before HP joins the shared grid.

## Verification Status

Not started. This pass is planning-only, so no code or test gates were
run.
