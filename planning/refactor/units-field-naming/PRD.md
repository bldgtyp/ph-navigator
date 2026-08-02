---
DATE: 2026-08-02
TIME: 12:00 EDT
STATUS: Active — contract drafted from verified code inventory, not yet implemented
AUTHOR: Claude with Ed May
SCOPE: Contract for truthful field keys, backend-owned units metadata, and
  the v8→v9 rename migration for heat-pump and pump document fields.
RELATED:
  - ./README.md
  - ./STATUS.md
  - ../../archive/dated/2026-06-27/beta-schema-evolution/schema-bump-checklist.md
---

# PRD — Units metadata & field-naming truthfulness

## Problem

A field key, its display name, its backend field_def config, and its stored
canonical unit can currently disagree. Three concrete instances (all verified
in code 2026-08-02):

| Field | Key says | Stores | Display name says | Units config |
| --- | --- | --- | --- | --- |
| `heat_pumps_indoor_equip.cooling_btuh` | Btu/h | **kW** | "Cooling Btu/h" (backend) / "Cooling capacity (kW)" (frontend modal) | frontend-only |
| `heat_pumps_indoor_equip.heating_btuh_47f` | Btu/h | **kW** | "Heating Btu/h 47F" (backend) | frontend-only |
| `pumps.flow_gpm` | GPM | **l/min** | — | `{ si_unit: "l_min", ip_unit: "gpm" }` |

Adjacent trap: `heat_pumps_indoor_equip.heating_btuh_17f` genuinely IS Btu/h
(plain number field, no units config) — sitting next to two misnamed kW
fields, which is maximally confusing for any consumer reasoning from keys.

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
   label/key (e.g. `fan_speed_cfm` = CFM, `nominal_tons` = tons,
   `heating_btuh_17f` = Btu/h).

## Contract (what must be true when this refactor completes)

### C1 — Backend field_defs are the single source of units truth

- Every built-in field with unit-toggled display emits its units block
  (`si_unit`, `ip_unit`, mode) from the backend field_def registry
  (`backend/features/project_document/tables/*.py`).
- The frontend consumes that block instead of hardcoding
  `HEAT_PUMP_POWER_UNITS` in
  `frontend/src/features/equipment/heat-pumps/field-defs.ts`.
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
- Open decision (record in a `decisions.md` when made):
  - `heating_btuh_17f`: keep as truthful Btu/h plain number, or convert to
    `heating_cap_kw_17f` with a units block for consistency. **Caveat:** this
    is the one rename that is NOT value-passthrough — stored values are Btu/h
    and would need conversion (÷ 3412.14) in the migration.
  - `pumps.flow_gpm`: rename to `flow_l_min` (or `flow` + units block), or
    accept and document. The units block here is already correct; only the
    key lies.

### C3 — Migration is one schema bump, passthrough where possible

- All accepted renames land in a single v8→v9 document schema migration
  (`CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` at
  `backend/features/project_document/document.py:224`; process per
  `docs/SCHEMA_VERSIONS.md` and the beta-schema-evolution
  schema-bump-checklist; rollout precedent:
  `planning/refactor/spec-status-value-unification/`).
- kW-field renames are key-only value passthrough (values are already kW).
  Only a `heating_btuh_17f` → kW conversion (if accepted) rewrites values.
- Historical versions remain readable; saved v8 bodies read back as v9.

### C4 — Stopgap is deliverable independently

If the rename is deferred, the backend display names/descriptions for
`cooling_btuh` and `heating_btuh_47f` are corrected to say kW so document
consumers are not lied to. This plus C1 ships first (small, no migration).

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

- Backend + frontend test suites updated for new keys; migration test proves
  v8 bodies read back as v9 with values unchanged (or correctly converted
  for `heating_btuh_17f` if that rename is accepted).
- A document field_defs read (API or MCP `get_table`) shows the units block
  for every capacity field.
- Phius export output unchanged in magnitude for a fixture project across
  the bump.
- `make ci` green.
