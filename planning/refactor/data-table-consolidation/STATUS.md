---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Claude)
SCOPE: Current state of the DataTable consolidation refactor planning.
RELATED:
  - planning/refactor/data-table-consolidation/README.md
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/refactor/data-table-consolidation/PLAN.md
---

# DataTable Consolidation - Status

## Current State

`Active - planning complete, awaiting implementation`.

No code changes have been made. This packet was authored from the
2026-06-16 consistency review
(`planning/code-reviews/2026-06-16/data-table-consistency-review.md`).
PRD, plan, and seven phase files are ready for handoff.

## Next Step

Begin Phase 00:

`planning/refactor/data-table-consolidation/phases/phase-00-frontend-subtraction.md`

Phase 01 (backend validation hardening) is independent and may be picked
up in parallel.

## Phase Status

| Phase | State |
|---|---|
| 00 - Frontend subtraction | Planned |
| 01 - Backend validation hardening | Planned |
| 02 - Shared column builders | Planned |
| 03 - Shared row modal and links | Planned |
| 04 - Data-shape and backend symmetry | Planned |
| 05 - Heat Pumps on shared abstraction | Planned (design spike required) |
| 06 - Verification, docs, closeout | Planned |

## Blockers

None for starting Phase 00 or Phase 01.

Phase 05 is gated on its own design spike (heat-pump slice shape and
custom-field storage) and on confirming the Plan-31 custom-field/locks
state before implementation.

## Decisions Recorded

- The shared `data-table` package is canonical; the refactor uses it
  more rather than redesigning it.
- Single-select, link/linked-record, attachment, and identifier columns
  must render through one shared cell each, in grid and in modals.
- One shared row-edit modal/hook backs all per-row editors.
- Heat Pumps is sequenced last and must join the shared abstraction
  (controller + shell + `TableContract`), retiring its forked
  view-state hook and `OptionPicker`.
- The backend must validate asset-id and option-id references on every
  table's write path.
- Identifier-uniqueness becomes one rule for all tables, recorded in
  `data-table.md` (default: non-unique per the spec).
- Behavior-preserving phases (00, 02, 03) keep user-visible behavior;
  convergences are the only intended change.

## Open Questions Carried From The PRD

1. Identifier-uniqueness rule - RESOLVED and LANDED (2026-06-17) by the
   preceding record-identity-model refactor
   (`planning/archive/record-identity-model/`, schema v8): hidden
   `row.id` unique (universal guard), user-facing Display Name never
   constrained, Heat Pumps **and** Space-Types hard blocks removed.
   Phase 04's B3 item is now a no-op verification of the landed
   behavior; Phase 02's identifier helper inherits the shipped
   `isIdentifier`-flag baseline.
2. `inside_outside` / `phase` storage tier and migration cost (Phase 04).
3. Heat-pump slice on one controller vs per-sub-table slices (Phase 05).
4. Heat-pump custom-field storage path (Phase 05).
5. Asset-reference enforcement: reject-on-write vs strip-and-warn
   (Phase 01).

## Verification Status

Not started. This pass is planning-only, so no code or test gates were
run.
