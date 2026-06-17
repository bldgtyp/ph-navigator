---
DATE: 2026-06-16
TIME: 16:35 EDT
STATUS: Active - planning complete, awaiting implementation
AUTHOR: Ed (via Claude)
SCOPE: Identity contract for project DataTables - hidden unique key, a
  single non-unique "Display Name" label (the descriptive name) as the
  pinned identifier, and "Tag" as an ordinary field.
RELATED:
  - planning/refactor/record-identity-model/README.md
  - planning/refactor/record-identity-model/PLAN.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md
---

# Record Identity Model - PRD

## Problem

The DataTables grew two competing human labels per row and labeled them
inconsistently, and one table over-constrains the user's handle:

- Every row already has a hidden machine identity, `row.id`
  (`rm_/pmp_/rec_…`), that owns linked-record targets and `custom_links`.
  Users never see it. But its uniqueness guard (`validate_unique_ids`,
  `backend/features/project_document/_validators.py:62`) is only applied
  to space-types, assembly segments, layers, and the heat-pump tables -
  not to Rooms, the 7 equipment tables, or Thermal Bridges. So the
  guarantee the rest of the model leans on is only partially enforced.
- The pinned column is the `record_id` field - a free-text label, not a
  key. It is intentionally non-unique (duplicates render a non-blocking
  warning chip,
  `frontend/src/shared/ui/data-table/lib/identifier/recordId.ts`). It is
  labeled **"Tag"** on eight tables and is a `{Number} — {Name}` formula
  labeled **"Record-ID"** on Rooms
  (`backend/features/project_document/tables/rooms.py:85,120`).
- Separately, **nine** tables also seed a `name` field labeled **"Name"**
  (`tables/*.py`, `field_key="name"`; Pumps is the exception). "Name" is
  ambiguous, and having both a pinned "Tag" and a "Name" gives each row
  two competing labels.
- **Two** tables **hard-block** a duplicate user-facing handle today:
  - Heat Pumps ("Duplicate tag within table",
    `backend/features/heat_pumps/service.py:225`).
  - Space-Types - the table the 2026-06-16 spaces-refactor added - rejects
    a duplicate Tag (trim/case-normalized) and rejects a row that has a
    Name but no Tag (`backend/features/project_document/document.py:333`
    and `:332`). Space-Types currently seeds `record_id` as the pinned
    **"Tag"** primary identifier and `name` as an optional **"Name"** -
    the inverse of the equipment tables, where the descriptive `name` is
    the natural handle.

## Identity Contract (target)

Three clearly separated layers, applied uniformly. This is the Honeybee
model: HB `identifier` maps to our hidden `row.id`; HB `display_name`
(the human name) maps to our Display Name column.

| Layer | Backing field (stable key) | Unique? | User-visible? | Owns |
|---|---|---|---|---|
| Hidden key | `row.id` | **Yes**, enforced on every table | No | Identity, linked-record targets, `custom_links`, formula deps |
| **Display Name** | the descriptive name field (`name`) | **No**, never constrained | Yes - pinned identifier column | Nothing structural; the readable handle, carries the duplicate-warning chip |
| **Tag** | the former identifier (`record_id`) | No | Yes - ordinary column | Nothing structural; a normal code field |

Rules:

- The hidden `row.id` is the only enforced-unique identity, guaranteed on
  every table by a universal `validate_unique_ids` call.
- The pinned user-facing column is the **Display Name** (the descriptive
  name) on every table. It is never unique-constrained; duplicate values
  render the existing non-blocking warning chip. Empty / whitespace
  values never warn.
- No table hard-blocks a duplicate Display Name. Heat Pumps drops its
  per-table label-uniqueness enforcement.
- **Tag** is an ordinary, editable, non-unique field. No "Name" label
  remains on any table.
- Stable field_keys (`name`, `record_id`) do not change. Only the
  identifier *role*, the `display_name` labels, and the hidden-id guard
  change.

### Per-Table Specifics

- **8 tables** (appliances, electric_heaters, fans, hot_water_heaters,
  hot_water_tanks, ventilators, thermal_bridges, space_types): `name` ->
  Display Name (pinned); `record_id` keeps its "Tag" label but is
  unpinned and ordinary. Both fields' data is preserved. "Name" is
  retired as a label.
- **Space-Types** (one of the 8, but it carries removable backend
  enforcement, unlike the equipment tables): in addition to the generic
  flip, Phase 00 **removes both of its hard blocks** - the duplicate-Tag
  rejection and the "named row requires a Tag" rejection
  (`document.py:332-334`) - so `record_id`/Tag becomes a fully ordinary,
  non-unique field. Decided 2026-06-16: Space-Types follows the generic
  rule (`name` -> Display Name) and keeps **no** hard uniqueness block;
  duplicates use the warning chip like every other table. Two
  consequences to handle: (a) Space-Types' `name` is optional today, so a
  Tag-only row shows a **blank** pinned Display Name until a Name is typed
  - acceptable, since empty/whitespace Display Names never warn; (b)
  Space-Types is a **link target** - the Rooms -> Space-Type picker and
  reverse pills currently prefer Tag then Name
  (`frontend/src/features/equipment/routes/RoomsPage.tsx:147-151`); that
  label resolution must follow the new Display Name (`name`) first.
- **Rooms** (the formula case): the existing `record_id` **formula**
  field (`{Number} - {Name}`) stays the pinned identifier; only relabel
  it "Record-ID" -> "Display Name". `number` and `name` remain ordinary
  input fields that feed the formula, so on Rooms "Name" legitimately
  remains (it is a genuine distinct attribute, not a second label).
  No identifier repoint and no separate Tag field on Rooms. The Display
  Name stays editable: the user can change the formula or convert the
  field to plain text (the affordance already exists today).
