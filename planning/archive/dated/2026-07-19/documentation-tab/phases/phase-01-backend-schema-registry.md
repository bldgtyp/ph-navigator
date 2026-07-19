---
DATE: 2026-07-18
TIME: 17:37
STATUS: Done (implemented + backend-verified 2026-07-18)
AUTHOR: Ed May (with Claude)
SCOPE: Backend document schema + attachment registry for photos, waivers, and the spec-status rename
RELATED: ../PRD.md §D3/§D5, ../research.md, backend/features/assets/registry.py
---

# Phase 01 — Backend: schema + registry

## Goal

Every in-scope record family can carry site photos and per-axis waivers in
the versioned document; the attachment registry authorizes the new photo
fields; the equipment status column reads "Specification Status".

## In-scope families

Equipment ×8 tables (ventilators/ervs, pumps, fans, hot_water_heaters,
hot_water_tanks, electric_heaters, appliances) + heat pumps ×4 leaves,
apertures (project_frames, project_glazings), thermal_bridges, and the
envelope waiver fields (materials + segments). Envelope photos already
exist (`assembly_segments.photo_asset_ids`) — do not re-model them.

## Work

1. **`photo_asset_ids: list[str] = []`** on each equipment/heat-pump/
   aperture/thermal-bridge row model + a `photo_asset_ids` built-in
   FieldDef per table contract. Extract a shared
   `datasheet_field_def()` / `photo_field_def()` helper module alongside
   `_status_field.py` instead of hand-copying 15× (the datasheet def is
   currently duplicated per table — consolidate it in the same pass ONLY
   if the diff stays mechanical; otherwise leave datasheet defs alone).
2. **Waiver fields** (defaults `False`):
   - Equipment/HP/apertures/TB rows: `photo_not_required: bool`,
     `datasheet_not_required: bool`.
   - `ProjectMaterial`: `datasheet_not_required: bool`.
   - Photo waiver for envelope: per material×assembly. Store on
     `AssemblySegment` as `photo_not_required: bool`, written with the
     same use-site fan-out as `photo_asset_ids` (one UI toggle → all of
     that material's segments in that assembly). This mirrors photo
     storage exactly and avoids a new keyed structure.
   - **Implementer check (do first):** confirm row-model fields that have
     no FieldDef survive the generic table read/write/validation path
     (`read_table_envelope`, row (de)serialization, MCP `get_table`). If
     the path only tolerates registered fields, register the waiver fields
     as built-in FieldDefs and suppress them from DataTable column
     generation instead — record which way it went in STATUS.
3. **Registry:** add an `AttachmentFieldConfig` per new `photo_asset_ids`
   field in `backend/features/assets/registry.py` — `asset_kinds=
   {"site_photo"}`, png/jpeg/webp (+HEIC in Phase 02), max_count 10,
   25 MB (mirror `assembly_segments` entry). Equipment/HP table-key
   routing already exists; add frames/glazings/thermal_bridges routing if
   `iter_rows_for_raw_tables` lacks it.
4. **Rename:** equipment + thermal-bridges status FieldDef `display_name`
   → `"Specification Status"` (`_status_field.py`). **Keep `field_key=
   "status"`** — display-only rename, no data migration, no
   `single_select_options` key changes. Grep frontend for hardcoded
   "Status" column-label expectations (tests, table configs).
5. **Document schema migration:** all new fields carry defaults so
   existing saved versions/drafts validate unchanged. Follow the settled
   schema-migration mechanism; bump whatever schema-version marker it
   prescribes.

## Out of scope

HEIC (Phase 02), summary endpoints (Phase 02), any frontend.

## Verification

- ✅ `uv run pytest` — new unit tests: row models default correctly; registry
  accepts `site_photo` attach on each new field and rejects wrong
  kind/MIME/oversize/over-count; `list_asset_references` sees photo refs
  on every new family (GC safety).
- ⏭ Round-trip: attach + detach a photo on one equipment row and one frame
  row via the REST attach/detach endpoints against a dev DB; Save; confirm
  the saved version carries the ref and the asset survives orphan-sweep logic.
  Deferred to Phase 03/05 browser verification because this phase intentionally
  has no frontend upload column yet.
- ✅ Old fixture document (pre-change) loads without validation errors.
- ✅ `make check-backend` green (1413 passed, 7 skipped).

## Implementation Notes

- Schema version bumped to v6 with `_upgrade_v5_to_v6`; committed fixture
  snapshots and `schema_fingerprint.json` were regenerated through the
  supported upgrade audit path.
- Waiver fields (`datasheet_not_required`, `photo_not_required`) are typed
  Pydantic fields with default `False`, not built-in DataTable FieldDefs.
  That keeps them available for the Documentation page while preventing
  automatic DataTable column generation.
- Pumps preserve the existing datasheet contract: `datasheet_asset_ids`
  remains a typed attachment column outside the FieldDef list; only
  `photo_asset_ids` joins the Pumps FieldDef list in this phase.
