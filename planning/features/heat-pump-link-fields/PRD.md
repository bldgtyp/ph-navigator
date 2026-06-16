---
DATE: 2026-06-16
TIME: 12:14 EDT
STATUS: Active - PRD drafted
AUTHOR: Codex
SCOPE: Product and technical contract for Heat Pumps native relationship
  fields that should render as links, not single-select vocabularies.
RELATED:
  - planning/features/heat-pump-link-fields/README.md
  - context/user-stories/30-tables-equipment.md
  - planning/archive/heat-pumps/PRD.md
  - planning/archive/heat-pumps/decisions.md
---

# Heat Pump Link Fields - PRD

## Problem

On Equipment -> Heat Pumps -> Units - Indoor, the `Equipment` and
`Outdoor unit` cells currently render with the single-select icon and
single-select interaction model. The displayed values are real record
references:

- `indoor_equip_id` references `heat_pumps.indoor_equip[*].id`.
- `outdoor_unit_id` references `heat_pumps.outdoor_units[*].id`.

The table already treats `Rooms` as a link because `served_room_ids`
uses the DataTable `linked_record` renderer and picker. The mismatch
makes the first two fields look like user-defined vocabulary fields
instead of project-record relationships.

## Product Contract

1. `Units - Indoor`.`Equipment` renders as a link field.
   - Target table: Heat Pumps -> Equipment - Indoor.
   - Cardinality: exactly one target row in valid persisted data.
   - Required: yes. New indoor units still need an indoor equipment row
     before creation.
2. `Units - Indoor`.`Outdoor unit` renders as a link field.
   - Target table: Heat Pumps -> Units - Outdoor.
   - Cardinality: zero or one target row.
   - Required: no. Empty cell means no outdoor unit assigned.
3. `Units - Indoor`.`Rooms` remains a link field.
   - Target table: Rooms.
   - Cardinality: zero to many target rows.
4. Link pills open the linked record in the appropriate local modal when
   possible.
   - Equipment pill opens the `Equipment - Indoor` row modal.
   - Outdoor unit pill opens the `Units - Outdoor` row modal.
   - Room pill keeps the current `LinkedRoomDialogHost` behavior.
5. Editing uses the linked-record picker visual language, not the
   single-select vocabulary picker.
6. The referenced side exposes incoming links.
   - `Equipment - Indoor` shows which indoor unit instances reference
     each equipment row.
   - `Units - Outdoor` shows which indoor unit instances reference each
     outdoor unit.
   - These columns are read-only relationship surfaces; unlinking from
     the reverse side is out of scope for v1 of this feature.
7. Existing backend referential-integrity behavior remains intact.
   - Deleting referenced indoor equipment remains blocked while indoor
     units reference it.
   - Deleting an outdoor unit still previews and cascade-nulls
     `outdoor_unit_id` on referencing indoor units.
   - Deleting rooms still filters `served_room_ids`.

## Architecture Decision

Use native Heat Pumps foreign-key fields as the storage source of truth,
and adapt them to link-field UI semantics at the DataTable boundary.

Rationale:

- The current persisted model already validates these relationships in
  `ProjectDocumentV1.validate_document_references()` and
  `features.heat_pumps.service._validate_slice()`.
- `indoor_equip_id` is required and scalar; `outdoor_unit_id` is nullable
  and scalar. Migrating them into generic `custom_links` would add a
  project-document migration and weaken typed model clarity.
- The generic inverse-link engine currently scans field-registry
  `linked_record` fields and reads ids from `custom_links`. Heat Pumps
  sub-tables are served by a feature-specific endpoint, not registered as
  generic table contracts, so using generic inverse links would require a
  larger table-contract refactor.

Implementation consequence:

- The frontend may expose native scalar ids as `linked_record` fields by
  returning arrays from column accessors (`[indoor_equip_id]`,
  `[outdoor_unit_id]` or `[]`) and converting committed arrays back to
  the typed row fields in `IndoorUnitsTable.handleWrite`.
- Reverse columns should be computed from the Heat Pumps slice response
  in the frontend, or returned as a Heat Pumps-specific overlay from the
  Heat Pumps endpoint. Phase 01 must choose one.

## Decision

**D1 - Reverse overlay location: client-computed.**

Resolved 2026-06-16: compute Heat Pumps reverse-link columns
client-side from the already-loaded slice. The Heat Pumps panel loads
all four Heat Pumps sub-tables together, so `indoor_units` can be
scanned without another API call.

Rejected alternative: add backend response fields such as
`inverse_links` / `inverse_link_fields` to `HeatPumpsReadResponse`.
This is more consistent with generic Rooms/Pumps inverse-link payloads
but increases API contract and test surface.

## Acceptance Criteria

1. In `Units - Indoor`, `Equipment`, `Outdoor unit`, and `Rooms` all use
   the link-field icon and linked-record pill styling.
2. Editing `Equipment` opens a single-link picker populated by
   `slice.indoor_equip` labels.
3. Editing `Outdoor unit` opens a single-link picker populated by
   `slice.outdoor_units` labels and permits clearing.
4. Editing `Rooms` keeps the existing multi-link room behavior.
5. Inline cell writes persist the same backend row shape:
   - `indoor_equip_id: string`
   - `outdoor_unit_id: string | null`
   - `served_room_ids: string[]`
6. `Equipment - Indoor` shows a read-only incoming-link column for
   indoor unit instances that reference the equipment row.
7. `Units - Outdoor` shows a read-only incoming-link column for indoor
   unit instances wired to each outdoor unit.
8. Clicking a link pill opens the linked row modal where the local table
   already has that modal.
9. Existing delete/cascade tests still pass.
10. Browser smoke confirms the starter project relationship display on
    `DEV-0001`:
    - `IU-1.1` links to indoor equipment `IE-A`.
    - `IU-1.1` links to outdoor unit `HP-1`.
    - `HP-1` shows incoming indoor units.
    - The indoor equipment row for `IE-A` shows incoming indoor units.

## Risks

- The DataTable `linked_record` commit path emits `string[]`, while the
  native fields are scalar. `handleWrite` must normalize exactly one id
  for required equipment and zero/one id for nullable outdoor unit.
- Clipboard/paste behavior for linked fields expects JSON lists. That is
  acceptable for this phase if documented, but tests should cover normal
  picker writes.
- The current DataTable linked-record picker has no built-in required
  single-link enforcement beyond `max_links`. The native backend will
  reject an empty `indoor_equip_id`; the frontend should prevent or
  surface that cleanly.
- Reverse-link columns added only in frontend will not be available to
  API consumers. That is acceptable if D1 chooses client-side overlays.
