---
DATE: 2026-08-03
TIME: 09:10 EDT
STATUS: Not started
AUTHOR: Claude with Ed May
SCOPE: Make iter_rows_for_raw_tables read {field_defs, rows} envelopes for
  thermal_bridges and the four heat-pump sub-tables.
RELATED:
  - ../PRD.md
  - ../research.md
  - ./phase-00-production-inventory.md
  - ./phase-03-reachability-guard.md
---

# Phase 01 — Fix the row walker

## Goal

Every table key in `ATTACHMENT_FIELDS` walks its actual rows, so all 30
registered attachment fields are reachable by `list_asset_references`.

## Depends on

Phase 00 complete and signed off. This phase switches on write validation for
previously unvalidated references (PRD §6).

## The defect

`iter_rows_for_raw_tables` (`backend/features/assets/registry.py:281-305`) uses
`_dict_rows` — a bare-list reader that returns `[]` for a dict — on
`thermal_bridges` and the four `HEAT_PUMP_ATTACHMENT_TABLE_KEYS`. Those five
tables are `{field_defs, rows}` envelopes. The seven
`EQUIPMENT_ATTACHMENT_TABLE_KEYS` correctly use `attachment_table_rows`, which
unwraps the envelope. Evidence in [research.md §1–2](../research.md).

## The change

`attachment_table_rows` is a strict superset of `_dict_rows`: it unwraps
`{"rows": [...]}` and otherwise falls through to the same list handling. So do
not special-case the five broken tables — **use `attachment_table_rows` for
every branch**. A table that later gains `field_defs` then cannot silently
disappear.

In `backend/features/assets/registry.py`:

```python
def iter_rows_for_raw_tables(tables: dict[str, Any], table_key: str) -> list[dict[str, Any]]:
    if table_key in ("project_materials", "project_glazings", "project_frames", "thermal_bridges"):
        return attachment_table_rows(tables.get(table_key))
    if equipment_key := EQUIPMENT_ATTACHMENT_TABLE_KEYS.get(table_key):
        return attachment_table_rows(tables.get("equipment", {}).get(equipment_key))
    if heat_pump_key := HEAT_PUMP_ATTACHMENT_TABLE_KEYS.get(table_key):
        return attachment_table_rows(
            tables.get("equipment", {}).get("heat_pumps", {}).get(heat_pump_key)
        )
    if table_key == "assembly_segments":
        ...  # unchanged nested traversal
    return []
```

Collapsing the four identical single-key branches is the simplification the
`simplify` skill would ask for anyway; make it part of the fix, not a follow-up.

Leave `_dict_rows` in place — the `assembly_segments` traversal still uses it
for genuinely bare nested lists.

Add a short comment above the function stating the invariant: *every branch must
tolerate both a bare list and a `{field_defs, rows}` envelope, because tables
migrate between those shapes as they gain FieldDefs.* That sentence is the whole
lesson of this bug.

## Do not change

- The anonymous gate itself. Reachability is the fix; the policy stays.
- `attachment_table_rows`, `_dict_rows`, or `list_asset_references` semantics.
- `find_row` in `downloads.py` — it delegates to this walker and is fixed by
  the same change (verify with a test rather than editing it).

## Tests

In `backend/tests/test_assets_registry.py`:

1. `iter_rows_for_raw_tables` returns the row for a populated
   `{field_defs, rows}` envelope, parameterized over `thermal_bridges` and all
   four heat-pump table keys.
2. It still returns rows for a bare list (`project_materials`) and for the
   equipment envelope tables — no regression.

In `backend/tests/test_assets_service.py`:

3. Anonymous `GET /assets`, `GET /assets/{id}`, `GET /assets/{id}/url`, and
   `GET /assets/{id}/download` all succeed for an asset referenced **only** from
   `thermal_bridges.datasheet_asset_ids`, and again for a heat-pump table.
4. **Negative, non-negotiable:** an asset referenced from nothing is still 404
   for anonymous `GET /assets/{id}` and 403 `asset_not_referenced` for
   `/url`. The gate must be proven un-widened.

New or extended:

5. Orphan sweeper — an asset referenced only from `thermal_bridges` or a
   heat-pump table is **not** a GC candidate (`sweep_orphaned_assets(dry_run=True)`
   returns it in neither `moved` nor the candidate set).
6. `POST /assets/{id}/attach` and `/detach` succeed for
   `table_key="thermal_bridges"` and for a heat-pump table key — they currently
   404 `document_row_not_found`.
7. Bulk download over `table_key="thermal_bridges"` produces a zip instead of
   `ValueError("No matching assets.")`.
8. Write validation now fires: saving a Thermal Bridges table whose
   `datasheet_asset_ids` names a nonexistent asset returns 422
   `asset_not_found`. This is the behavior change Phase 00 de-risked — pin it.

## Verification

- `make ci` green.
- Re-run the [research.md §6](../research.md) probe: expect
  `30/30 registered fields reachable`.
- Local browser check, signed out, per `context/USING_A_WEB_BROWSER.md`:
  Thermal Bridges datasheet/photo attachments resolve. The **PDF Report** column
  still will not — that is Phase 02, and is the expected intermediate state.

## Risks

- **Write validation activates.** Mitigated by Phase 00. If the inventory found
  violations, they must be remediated or the registry relaxed before this
  merges.
- **Bulk download starts including these tables** — desirable, but it is a
  behavior change worth a line in the PR description.

## Done when

- All 30 registered fields are reachable, proven by the Phase 03 guard.
- Tests 1–8 pass; test 4 in particular.
- `make ci` green.
