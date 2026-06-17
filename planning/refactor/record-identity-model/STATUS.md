---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Active - Phase 00 complete (2026-06-17), Phase 01 next
AUTHOR: Ed (via Claude)
SCOPE: Current state of the record identity model refactor planning.
RELATED:
  - planning/refactor/record-identity-model/README.md
  - planning/refactor/record-identity-model/PRD.md
  - planning/refactor/record-identity-model/PLAN.md
---

# Record Identity Model - Status

## Current State

`Active - Phase 00 complete, Phase 01 next`.

**Phase 00 (backend identity guarantee) landed 2026-06-17.** Hidden
`row.id` uniqueness is now enforced universally via
`generic_table_row_ids()` + `validate_table_row_ids()` in
`backend/features/project_document/_validators.py`; the Heat Pumps and
Space-Types user-facing-handle hard blocks were removed. See the phase-00
file's "Outcome" section. Full backend suite green. Phases 01 (the atomic
Display Name / Tag swap + migration) and 02 (verification, docs, closeout)
remain.

This packet was authored from the 2026-06-16 consistency review and owner
decisions on identifier semantics.

**Reconciled 2026-06-16 19:03 EDT** with the landed spaces-refactor (new
`space_types` table, Rooms `space_type_id` link, schema v7). Space-Types
is a second table that hard-blocks a user-facing handle today
(`document.py:332-334`); Phase 00 now removes those blocks alongside Heat
Pumps, and Phase 01 repoints the Rooms -> Space-Type picker label
resolution to the Display Name. The spaces-refactor is at Phase 04
complete / Phase 05 (verification) pending - sequence this refactor after
that closeout.

This refactor **precedes** the data-table-consolidation refactor; that
folder's Phase 02 and Phase 04 should inherit this identity model.

## Next Step

Begin Phase 01:

`planning/refactor/record-identity-model/phases/phase-01-swap-identity-columns.md`

## Phase Status

| Phase | State |
|---|---|
| 00 - Backend identity guarantee (universal id guard; remove Heat Pumps **and** Space-Types hard blocks) | Complete (2026-06-17) |
| 01 - Swap identity columns (Display Name + Tag) | Planned (atomic migration; key design decision = repoint identifier role) |
| 02 - Verification, docs, closeout | Planned |

## Blockers

None for starting Phase 01, but it is gated on the identifier-role
repointing decision (move the role off `record_id` to the Display Name
field while keeping stable field_keys) and the conditional migration
design (preserve user renames).

## Decisions Recorded

- One human label, **Display Name**, and it is the **descriptive name**
  field (formerly "Name"), promoted to the pinned identifier column.
- The ambiguous **"Name"** label is retired on every table.
- The short code becomes an ordinary, non-unique **Tag** field (the
  former `record_id`, already labeled "Tag" on most tables).
- "ID" rejected as a label (collides with the hidden identifier).
- The user-facing label is **never unique-constrained**; duplicates show
  the existing warning chip. Heat Pumps **and Space-Types** drop their
  hard blocks (Space-Types also drops its "named row requires a Tag"
  rejection).
- The hidden `row.id` remains the only enforced-unique identity, with a
  universal `validate_unique_ids` guard.
- Stable field_keys (`name`, `record_id`) and `row.id` minting do not
  change.
- **Rooms** Display Name defaults to a **formula** `{Number} - {Name}`
  (its existing `record_id` formula, relabeled and kept as the
  identifier, still editable); Rooms keeps Number + Name as inputs and
  has no Tag field.
- Ships as a **standalone refactor that precedes** the
  data-table-consolidation work.
- Identity model mirrors Honeybee `identifier` / `display_name`.
- **Space-Types** (added by the spaces-refactor) follows the generic flip
  (`name` -> pinned Display Name, `record_id` -> ordinary Tag) with **no**
  residual hard block; its `name` is optional, so a Tag-only row shows a
  blank pinned Display Name; and the Rooms -> Space-Type picker /
  reverse-pill label resolution prefers the Display Name. Decided
  2026-06-16.

## Open Questions Carried From The PRD

1. Field-key / role strategy for repointing the identifier off
   `record_id`.
2. Rooms formula - DECIDED: Rooms' Display Name is the existing
   `{Number} - {Name}` formula field, relabeled (not repointed); no Tag
   field. Remaining work is confirming the relabel leaves the formula
   deps/registry intact.
3. Pumps (and any other table) missing a `name` field - seed a new
   Display Name.
4. Schema-version bump vs non-breaking migration.
5. Heat-Pump interim UI after the backend hard block is removed but
   before HP joins the shared grid.
6. Space-Types - DECIDED: generic flip, no residual hard block, picker
   label resolution follows Display Name. Remaining implementation items
   are deleting the two `document.py` blocks (Phase 00), repointing the
   `RoomsPage` picker labels (Phase 01), and sequencing after the
   spaces-refactor's Phase 05 closeout.

## Verification Status

Phase 00: focused backend tests + full backend `uv run pytest` green (890
passed, 2 skipped). `make format` / `make ci` run at closeout. Phases 01
and 02 not started.
