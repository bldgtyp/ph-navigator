---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: High-risk linked-record regression coverage.
RELATED:
  - planning/archive/data-table-regression-suite/PLAN.md
  - frontend/src/shared/ui/data-table/fields/linkedRecord/Picker.tsx
  - frontend/tests/e2e/table-regression/tableHelpers.ts
  - frontend/tests/e2e/record-linking-rooms-pumps.spec.ts
---

# Phase 05 - Deep Linked-Record Flows

> Split note: the original "Phase 05 - Deep links and view state" was divided
> into Phase 05 (linked-record flows, this file) and Phase 06 (table-view-state
> persistence), with run policy moving to Phase 07. The two surfaces are large
> and independent, so each is its own verifiable phase. See `STATUS.md`.

## Goal

Cover the linked-record graphs most likely to regress after shared DataTable
changes: the source link commits the expected ids, and the inverse column on
the target table reflects the link after persistence/reload.

## Planned Linked-Record Flows

1. Rooms -> Space Types (`space_type_id`), then verify the Space Types inverse
   "Rooms <- Space Type" column.
2. Rooms -> Pumps — **already covered** by
   `frontend/tests/e2e/record-linking-rooms-pumps.spec.ts` (a PRD non-goal is
   "no replacement of existing Rooms/Pumps coverage"). Not re-implemented;
   referenced here for completeness.
3. Heat Pump Units Indoor -> Indoor Equipment (`indoor_equip_id`).
4. Heat Pump Units Indoor -> Outdoor Unit (`outdoor_unit_id`).
5. Heat Pump Units Indoor -> served Rooms (`served_room_ids`, grid-only
   multi-link).
6. Heat Pump Equipment Outdoor -> paired Indoor Equipment
   (`paired_indoor_equip_id`).

Flows 3-5 also seed the two heat-pump **unit** leaves deferred from Phase 04
(their add dialog requires an equipment pick to submit), so this phase owns
their deterministic target seeding.

## Harness Notes

- Generic grid linked-record picker: a `dialog` named `Link <Field>` with a
  `Search records` box, a `Link <value>` checkbox/row per candidate, and a
  `Confirm` button (see `record-linking-rooms-pumps.spec.ts` and
  `fields/linkedRecord/Picker.tsx`).
- Heat-pump unit add dialogs create their required links through
  `ModalLinkedRecordField` (a combobox in the add modal), not the grid picker.
- Prove links beyond DOM pills by reading the draft payload
  (`custom_links[fieldKey]` for custom links; typed columns for built-ins) via
  `findDraftRow` + a links-aware reader.

## Verification

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-links
```

## Outcome (implemented)

`table-linked-records.spec.ts` (tagged `@table-links`) — **3 tests, ~17s,
green** against the local stack; the full `tests/e2e/table-regression`
directory is 46/46. `beforeAll` seeds one row per target table (space type,
room, indoor equip, outdoor equip, outdoor unit), which is what makes "link
the first candidate" deterministic. Tests:

1. **Rooms -> Space Types** — grid picker links the room's `space_type_id`;
   payload asserts the stored id; the Space Types "Rooms <- Space Type"
   inverse column shows a pill on the linked row.
2. **HP Equipment Outdoor -> paired Indoor Equipment** — grid picker
   (`max_links` 1); payload asserts `paired_indoor_equip_id`.
3. **HP Units Indoor** — add dialog links `indoor_equip_id` (required) and
   `outdoor_unit_id` via `ModalLinkedRecordField`, then the grid picker
   multi-links `served_room_ids`; payload asserts all three. This also seeds
   the two HP unit leaves deferred from Phase 04.

### Notes / lessons

- Linked records persist **differently per table family** (verified live):
  generic-slice tables (e.g. Rooms `space_type_id`) store links in the
  **`custom_links`** bag, while the **heat-pump leaf row models store links
  as typed top-level columns** (a scalar id for single links like
  `paired_indoor_equip_id`, an array for multi like `served_room_ids`). So
  the payload reader (`readRowLinkIds`) must handle `custom_links`, the typed
  column `row[fieldKey]`, and the legacy `custom_values` array, normalizing a
  scalar single-link to a one-element list.
- The inverse pill's label is the source row's **display name**, not its row
  id, so the inverse assertion checks that a pill exists in the inverse cell
  (located by the target row's Tag + header) rather than matching its text.
- Seeding exactly one target row per table removes the need to match picker
  candidate labels (which vary per table); correctness is proven by the
  draft payload, not the picker label.
