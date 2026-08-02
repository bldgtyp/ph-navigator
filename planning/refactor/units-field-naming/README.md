---
DATE: 2026-08-02
TIME: 12:00 EDT
STATUS: Active — fixes proposed, not yet implemented
AUTHOR: Claude with Ed May (from the Linde 2524 mech-equipment session handoff)
SCOPE: Make document field keys, backend field_def metadata, and display
  names agree about canonical units for heat-pump and pump fields, so no
  human or agent consumer can be misled into writing IP values into
  SI-canonical fields.
RELATED:
  - ./PRD.md
  - ./STATUS.md
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

## The three work items

1. **Backend field_defs must carry units metadata** (MEDIUM, small) — the
   typed heat-pump capacity fields ship `config: {}` in the document
   field_defs; the units block (`HEAT_PUMP_POWER_UNITS`) exists only in
   `frontend/src/features/equipment/heat-pumps/field-defs.ts`. API/MCP
   consumers cannot discover canonical units. Emit the units block from the
   backend registry and make the frontend consume it.
2. **Stopgap display-name truth** (HIGH, trivial) — backend display names for
   the indoor-equip capacity fields say "Cooling Btu/h" / "Heating Btu/h 47F"
   while the stored values are kW
   (`backend/features/project_document/tables/heat_pumps.py:151-158`).
   Correct the names/descriptions immediately, ahead of any rename.
3. **Field-key renames with one schema bump v8→v9** (HIGH, larger) —
   `heat_pumps_indoor_equip.cooling_btuh` / `heating_btuh_47f` →
   `cooling_cap_kw` / `heating_cap_kw_47f` (matching the outdoor-equip
   convention already in the same registry: `heating_cap_kw_17f`,
   `heating_cap_kw_47f`, `cooling_cap_kw_95f`); decide the fate of
   `heating_btuh_17f` (genuinely Btu/h today) and `pumps.flow_gpm`
   (canonically l/min). See `PRD.md` for the contract and the
   value-conversion caveat on `heating_btuh_17f`.

## Out of scope, tracked as dependency

The MCP transport bug found in the same session (idle keep-alive sockets
closed by Cloudflare/Render → `Remote end closed connection without
response` on the first calls after a pause) lives in the **claude-plugins**
repo, not this one. It was fixed 2026-08-02 (uncommitted at handoff time):
pooled sockets idle >10 s reopen proactively, plus one retry on a fresh
socket only when the request provably never reached the server. Needs
review, commit, plugin version bump + reinstall. Tracked in `STATUS.md`
here only until it lands, because it gates safe agent-driven verification
of this refactor against production.

## Read in this order

1. `PRD.md` — the naming/units contract and migration requirements.
2. `STATUS.md` — current state and next step.
3. `archive/HANDOFF_2026-08-02.md` — the original session handoff
   (diagnosis narrative, production-data correction record).
