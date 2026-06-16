---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Claude)
SCOPE: Identity contract for project DataTables - hidden unique key,
  non-unique "Display Name" label, and "Tag" as an ordinary field.
RELATED:
  - planning/refactor/record-identity-model/README.md
  - planning/refactor/record-identity-model/PLAN.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md
---

# Record Identity Model - PRD

## Problem

The DataTables conflate two different ideas into one column and label it
inconsistently, and one table over-constrains it:

- Every row already has a hidden machine identity, `row.id`
  (`rm_/pmp_/rec_…`), that owns linked-record targets and `custom_links`.
  Users never see it. But its uniqueness guard (`validate_unique_ids`,
  `backend/features/project_document/_validators.py:62`) is only applied
  to space-types, assembly segments, layers, and the heat-pump tables -
  not to Rooms, the 7 equipment tables, or Thermal Bridges. So the
  guarantee the rest of the model leans on is only partially enforced.
- The pinned user-facing column is the `record_id` *field* - a free-text
  label, not a key. It is intentionally non-unique: duplicates render a
  non-blocking warning chip
  (`frontend/src/shared/ui/data-table/lib/identifier/recordId.ts`,
  `computeIdentifierDuplicates`). But it is labeled **"Tag"** on nine
  tables and **"Record-ID"** on Rooms
  (`backend/features/project_document/tables/rooms.py:120`), and the
  contract says it should always be "Record-ID" - already inconsistent.
- Heat Pumps is the lone table that **hard-blocks** duplicate labels
  ("Duplicate tag within table",
  `backend/features/heat_pumps/service.py:225`), constraining the user's
  primary handle in a way no other table does.

"Tag" also carries specific architectural meaning that does not always
match how the column is actually used, so it is the wrong default label
for a generic record handle.

## Identity Contract (target)

Two clearly separated layers, applied uniformly to every table. This is
the Honeybee model: HB `identifier` maps to our hidden `row.id`; HB
`display_name` maps to our user-facing label.

| Layer | What it is | Unique? | User-visible? | Owns |
|---|---|---|---|---|
| Hidden key (`row.id`) | Machine id (`rm_/pmp_/rec_…`) | **Yes**, enforced on every table | No | Identity, linked-record targets, `custom_links`, formula deps |
| Display Name (`record_id` field) | Free-text human label, pinned column | **No**, never constrained | Yes | Nothing structural; just a readable handle |
| Tag (ordinary field) | Architectural tag where it applies | No | Yes | Nothing structural; a normal column |

Rules:

- The hidden `row.id` is the only enforced-unique identity, guaranteed on
  every table by a universal `validate_unique_ids` call.
- The pinned user-facing column is labeled **Display Name** on every
  table. It is never unique-constrained. Duplicate values render the
  existing non-blocking warning chip ("Also used on row N"). Empty /
  whitespace values never warn.
- No table hard-blocks a duplicate Display Name. Heat Pumps drops its
  per-table label-uniqueness enforcement.
- **Tag** is an ordinary field. It is seeded as a built-in column on the
  equipment tables (where it is domain-standard) and is otherwise a
  field users can add. It is editable, non-unique, and not the identity.
- The stable `record_id` field_key and the `row.id` minting scheme do not
  change. Only the user-facing `display_name` and the Tag field change.

## Honeybee / Forward Compatibility

Adopting "Display Name" gives a clean 1:1 mapping for the eventual
honeybee-ph round-trip: hidden `row.id` -> HB `identifier`; Display Name
-> HB `display_name`. This PRD does not implement that wiring; it only
chooses names that will not have to be re-mapped later.

## Migration Reality

Built-in FieldDefs - including `display_name` - are **persisted** in each
saved document (`read_field_defs` returns `envelope.field_defs`,
`backend/features/project_document/tables/_registry_helpers.py:71-73`).
Only the `locked` arrays are a render-time overlay
(`backend/features/project_document/custom_fields.py:196`); `display_name`
is a stored field (`:204`). Therefore renaming the label is **not** a
pure code change:

- The table seeds (`tables/*.py`) set the label for newly created
  documents/tables.
- A **forward-fill migration** must update the `record_id` FieldDef's
  `display_name` on existing `project_versions` and
  `project_version_drafts`.
- The built-in `display_name` is user-editable (built-ins default-lock
  only `["delete", "duplicate"]`), so the migration must be
  **conditional**: only rewrite values still equal to the old defaults
  ("Tag" / "Record-ID"); never overwrite a label a user intentionally
  renamed.

## Non-Goals

- No change to the DataTable interaction model, the warning-chip UX, or
  the linked-record system beyond what the rename requires.
- No change to `row.id` minting or the `record_id` field_key.
- No new uniqueness constraint on any user-facing field.
- No honeybee-ph export wiring in this refactor.

## Acceptance Criteria

1. `validate_unique_ids` (or equivalent) guards `row.id` uniqueness on
   every project DataTable, including Rooms, all 7 equipment tables, and
   Thermal Bridges.
2. No table hard-blocks a duplicate user-facing label; Heat Pumps'
   "Duplicate tag within table" enforcement is removed.
3. Duplicate Display Names render the existing non-blocking warning chip
   consistently across all tables.
4. The pinned identifier column is labeled **Display Name** on every
   table (seeds + frontend fallbacks), replacing "Tag" and "Record-ID".
5. A conditional forward-fill migration updates existing documents'
   `record_id` `display_name` from "Tag"/"Record-ID" to "Display Name"
   without overwriting user-renamed labels; existing documents still
   load.
6. **Tag** is a built-in, editable, non-unique ordinary field on the
   equipment tables, decoupled from identity; it is not the pinned
   column.
7. `context/technical-requirements/data-table.md` and
   `data-model.md` document the two-layer identity model, the
   Display Name label, the non-unique rule, and the universal hidden-id
   guarantee. `CODING_STANDARDS.md` (if relevant) notes the convention.
8. The data-table-consolidation refactor's identifier-column helper and
   uniqueness reconciliation reference this model as their baseline.
9. `make format` and `make ci` pass; `graphify update .` is run.

## Open Questions For Implementation

1. **Tag seed coverage.** Seed Tag on all 7 equipment tables, or only
   the subset where a tag is genuinely standard? Default: all 7
   equipment tables; Rooms and Thermal Bridges keep only Display Name
   unless a tag is requested.
2. **Display Name vs separate Name field.** Rooms and Thermal Bridges
   already have a `name` field alongside the identifier. Confirm
   "Display Name" + "Name" coexisting reads acceptably, or whether those
   tables want a domain-specific identifier label instead of the uniform
   "Display Name". Default: keep the uniform "Display Name".
3. **Schema-version bump.** Does adding the universal id guard + the Tag
   seed + the label migration warrant a `schema_version` bump, or can it
   ride as a non-breaking forward-fill? Decide in Phase 01/02 against the
   existing versioning policy.
4. **Heat Pumps interaction.** Heat Pumps fully inherits the warning-chip
   label behavior only once it joins the shared grid
   (data-table-consolidation Phase 05). This refactor removes HP's
   backend hard block now; confirm the HP frontend still renders
   acceptably in the interim.
