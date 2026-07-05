# Phase 03 — Generic Tables Route (backend)

```
DATE:    2026-07-05
TIME:    13:30
STATUS:  ✅ Complete (implemented 2026-07-05; feature/gh-data-api)
AUTHOR:  Claude (with Ed)
SCOPE:   `GET /tables/{table_name}` serving the 12 tabular element types
         (rooms, space types, thermal bridges, and all equipment).
RELATED: ../PRD.md §4.2–§4.4; ../research.md §5.2 (table mapping)
```

## Goal

One generic, allowlisted route that replaces the AirTable download path for
every row-based element type. This is what the Phase-05 GH builder
components will consume.

## Preconditions / read first

- Phase 01 merged. (Independent of Phase 02 — can run in parallel with it.)
- `features/project_document/rows.py` — the table envelopes are Plan-31
  **mixed storage**: `{field_defs: list[TableFieldDef], rows: [...]}` where
  rows carry built-in typed fields plus a `custom_values` bag (see
  `RoomsTableEnvelope` docstring, rows.py:66).
- `features/project_document/document.py` — `single_select_options` keys
  (ROOM_FLOOR_LEVEL, PUMP_DEVICE_TYPE, FAN_TYPE, HOT_WATER_HEATER_TYPE,
  HOT_WATER_TANK_TYPE/_INSIDE_OUTSIDE, VENTILATOR_INSIDE_OUTSIDE,
  APPLIANCE_TYPE/_ENERGY_STAR, THERMAL_BRIDGE_TYPE, ROOM_BUILDING_ZONE).
- Plan-31 planning docs for the field_defs/custom_values contract
  (`planning/` — search "plan-31" / customizable fields; note the archived
  PRD review flags downstream consumers reading `room.floor_level`).
- Existing generic reads for precedent:
  `features/project_document/routes.py` `GET .../document/tables/{table_name}`.

## Requirements

### R1 — allowlist and mapping

External (GH-facing, stable) name → document path:

| external | document path |
| --- | --- |
| `rooms` | `tables.rooms` |
| `space_types` | `tables.space_types` |
| `thermal_bridges` | `tables.thermal_bridges` |
| `pumps` | `tables.equipment.pumps` |
| `fans` | `tables.equipment.fans` |
| `ventilators` | `tables.equipment.ervs` |
| `hot_water_heaters` | `tables.equipment.hot_water_heaters` |
| `hot_water_tanks` | `tables.equipment.hot_water_tanks` |
| `electric_heaters` | `tables.equipment.electric_heaters` |
| `appliances` | `tables.equipment.appliances` |
| `heat_pump_indoor_units` | `tables.equipment.heat_pumps.indoor_units` |
| `heat_pump_outdoor_units` | `tables.equipment.heat_pumps.outdoor_units` |

Unknown name → 422 whose detail lists the valid names. `assemblies`,
`apertures`, materials/glazings/frames are NOT exposed here (they're served
composed in Phase 02) — keep them off the allowlist.

### R2 — record serialization

Envelope (Phase 01) + two payload keys:

- `records: [...]` — one object per row: `id`, built-in typed fields
  serialized as-is (SI, suffix-named), and `custom_values` flattened or
  passed through per R3.
- `field_defs: [...]` — the table's field definitions passthrough, so the
  GH side can interpret custom fields without hardcoding.

Rules:

- **Single-select denormalization**: any field holding a single-select
  option id must emit `{"<field>": {"id": ..., "label": ...}}` (or
  sibling `<field>_label`) resolved from the document's
  `single_select_options`. Pick ONE shape, apply uniformly, document in the
  PRD (§4.4) when implemented — the GH builders key off it.
- **Cross-table references stay ids** (documented, not nested): e.g.
  `heat_pump_indoor_units` rows carry `outdoor_unit_id` (see
  `document_validation.py:263-293`); GH joins client-side if needed.
- **Asset references** (photos/datasheets on rows, e.g. segment
  `photo_asset_ids`): emit ids only, consistent with the Phase-02 asset
  decision.
- Computed/derived fields: if the web UI shows computed values the GH side
  will want (e.g. rooms airflow rollups — see recent "Rooms airflow fields"
  work), decide per-table whether to include; default is raw stored fields
  only, computed additions logged as follow-ups in STATUS.md. **Hard rule:
  any calculation lives backend-side** — never ship formulas for GH to
  evaluate.

### R3 — custom fields contract

Decide and document: flatten `custom_values` into the record object
(collision-checked against built-in names) vs pass the bag through as
`custom_values`. Recommendation: pass through as `custom_values` +
`field_defs` — lossless, collision-free, and the GH `TableFields`-style
accessor (see the retired AirTable component) handles dict access fine.
Record in `../decisions.md`.

## Out of scope

New computed fields; write routes; `single_select_options` as its own
table route (revisit only if GH builders need full option catalogs rather
than resolved labels).

## Testing

- Seeded synthetic fixture document with ≥1 row in **every** table
  (including both heat-pump slices and at least one custom field on one
  table, one single-select field populated, one indoor→outdoor unit link).
- Per-table test: 200, envelope, record count, id prefixes, single-select
  label resolution, custom_values passthrough, field_defs present.
- 422 unknown-table test (lists valid names); empty-table returns
  `records: []` (not 404).
- **CPython client-shape smoke**: consume every table the way the
  IronPython client will — one `json.loads`, dict-key access paths only,
  no assumptions the client can't make (no sets, no non-JSON types).
- `ty` clean; `make ci`.

## Acceptance gate

All 12 tables green on the fixture; client-shape smoke passes; `make ci`;
closeout gate per repo CLAUDEmd.

## Risks / notes

- Table envelopes evolve with Plan-31's frontend cascade (multi-session,
  in flight) — passthrough (`field_defs` + `custom_values`) is the shape
  most robust to that; avoid hand-flattening that Plan-31 will break.
- Row Pydantic models use `extra="forbid"` — serialize from the validated
  document model, not raw JSONB, so schema drift surfaces as errors here
  rather than silent payload changes.
