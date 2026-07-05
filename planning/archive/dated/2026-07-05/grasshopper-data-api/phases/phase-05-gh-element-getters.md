# Phase 05 — GH Element Getter Components (honeybee_grasshopper_ph_plus)

```
DATE:    2026-07-05
TIME:    13:30
STATUS:  ⏸ DEFERRED — separate repo (honeybee_grasshopper_ph_plus), NOT
         started. Backend table route (03) is done & deployed; pick up here
         after Phase 04 using ../CLIENT_HANDOFF.md.
AUTHOR:  Claude (with Ed)
SCOPE:   New V2-only GH getter components for the 12 tabular element types;
         retire the AirTable download path for V2 projects. DIFFERENT REPO.
RELATED: ../PRD.md §6.3; ../research.md §5.2; phase-03 (payload contract),
         phase-04 (PHNavV2Client)
```

## Goal

Replace the AirTable per-element workflow: every element type on Ed's list
gets pulled from PH-Nav-V2 via `PHNavV2Client` + a thin builder component
that outputs honeybee-PH objects ready to connect to the model.

## Preconditions / read first

- Phase 03 (payload contract: `records` + `field_defs`, single-select
  id+label shape, cross-refs as ids) and Phase 04 (`PHNavV2Client`) done.
- The pattern being retired — study before designing:
  - Generic downloader:
    `honeybee_ph_plus_rhino/gh_compo_io/airtable/download_data.py`
    (`TableRecord` / `TableFields` dict-like access — the ergonomic bar).
  - The existing AirTable→HBPH **builder components** in that repo that
    consume `TableRecord`s to construct equipment/space objects — these
    define which honeybee-PH classes each element maps to and which fields
    Ed's GH definitions actually use. **Inventory them first**; the V2
    builders should be near-drop-in replacements at the output side.

## Requirements

### R1 — shared record layer

- A V2 `TableRecord`-equivalent (IronPython-2.7-safe) wrapping Phase-03
  `records`: dict-like case-insensitive `.get`/attr access like
  `TableFields`, plus access to resolved single-select labels and
  `custom_values`. One class, reused by every builder.
- Optionally ONE generic component ("HBPH+ PH-Nav Get Table") exposing
  (bt_number, table_name, version?, token?) → records, mirroring the
  AirTable component — useful for debugging and custom-field workflows
  even after typed builders exist.

### R2 — typed builder components (batched by domain)

Batches, each a separately releasable chunk:

1. **Spatial**: `rooms`, `space_types`, `thermal_bridges`.
2. **Ventilation & hydronics**: `ventilators`, `fans`, `pumps`.
3. **Hot water**: `hot_water_heaters`, `hot_water_tanks`.
4. **Heat pumps & loads**: `heat_pump_indoor_units` +
   `heat_pump_outdoor_units` (join on `outdoor_unit_id` client-side),
   `electric_heaters`, `appliances`.

Per component:

- Inputs: `_project_number` (bt_number), `_version_id_`, `_token_`,
  `_download` trigger — same UX as the switched Phase-04 components.
- Output: the honeybee-PH objects the retired AirTable builder produced
  for that element (exact target classes come from the R0 inventory —
  e.g. honeybee_phhvac ventilation/hot-water/heat-pump device classes,
  `honeybee_energy_ph` PhEquipment for appliances). **Field-by-field
  mapping table per element goes in this phase's implementation notes
  before coding each batch — reviewed with Ed** (he knows which AirTable
  columns his GH definitions consume).
- Unknown/missing fields degrade with `IGH.warning` + sensible default,
  never a hard crash mid-canvas (AirTable-component convention).

### R3 — retirement path

- AirTable components remain (V1-era projects still use them). Add a
  deprecation note to their descriptions pointing V2 projects at the new
  components. No removals this phase.

## Out of scope

Push components; assemblies/apertures (Phase 04 covers them); AirTable
component removal; new backend fields discovered missing during mapping
(file them back to ph-navigator-v2 STATUS.md as follow-ups — e.g. the
known MEP gaps: pipe/duct lengths from the MEP element-selection PRD).

## Testing / verification

- CPython unit tests per builder: fixture records (captured from a local
  Phase-03 backend) → expected HBPH object fields.
- Manual Rhino gate per batch (Ed): build the element in the V2 web app,
  pull in GH, connect to a model, export to WUFI-Passive/PHPP, confirm
  values land where the AirTable path put them.

## Acceptance gate

Per batch: CPython tests green + Ed's Rhino sign-off recorded in
STATUS.md. Feature complete when all four batches land and the AirTable
deprecation notes ship.

## Risks / notes

- **This phase's real work is the field-mapping tables**, not the code —
  V2 document fields vs what Ed's GH definitions consume via AirTable
  today. Missing fields surface here; budget time to route them back as
  backend follow-ups instead of inventing values client-side.
- Batches are independent — sequence by Ed's project needs; batch 1
  (spatial) likely first since rooms feed everything downstream.
- Multi-session by design; keep a per-batch ledger in this file or
  STATUS.md as batches land.
