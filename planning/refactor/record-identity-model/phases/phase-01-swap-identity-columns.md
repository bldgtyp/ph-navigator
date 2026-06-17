---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Make the descriptive name the single "Display Name" and the pinned
  identifier, demote the old identifier to an ordinary "Tag" field, and
  eliminate the ambiguous "Name" label - as one atomic swap with a
  migration.
RELATED:
  - planning/refactor/record-identity-model/PRD.md
  - backend/features/project_document/tables/
  - frontend/src/shared/ui/data-table/lib/identifier/recordId.ts
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
---

# Phase 01 - Swap The Identity Columns

## Goal

Land the owner's identity decision: there is **one** human label,
**Display Name**, which is the descriptive name and the pinned identifier
column; the short code lives in an ordinary **Tag** field; the ambiguous
**Name** label is gone. This is one atomic change (promote + demote +
relabel + migrate) so there is never an intermediate state with two
identifier columns or two "Display Name" columns.

## End State

| Field (stable key) | Before | After |
|---|---|---|
| `name` | "Name", ordinary short_text | **"Display Name"**, the pinned identifier column (carries the duplicate-warning chip) |
| `record_id` | "Tag" (8 tables), pinned identifier | **"Tag"**, ordinary non-unique field, unpinned |
| (no "Name" label remains, except on Rooms - see below) | | |

The table above is the generic case. **Rooms is the formula exception**
and does NOT do the repoint.

Per-table specifics:

- **8 tables** (appliances, electric_heaters, fans, hot_water_heaters,
  hot_water_tanks, ventilators, thermal_bridges, space_types): `name` ->
  Display Name + pinned; `record_id` keeps its "Tag" label but is
  unpinned and becomes ordinary. Data is preserved on both fields. "Name"
  retired.
- **Space-Types (generic flip, plus link-target follow-ups):** it is one
  of the 8, but two extra items apply. (1) Its `name` is optional today,
  so the pinned Display Name can be blank for a Tag-only row - acceptable
  (empty never warns), same as Pumps. (2) It is a Rooms link target: the
  Rooms -> Space-Type picker and reverse pills currently prefer Tag then
  Name (`RoomsPage.tsx:147-151`, `getRecordId`/`getDisplayName`); repoint
  that resolution to prefer the Display Name (`name`) first, then Tag,
  then row id. Phase 00 has already removed Space-Types' backend Tag
  hard blocks, so by this phase Tag is already an ordinary field.
- **Rooms (formula case, no repoint):** keep the existing `record_id`
  **formula** field (`{Number} - {Name}`) as the pinned identifier; only
  relabel "Record-ID" -> "Display Name". `number` and `name` stay as the
  ordinary input fields the formula reads, so "Name" legitimately remains
  on Rooms. No Tag field. The Display Name stays editable (change the
  formula or convert to plain text - the affordance exists today).
- **Pumps** (no `name` field today): add a built-in `display_name`-role
  field labeled "Display Name" (pinned, empty default); `record_id`
  "Tag" -> unpinned ordinary Tag.

## Preconditions

- Phase 00 complete (hidden-id guard universal; no label hard blocks,
  including the removed Space-Types duplicate-Tag and named-row-requires-Tag
  blocks).
- Confirmed structure: 9 tables seed a `name` field
  (`tables/*.py`, `field_key="name"`, including `space_types`); Pumps does
  not; Rooms' `record_id` is a formula (`tables/rooms.py:85,120`).
- Confirmed: built-in `display_name` and the pinned identifier are
  persisted in `envelope.field_defs`, so a migration is required.
- Field-key strategy decided (see Tasks 1 + Stop Conditions): keep all
  stable field_keys; move the identifier *role*, do not rename keys.

## Tasks

1. **Repoint the identifier role (shared system).** Today the pinned
   identifier is hardcoded to `RECORD_ID_FIELD_KEY = "record_id"`
   (`frontend/src/shared/ui/data-table/lib/identifier/recordId.ts:4`,
   the pin-by-field_key logic in `components/GridBody.tsx`, and the
   `__record_id__` whitelist in `sanitizeViewStateForSchema`).
   Generalize this so the identifier is the **table-declared** Display
   Name field, without renaming any field_key. For the 8 generic tables
   the declared identifier becomes the `name` field; for Rooms it stays
   `record_id` (the formula). The system must support both - the
   identifier field is per-table, not a global constant. The field keyed
   `record_id` becomes an ordinary column on the generic tables, and
   stays the identifier on Rooms.
2. **Backend seeds.** In each table seed (`tables/*.py`):
   - **8 generic tables:** relabel the `name` FieldDef `display_name`
     "Name" -> "Display Name" and mark it the identifier; drop the
     identifier role from `record_id` and leave it labeled "Tag" as an
     ordinary field.
   - **Rooms:** relabel the `record_id` formula FieldDef `display_name`
     "Record-ID" -> "Display Name"; keep its `{Number} - {Name}` formula,
     config, and deps; keep it as the identifier. Keep `number` and
     `name` as ordinary fields. Do not add a Tag field.
   - **Pumps:** add the "Display Name" field and mark it the identifier;
     keep `record_id` as an ordinary "Tag" field.
