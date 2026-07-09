# STATUS — Formula fields with units

```
DATE:    2026-07-09
TIME:    13:38 EDT
STATUS:  Scoped — Option B accepted; 2026-07-09 pre-implementation review folded in
         (D12-D14, phase reorder). Phases 1-3 planned; implementation not started.
AUTHOR:  Ed + Claude
```

## Current state

`Scoped`. Design is settled (Option B, unit-aware formula), the accepted decisions are in
`decisions.md` (D1-D14), and handoff-ready implementation plans exist in `phases/` — revised
after a pre-implementation code review (2026-07-09) that verified every load-bearing claim
against the code and found five mechanics-level issues, all folded back into the plans. No
code has been written. This is a **shared data-table** change — it lands for every FieldDef
table at once (D9), not just Rooms.

## What was decided (see decisions.md)

- **Option B — unit-aware formula fields** (D1). A numeric formula carries a display-unit and
  formats through the existing SI/IP path.
- **The output unit is a free-choice display label** (D2), never derived or validated against
  inputs (D3). Unit-less fields are raw scalars, identical to literals (PRD §4a).
- **Reuse the number `units` config shape/key in the stored config**, gated on
  `result_type == "number"` (D4); **carry units forward on conversion** (D5) and back on
  reverse (D6); **thread units through `set_formula`** (D7).
- **Review revisions (2026-07-09):** units travel **top-level on the wire** (`display_units`,
  mirroring `formula_source`) because `after.config` is validated at request parse (D12);
  fixed-unit fields convert **only number ⇄ formula** under an **effective-units guard** that
  keeps `fixed` enforced on formulas *and* lets the reverse conversion / undo pass (D13);
  `set_formula` reconciliation runs on **every** formula-target bundle so renames and
  units-only retags can't drop units (D14); the **export fix ships first** (D8 revised) —
  18 fixed-unit built-ins across 8 exported tables meant the old "lock two Rooms fields"
  interim plan was insufficient, so ordering replaces scaffolding.

## The export question — resolved, in-repo, and now Phase 1

Computed/formula values are **never persisted** (derived on read — correct, keep it), MCP +
the frontend **already** surface `rows_computed`, and the **only** consumer that drops them is
the Grasshopper export (`gh_api/tables_export.py:19-20`, an already-logged gap). Phase 1 makes
that exporter emit computed values (~25-40 LOC, fixes all tables), and landing it **before**
the guard relax means no built-in ever needs a conversion lock. See
`phases/phase-01-export-computed-values.md`.

## Next step

**Phase 1 is DONE** (2026-07-09) — the gh_api exporter now emits computed/formula values
inline (`backend/features/gh_api/tables_export.py`); the `{"error"}`-overlay decode was
extracted into the shared `formula.overlay_cell_value` helper. Next: **Phase 2** (backend:
registry drift + guard redesign + wire model + set_formula), then **Phase 3** (frontend).
Phase 1 before Phase 2 was a safety ordering (PRD §7.16), now satisfied.

## Blockers

- **None external.** All three phases are in-repo. The only cross-repo touchpoint is confirming
  the honeybee-ph GH client reads a formula field's inline value from the exported record
  (Phase 1 note) — a shape check, not a blocker.

## Verification (per phase)

- **Phase 1:** `GET /tables/rooms` on a project with a formula field returns the computed value
  inline in the record (all tables); formula error rows export `null`. `make ci` green.
- **Phase 2:** `number(fixed airflow) → formula` bundle succeeds after the destructive ack (not
  `custom_field_fixed_units_locked`); stored config `{source, ast, deps, result_type, units}`;
  `/0.77` and `/{Factor}` parity; result_type→text drops units; **round-trip with no explicit
  units restores units (undo path)**; `formula(fixed)` units retag rejected via raw API;
  units-only retag without `formula_source` persists; rename keeps units; number(fixed)→text
  still rejected; type-locks intact; registry snapshot test green. `make ci` green.
- **Phase 3:** a formula airflow cell honors the SI/IP toggle + precision; `fixed` unit controls
  disabled in the modal; conversion payload has no in-config units and only sends top-level
  `displayUnits` when dirty; clipboard parity; error cells never unit-formatted. `make ci` green.
