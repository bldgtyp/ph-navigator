---
DATE: 2026-08-02
TIME: 18:54 EDT
STATUS: Complete — v9 implementation and verification passed; archive pending
AUTHOR: Claude with Ed May (from the Linde 2524 mech-equipment session handoff)
SCOPE: Make document field keys, backend field_def metadata, and display
  names agree about canonical units for heat-pump and pump fields, so no
  human or agent consumer can be misled into writing IP values into
  SI-canonical fields.
RELATED:
  - ./PRD.md
  - ./STATUS.md
  - ./decisions.md
  - ./archive/HANDOFF_2026-08-02.md
  - ../spec-status-value-unification/ (schema-bump precedent)
  - ../../archive/dated/2026-06-27/beta-schema-evolution/schema-bump-checklist.md
  - docs/SCHEMA_VERSIONS.md
---

# Units metadata & field-naming truthfulness

Planning router for fixing the heat-pump / pump field-naming and units-metadata
traps found during the Linde 2524 MCP mechanical-equipment update
(2026-08-02): an agent entered Btu/h values into fields whose keys say
`*_btuh` but whose canonical storage is kW, producing a "34,000 kW" heat pump
in the UI. Production data has been corrected; this refactor removes the traps
from the app so it cannot recur.

## Implemented contract

1. **Backend field_defs own units metadata** — all six outdoor/indoor
   heat-pump capacity FieldDefs publish fixed power metadata with canonical kW
   storage. The frontend consumes schema metadata through the shared FieldDef
   path; no duplicate feature-owned power-units contract remains.
2. **Names and keys are truthful** — indoor capacities are
   `cooling_cap_kw`, `heating_cap_kw_47f`, and `heating_cap_kw_17f`; pump flow
   is `flow_l_min`; display names omit embedded unit claims because the shared
   unit pill reports the active unit system.
3. **One forward-only v8→v9 migration** — the two already-kW capacity values
   and already-l/min pump values pass through; legacy `heating_btuh_17f`
   values convert to kW using `3412.141633 Btu/h per kW`. Persisted FieldDefs
   are refreshed from the current registries in the same step.

## Closeout

The implementation, simplify/docs-pass, Graphify update, full CI, Phius export,
and mounted localhost API/UI verification are complete. This branch has not
written to production project data. The packet is ready to move to the dated
planning archive after its implementation commit. The MCP transport work
described in the original handoff remains outside this repo.

## Read in this order

1. `PRD.md` — the naming/units contract and migration requirements.
2. `STATUS.md` — current state and next step.
3. `archive/HANDOFF_2026-08-02.md` — the original session handoff
   (diagnosis narrative, production-data correction record).