3. **Frontend.** Update the column builders so the pinned column is the
   Display Name field and "Tag" renders as an ordinary column; remove the
   hardcoded `?? "Tag"` / `?? "Record-ID"` identifier fallbacks
   (equipment `*Table.tsx`, `ThermalBridgesTable.tsx`, heat-pump
   `*-columns.tsx`). Ensure the duplicate-warning chip now keys on the
   Display Name. **Space-Types link target:** repoint the Rooms ->
   Space-Type picker / reverse-pill label resolution
   (`RoomsPage.tsx:147-151`, the `getRecordId`/`getDisplayName` callbacks)
   so the Display Name (`name`) is the primary label, then Tag
   (`record_id`), then row id - matching the new identity order.
4. **Migration (atomic).** Forward-fill `project_versions` and
   `project_version_drafts`:
   - **Generic tables:** set the `name` FieldDef `display_name` to
     "Display Name" and make it the identifier **only** where it is still
     the default "Name" (preserve user renames); drop the `record_id`
     identifier role and set its `display_name` to "Tag" only where it is
     still the default "Tag".
   - **Rooms:** set the `record_id` formula FieldDef `display_name` to
     "Display Name" only where it is still "Record-ID"; keep it as the
     identifier and keep its formula/deps untouched. Do not touch
     `number`/`name` except to ensure they remain ordinary fields.
   - **Pumps:** insert the new Display Name field def (empty values) as
     the identifier.
   - repoint persisted view-state identifier references if any are keyed
     to the old pinned column; confirm `sanitizeViewStateForSchema`
     round-trips the keys for both the generic and Rooms cases.
5. **Tests:**
   - the pinned column is the Display Name field, labeled "Display Name",
     on every table;
   - duplicate Display Names warn (chip) but never block;
   - "Tag" is an ordinary, non-unique field with no chip;
   - no generic table exposes a field labeled "Name" (Rooms keeps Number
     and Name as formula inputs);
   - user-renamed `name`/`record_id` labels are preserved by the
     migration;
   - Rooms' Display Name is the `{Number} - {Name}` formula and stays
     editable; Pumps gains an empty Display Name;
   - Space-Types' pinned column is the Display Name (`name`), renders a
     blank pinned cell without error for a Tag-only row, and the Rooms ->
     Space-Type picker labels options by Display Name first
     (update `RoomsPage` / Space-Types linked-record tests);
   - existing documents load and round-trip view state.

## Acceptance Criteria

- Every table's pinned identifier column is the Display Name field,
  labeled "Display Name"; the duplicate-warning chip keys on it.
- On the generic tables the short code is an ordinary, non-unique,
  unpinned "Tag" field, and no field is labeled "Name".
- Rooms' Display Name is the `{Number} - {Name}` formula (relabeled, kept
  as identifier, still editable), with Number and Name kept as input
  fields and no Tag field; Pumps has a Display Name field; all other
  tables preserve both fields' data.
- The migration preserves user-renamed labels and existing documents
  load; view state round-trips.
- Space-Types' pinned column is the Display Name; the Rooms ->
  Space-Type picker / reverse pills label options by Display Name first.
- Focused frontend and backend tests pass.

## Stop Conditions

- Stop if repointing the identifier off `record_id` cannot be done
  without renaming stable field_keys or breaking formula dependency ids;
  resolve the field-key strategy (keep `record_id`/`name` keys, move only
  the role) before writing migration code.
- Stop if the migration cannot distinguish a default label from a
  user-renamed one; only rewrite values still equal to the prior seed
  default for that table.
- Stop if relabeling the Rooms `record_id` formula field to
  "Display Name" disturbs its formula AST, deps, or the
  `roomsFormulaRegistry`; the relabel must be display-only, leaving the
  computed `{Number} - {Name}` value intact.

## File Entry Points

- `frontend/src/shared/ui/data-table/lib/identifier/recordId.ts`
- `frontend/src/shared/ui/data-table/components/GridBody.tsx`
- `frontend/src/shared/ui/data-table/lib/view/sanitize.ts`
- `backend/features/project_document/tables/*.py`
- `backend/migrations/` (or the project's Alembic migration path)
- `frontend/src/features/equipment/components/*Table.tsx`
- `frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx`
- `frontend/src/features/equipment/heat-pumps/*-columns.tsx`
- `frontend/src/features/equipment/routes/RoomsPage.tsx` (Space-Type
  picker / reverse-pill label resolution)
- `frontend/src/features/spaces/` (Space-Types table + tests)
- `backend/tests/test_project_document.py`
