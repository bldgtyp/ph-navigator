---
DATE: 2026-05-26
TIME: 16:00 ET
SOURCE-PLAN: planning/archive/dated/2026-05-26/complete/plan-20-pumps-table-reuse-test.md
SOURCE-REVIEW: planning/code-reviews/2026-05-25/data-table-reusability-review.md
---

# Pumps table reuse implementation log

## Reuse notes

- The local branch had already extracted the P2-style `useSliceTableController`
  and `SliceTableShell`, so Pumps used that controller directly instead of
  cloning the older `EquipmentTab.handleTableWrite` shape from the plan.
- The current Equipment page had been converted to attachment panels and
  `EquipmentTab.tsx` was deleted. Pumps was wired into the newer
  `EquipmentPage.tsx` route rather than restoring the deleted file.
- A separate attachment contract named `equipment_pumps` already targets the
  same document path as the new `pumps` table contract:
  `tables.equipment.pumps`. To keep the later attachment test path open, the
  typed `PumpRow` includes `datasheet_asset_ids: list[str]` even though that
  field is not shown in the Pumps DataTable.

## Friction and edge cases

- Two table keys now intentionally point at the same JSON path:
  `pumps` for the fixed-column equipment schedule and `equipment_pumps` for
  the attachment-field overlay. This works, but it is a concept worth making
  explicit before repeating for ERVs/Fans.
- The shared controller currently requires a schema-mutation mutation object
  even for tables with no custom fields. Pumps passes the generated mutation
  hook but does not expose custom-field props, so the endpoint should not be
  called. A later cleanup could make `schemaMutation` optional.
- The DataTable footer accepts arbitrary JSX but does not expose its internal
  row-insert helper. The Pumps "Add pump" button has to synthesize a
  `rowInsert` `WriteOp` itself.
- The plan expected `device_type` as the first/frozen column, but the resolved
  recommendation was to freeze the natural schedule identifier. The UI renders
  `Tag` first and `Device Type` second.
