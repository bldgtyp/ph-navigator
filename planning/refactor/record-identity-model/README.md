---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Claude)
SCOPE: Separate the unique hidden record identity from the non-unique
  user-facing label, rename that label from "Tag" to "Display Name"
  across all DataTables, demote "Tag" to an ordinary field, and make the
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

Make the identity model explicit and uniform across every project
DataTable:

1. **Hidden key stays the only enforced-unique identity.** Each row's
   machine `row.id` (`rm_/pmp_/rec_…`) owns identity. Make the
   `validate_unique_ids` guard universal so this is a real guarantee on
   every table, not just some.
2. **The user-facing label becomes "Display Name" and is never
   constrained.** The pinned identifier column is a human label, not a
   key. Duplicates get the existing non-blocking warning chip on every
   table. Heat Pumps stops hard-blocking duplicate labels.
3. **"Tag" is demoted to an ordinary field.** It keeps its architectural
   meaning where it is standard (equipment) by being seeded as a normal
   built-in column, but it no longer claims to be the row's identity.

This is the Honeybee model the firm already uses elsewhere: HB
`identifier` (unique, machine) maps to our hidden `row.id`; HB
`display_name` (human, non-unique) maps to our user-facing label.

## Why This Precedes The DataTable Consolidation

The consolidation refactor
(`planning/refactor/data-table-consolidation/`) builds a shared
identifier-column helper (its Phase 02) and reconciles identifier
uniqueness (its Phase 04). Both should inherit the settled identity
model from this folder, so the shared helper is built once with the
right label, semantics, and uniqueness behavior. Land this first.

## Read Order

1. `PRD.md` - the identity contract and acceptance criteria.
2. `PLAN.md` - sequencing, precedents, and the migration risk.
3. `STATUS.md` - current state and next action.
4. Phase files under `phases/` when implementing.

## Phase Map

| Phase | File | Goal |
|---|---|---|
| 00 | `phases/phase-00-backend-identity-guarantee.md` | Make hidden-id uniqueness universal and stop Heat Pumps hard-blocking duplicate labels. |
| 01 | `phases/phase-01-display-name-rename.md` | Rename the identifier label "Tag"/"Record-ID" to "Display Name" in seeds and frontend, with a conditional forward-fill migration that preserves user renames. |
| 02 | `phases/phase-02-tag-as-ordinary-field.md` | Seed a built-in "Tag" field on the equipment tables, decoupled from identity. |
| 03 | `phases/phase-03-verification-docs-closeout.md` | Run gates, browser smoke, and fold the identity model into the contract and coding standards. |

## Current Decisions (from owner)

- User-facing label is **Display Name** (not "ID", which collides with
  the hidden identifier and implies a uniqueness we do not enforce; not
  "Name", which several tables already use for a separate field).
- **Tag** is demoted to a normal field and **seeded built-in on
  equipment** tables; it is no longer the identity column.
- The user-facing label is **never unique-constrained** on any table;
  duplicates show the existing warning chip. Heat Pumps drops its
  hard block.
- The hidden `row.id` stays the only enforced-unique identity, and its
  `validate_unique_ids` guard is made universal.
- This ships as a **standalone refactor that precedes** the
  data-table-consolidation work.

## Out Of Scope

- The broader DataTable consolidation (separate folder).
- Changing how `row.id` values are minted.
- Renaming the stable `record_id` field_key or the `row.id` scheme
  (only the user-facing `display_name` changes).
- HBJSON / honeybee-ph round-trip wiring (the Display Name / identifier
  mapping is noted as forward-compatible, not implemented here).
