# STATUS — Formula fields with units

```
DATE:    2026-07-09
TIME:    11:46 EDT
STATUS:  Scoped — Option B accepted. Phases 1-3 planned; implementation not started.
AUTHOR:  Ed + Claude
```

## Current state

`Scoped`. Design is settled (Option B, unit-aware formula), the accepted decisions are in
`decisions.md` (D1-D9), and handoff-ready implementation plans exist in `phases/`. No code has
been written. This is a **shared data-table** change — it lands for every FieldDef table at
once (D9), not just Rooms.

## What was decided (see decisions.md)

- **Option B — unit-aware formula fields** (D1). A numeric formula carries a display-unit and
  formats through the existing SI/IP path.
- **The output unit is a free-choice display label** (D2), never derived or validated against
  inputs (D3). The "inputs must share a unit type" idea is dead — it's wrong (`airflow / 0.77`)
  and insufficient (`{Wattage}/{Airflow}` morphs to a third type). Unit-less fields are raw
  scalars, identical to literals (PRD §4a). This *removed* the hard part instead of solving it.
- **Reuse the number `units` config shape/key**, gated on `result_type == "number"` (D4);
  **carry units forward on conversion** (D5) and back on reverse (D6); **thread units through
  `set_formula`** to respect the per-construction validator (D7).
- **v1 ships for custom fields**; the two built-in PH-semantic airflow fields wait on Phase 3 (D8).

## The export question — resolved, and it's in-repo (no external gate)

Investigation (2026-07-09) settled it: computed/formula values are **never persisted** (derived
on read — correct, keep it), MCP + the frontend **already** surface `rows_computed`, and the
**only** consumer that drops them is the Grasshopper export (`gh_api/tables_export.py:19-20`, an
already-logged gap). So there is no external unknown — **Phase 3 is a small in-repo change** that
makes that exporter emit computed values (fixing all tables), after which the built-in airflow
fields unlock cleanly. See `phases/phase-03-export-computed-values.md`.

## Next step

Implement **Phase 1** (`phases/phase-01-backend.md`) — scoped to custom fields (temporarily lock
the two built-in airflow fields). Then **Phase 2** (frontend). **Phase 3** (export computed
values + unlock built-ins) can proceed in parallel with Phase 2 — it's independent and in-repo.

## Blockers

- **None external.** All three phases are in-repo. The only cross-repo touchpoint is confirming
  the honeybee-ph GH client reads a formula field's value from the exported record (Phase 3
  decision), which is a shape choice, not a blocker.

## Verification (per phase)

- **Phase 1:** `number(fixed airflow) → formula` bundle succeeds after the destructive ack (not
  `custom_field_fixed_units_locked`); stored config `{source, ast, deps, result_type, units}`;
  `/0.77` and `/{Factor}` parity; result_type→text drops units; round-trip restores units; locks
  intact. `make ci` green.
- **Phase 2:** a formula airflow cell honors the SI/IP toggle + precision; `fixed` unit controls
  disabled in the modal; carry-forward payload correct; clipboard parity. `make ci` green.
- **Phase 3:** `GET /tables/rooms` on a project with a formula field returns the computed value
  in the record (all tables); built-in supply-airflow-as-formula exports non-empty after unlock.
