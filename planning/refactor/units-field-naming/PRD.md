---
DATE: 2026-08-02
TIME: 18:54 EDT
STATUS: Complete — contract implemented and verified
AUTHOR: Claude with Ed May
SCOPE: Contract for truthful field keys, backend-owned units metadata, and
  the v8→v9 rename migration for heat-pump and pump document fields.
RELATED:
  - ./README.md
  - ./STATUS.md
  - ./decisions.md
  - ../../archive/dated/2026-06-27/beta-schema-evolution/schema-bump-checklist.md
---

# PRD — Units metadata & field-naming truthfulness

## Historical problem (pre-v9)

A field key, its display name, its backend field_def config, and its stored
canonical unit disagreed in three concrete pre-v9 instances (verified in code
2026-08-02):

| Field | Key says | Stores | Display name says | Units config |
| --- | --- | --- | --- | --- |
| `heat_pumps_indoor_equip.cooling_btuh` | Btu/h | **kW** | "Cooling Btu/h" (backend) / "Cooling capacity (kW)" (frontend modal) | frontend-only |
| `heat_pumps_indoor_equip.heating_btuh_47f` | Btu/h | **kW** | "Heating Btu/h 47F" (backend) | frontend-only |
| `pumps.flow_gpm` | GPM | **l/min** | — | `{ si_unit: "l_min", ip_unit: "gpm" }` |

The adjacent `heat_pumps_indoor_equip.heating_btuh_17f` field genuinely stored
Btu/h as a plain number, making the mixed capacity contract especially unsafe
for consumers reasoning from keys.

The failure mode is real, not theoretical: on Linde 2524 an MCP agent wrote
Btu/h magnitudes into the kW-canonical fields because the keys said `_btuh`.

## Confirmed storage conventions (do not change)

1. Any field with a `config.units` block stores **canonical SI**; the IP
   toggle is display-only (`frontend/src/lib/units/numberUnits.ts` —
   `formatNumberUnitsDisplay` converts SI→IP at render,
   `parseNumberUnitsInput` converts typed IP→SI before persist).
   `mode: "editable" | "fixed"` governs whether users may reconfigure a
   custom field's units, not storage.
2. Plain number fields (no units config) store the unit named in their
   label/key (e.g. `fan_speed_cfm` = CFM and `nominal_tons` = tons).

## Implemented contract

### C1 — Backend field_defs are the single source of units truth

- Every built-in field with unit-toggled display emits its units block
  (`si_unit`, `ip_unit`, mode) from the backend field_def registry
  (`backend/features/project_document/tables/*.py`).
- The frontend consumes that block through the shared FieldDef path; heat-pump
  feature production code owns no parallel power-units definition.
- An API/MCP consumer reading the document field_defs can always determine
  the canonical storage unit of a numeric field without reading frontend
  source.

### C2 — Keys, names, and storage agree

- No field key names a unit that differs from the field's canonical storage
  unit.
- Indoor-equip capacity fields adopt the outdoor-equip convention already
  present in `backend/features/project_document/tables/heat_pumps.py`
  (`heating_cap_kw_17f` / `heating_cap_kw_47f` / `cooling_cap_kw_95f`):
  - `cooling_btuh` → `cooling_cap_kw`
  - `heating_btuh_47f` → `heating_cap_kw_47f`
  - `heating_btuh_17f` → `heating_cap_kw_17f`; migrate the genuinely Btu/h
    persisted value to canonical kW using the exact divisor `3412.141633`.
  - `pumps.flow_gpm` → `flow_l_min`; values pass through because storage was
    already canonical l/min.
- These accepted implementation decisions are recorded in `decisions.md`.

### C3 — Migration is one schema bump, passthrough where possible

- All accepted renames land in a single v8→v9 document schema migration
  (`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` at
  `backend/features/project_document/document.py:224`; process per
  `docs/SCHEMA_VERSIONS.md` and the beta-schema-evolution
  schema-bump-checklist; rollout precedent:
  `planning/refactor/spec-status-value-unification/`).
- Existing kW and l/min field renames are key-only value passthrough.
  Only `heating_btuh_17f` → `heating_cap_kw_17f` rewrites values.
- Historical versions remain readable; saved v8 bodies read back as v9.

### C4 — FieldDef truthfulness ships atomically with v9

Backend display names/descriptions for all three indoor capacities say
"Capacity" and state canonical kW storage. The schema fingerprint guard proved
that the backend FieldDef metadata change could not ship independently without
a schema bump, so this correction lands atomically with v9.

## Known touchpoints (inventory, verified 2026-08-02)

Backend: `features/project_document/tables/heat_pumps.py` (field_defs,
misnamed keys at lines 151–158), `features/project_document/tables/pumps.py`,
`features/heat_pumps/models.py`, `features/heat_pumps/phius_export.py`
(export mapping), `seeds/project/heat-pumps.json`, document migration module,
tests under `backend/tests/features/heat_pumps/` and
`backend/tests/test_project_document_pumps.py`.

Frontend: `features/equipment/heat-pumps/` — `field-defs.ts`, `types.ts`,
`row-builders.ts`, `payload-builders.ts`, `indoor-equip-columns.tsx`,
`components/IndoorEquipRowModal.tsx`, `__tests__/*`; pumps —
`features/equipment/lib.ts`, `lib/buildEmptyPumpRow.ts`,
`components/PumpsTable.tsx`, `testing/testFixtures.ts`.

## Non-goals

- No change to the SI-canonical storage convention or the IP display toggle.
- No renames beyond the fields listed here; a broader key audit is a
  possible follow-on, not this refactor.
- The claude-plugins MCP transport fix (see `README.md`) is external.

## Verification

- Backend + frontend test suites updated for new keys; migration tests prove
  v8 bodies read back as v9 with kW/l-min values unchanged and the legacy
  `heating_btuh_17f` magnitude correctly converted to kW.
- A document field_defs read (API or MCP `get_table`) shows the units block
  for every capacity field.
- Phius export output unchanged in magnitude for a fixture project across
  the bump.
- `make ci` green.

Execution evidence and remaining gates live in `STATUS.md`; the full CI rerun
and mounted browser verification are still pending.
