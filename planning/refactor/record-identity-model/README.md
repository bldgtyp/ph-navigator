---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Active - implementation in progress (Phases 00 + 01 complete 2026-06-17; Phase 02 docs/closeout next); see STATUS.md
AUTHOR: Ed (via Claude)
SCOPE: Make the descriptive name the single "Display Name" and the pinned
  identifier on every DataTable, demote the old identifier to an ordinary
  "Tag" field, eliminate the ambiguous "Name" label, and make the
  hidden-id uniqueness guard universal.
RELATED:
  - planning/refactor/record-identity-model/PRD.md
  - planning/refactor/record-identity-model/PLAN.md
  - planning/refactor/record-identity-model/STATUS.md
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md
---

# Record Identity Model - Refactor Folder

## Scope

Make the identity model explicit, uniform, and unambiguous across every
project DataTable:

1. **Hidden key stays the only enforced-unique identity.** Each row's
   machine `row.id` (`rm_/pmp_/rec_…`) owns identity. Make the
   `validate_unique_ids` guard universal so this is a real guarantee on
   every table.
2. **One human label, "Display Name", and it is the descriptive name.**
   The field tables currently call "Name" becomes **Display Name** and
   the pinned identifier column (e.g. "Master Bedroom"). It is never
   unique-constrained; duplicates get the existing non-blocking warning
   chip. Heat Pumps stops hard-blocking duplicate labels. The ambiguous
   "Name" label is retired.
3. **The short code becomes an ordinary "Tag" field.** The old pinned
   identifier (`record_id`, already labeled "Tag" on most tables) is
   unpinned and becomes a normal, non-unique field.

This is the Honeybee model the firm already uses: HB `identifier`
(unique, machine) maps to our hidden `row.id`; HB `display_name` (the
human name) maps to our Display Name column.

## Why This Precedes The DataTable Consolidation

The consolidation refactor
(`planning/refactor/data-table-consolidation/`) builds a shared
identifier-column helper (its Phase 02) and reconciles identifier
uniqueness (its Phase 04). Both should inherit the settled identity model
from this folder, so the shared helper is built once against the right
pinned field, label, and uniqueness behavior. Land this first.

## Read Order

1. `PRD.md` - the identity contract and acceptance criteria.
2. `PLAN.md` - sequencing, precedents, and the migration risk.
3. `STATUS.md` - current state and next action.
4. Phase files under `phases/` when implementing.

## Phase Map

| Phase | File | Goal |
|---|---|---|
| 00 | `phases/phase-00-backend-identity-guarantee.md` | Make hidden-id uniqueness universal and stop both Heat Pumps and Space-Types hard-blocking duplicate user-facing handles. |
| 01 | `phases/phase-01-swap-identity-columns.md` | Atomic swap: promote the descriptive name to "Display Name" + pinned identifier, demote `record_id` to an ordinary "Tag" field, retire "Name", with a migration (incl. Rooms-formula and Pumps-no-name special cases). |
| 02 | `phases/phase-02-verification-docs-closeout.md` | Run gates, browser smoke, and fold the identity model into the contract and coding standards. |

## Current Decisions (from owner)

- There is **one** human label, **Display Name**, and it is the
  descriptive name field (formerly "Name"), promoted to the pinned
  identifier column.
- The ambiguous **"Name"** label is retired on every table.
- The short code becomes an ordinary, non-unique **Tag** field (the
  former `record_id` identifier, already labeled "Tag" on most tables).
- "ID" was rejected as the label - it collides with the hidden
  identifier and implies a uniqueness we do not enforce.
- The user-facing label is **never unique-constrained** on any table;
  duplicates show the existing warning chip. **Heat Pumps and Space-Types**
  both drop their hard blocks (Space-Types also drops its "named row
  requires a Tag" rejection).
- The hidden `row.id` stays the only enforced-unique identity, with a
  universal `validate_unique_ids` guard.
- Stable field_keys (`name`, `record_id`) do **not** change - only the
  identifier role, the labels, and the `row.id` guard.
- **Rooms** ships its Display Name as a **formula** defaulting to
  `{Number} - {Name}` (its existing `record_id` formula, relabeled, kept
  as the identifier and editable). Rooms keeps Number + Name as inputs
  and gets no Tag field. The formula-identifier capability is available
  to any table; only Rooms ships that way by default.
- **Space-Types** (added by the 2026-06-16 spaces-refactor) follows the
  generic flip: `name` -> pinned Display Name, `record_id` -> ordinary
  Tag, **no** residual hard block. Because it is a Rooms link target, the
  Rooms -> Space-Type picker / reverse-pill label resolution must follow
  the Display Name. Decided 2026-06-16.
- Ships as a **standalone refactor that precedes** the
  data-table-consolidation work.

> Reconciled 2026-06-16 19:03 EDT with the landed spaces-refactor (new
> `space_types` table, Rooms `space_type_id` link, schema v7). The
> spaces-refactor is at Phase 04 complete / Phase 05 (verification) pending;
> sequence this refactor after that closeout.

## Out Of Scope

- The broader DataTable consolidation (separate folder).
- Changing how `row.id` values are minted, or renaming stable field_keys.
- HBJSON / honeybee-ph round-trip wiring (the Display Name / identifier
  mapping is noted as forward-compatible, not implemented here).