- **Pumps** (no `name` field today): add a Display Name field (pinned,
  empty default); `record_id` "Tag" -> unpinned ordinary Tag.

The formula-identifier capability is a field type, so any table may later
opt its Display Name into a formula; only Rooms ships that way by default
because `{Number} - {Name}` is the common room-labeling case.

## Honeybee / Forward Compatibility

Display Name gives a clean 1:1 mapping for the eventual honeybee-ph
round-trip: hidden `row.id` -> HB `identifier`; Display Name -> HB
`display_name`. This PRD chooses names that will not have to be re-mapped
later; it does not implement that wiring.

## Migration Reality

Built-in FieldDefs - including `display_name` and the pinned-identifier
role - are **persisted** in each saved document (`read_field_defs`
returns `envelope.field_defs`,
`backend/features/project_document/tables/_registry_helpers.py:71-73`).
Only the `locked` arrays are a render-time overlay
(`backend/features/project_document/custom_fields.py:196`). Therefore the
swap is **not** a pure code change:

- The table seeds (`tables/*.py`) set the labels and roles for newly
  created documents/tables.
- A **migration** must, for existing `project_versions` and
  `project_version_drafts`: relabel `name` -> "Display Name" and make it
  the identifier; unpin `record_id` and relabel it "Tag"; add the Pumps
  Display Name field; handle the Rooms formula. It rides on top of the
  spaces-refactor schema version (now **v7**, after that work added
  `space_types` and the Rooms `space_type_id` link); see open question 4.
- Built-in `display_name` is user-editable (built-ins default-lock only
  `["delete", "duplicate"]`), so the relabels must be **conditional**:
  only rewrite values still equal to the prior defaults ("Name", "Tag",
  "Record-ID"); never overwrite a user-renamed label.

## Non-Goals

- No change to the DataTable interaction model, the warning-chip UX, or
  the linked-record system beyond what the swap requires.
- No change to `row.id` minting or to stable field_keys.
- No new uniqueness constraint on any user-facing field.
- No honeybee-ph export wiring in this refactor.

## Acceptance Criteria

1. `validate_unique_ids` (or equivalent) guards `row.id` uniqueness on
   every project DataTable.
2. No table hard-blocks a duplicate user-facing label; both Heat Pumps'
   "Duplicate tag within table" enforcement and Space-Types' duplicate-Tag
   + "named row requires a Tag" enforcement are removed.
3. The pinned identifier column is the **Display Name** (the descriptive
   name) on every table; the duplicate-warning chip keys on it.
4. **Tag** is an ordinary, editable, non-unique, unpinned field on every
   table; no field is labeled **Name**.
5. Rooms' Display Name is the existing `{Number} - {Name}` formula field
   (relabeled, still editable), with Number and Name kept as input
   fields and no Tag field; Pumps has a Display Name field; the other
   tables preserve both fields' data.
5a. Space-Types follows the generic flip with no residual hard block, and
   the Rooms -> Space-Type picker / reverse-link pills label options by the
   Display Name (`name`) first, then Tag, then row id.
6. A conditional migration performs the swap on existing documents
   without overwriting user-renamed labels; existing documents load and
   view state round-trips.
7. The identifier role is repointed off the hardcoded `record_id` without
   renaming stable field_keys or breaking formula dependency ids.
8. `context/technical-requirements/data-table.md` and `data-model.md`
   document the model (hidden key, Display Name identifier, Tag, retired
   "Name", universal guard). `CODING_STANDARDS.md` notes the convention.
9. The data-table-consolidation refactor's identifier-column helper and
   uniqueness reconciliation reference this model as their baseline.
10. `make format` and `make ci` pass; `graphify update .` is run.

## Open Questions For Implementation

1. **Field-key / role strategy.** Repoint the identifier role to the
   `name` field while keeping stable field_keys (recommended), versus any
   alternative. Confirm the shared identifier system
   (`recordId.ts`, `GridBody` pinning, `sanitizeViewStateForSchema`)
   cleanly follows the table-declared identifier field.
2. **Rooms formula - DECIDED.** Rooms' Display Name is the existing
   `{Number} - {Name}` formula field, relabeled from "Record-ID" to
   "Display Name" and left as the pinned identifier; no separate Tag
   field. Number and Name remain as input fields. Implementation only
   needs to confirm the formula deps and registry survive the relabel.
3. **Pumps Display Name.** Confirm Pumps truly lacks a `name` field and
   seed a new empty Display Name; confirm no other table is missing it.
4. **Schema-version bump.** Does the swap warrant a `schema_version` bump
   or can it ride as a non-breaking migration? Decide against the
   existing versioning policy.
5. **Heat Pumps interim.** Heat Pumps fully inherits the warning-chip
   behavior only once it joins the shared grid (consolidation Phase 05).
   This refactor removes HP's backend hard block now; confirm the HP UI
   still reads acceptably in the interim.
6. **Space-Types - DECIDED (2026-06-16).** Space-Types follows the generic
   rule: `name` -> pinned Display Name, `record_id` -> ordinary Tag, and
   **both** of its hard blocks are dropped (warning chip only). Open
   implementation items: (a) confirm an empty pinned Display Name renders
   sensibly for Tag-only rows; (b) repoint the Rooms -> Space-Type picker /
   reverse-pill label resolution (`RoomsPage.tsx:147-151`) to prefer the
   Display Name; (c) confirm the spaces-refactor still has unverified
   closeout (its Phase 05) - coordinate sequencing so this refactor does
   not land on top of unverified space_types work.
