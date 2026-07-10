# STATUS — Formula fields with units

```
DATE:    2026-07-09
TIME:    13:38 EDT
STATUS:  COMPLETE (2026-07-09) — all three phases implemented on branch
         feature/formula-field-units. Backend suite green (1334 passed); frontend
         suites green. Merge to main = Ed's call.
AUTHOR:  Ed + Claude
```

## Current state

`COMPLETE`. All three phases are implemented on `feature/formula-field-units` (D1-D14
honored). Phase 1 — gh_api export emits computed values inline. Phase 2 — unit-aware
number↔formula conversion, shared fixed-units guard, `display_units` wire field, registry
drift closed. Phase 3 — computed cells/headers/clipboard/CSV format through a shared
`displayUnitsFor` accessor, modal Display-units section. This is a **shared data-table**
change — it lands for every FieldDef table at once (D9), not just Rooms. Backend suite green
(1334 passed); frontend suites green. Not yet merged to main (Ed's call).

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

**Phases 1 & 2 are DONE** (2026-07-09). **Phase 1** — the gh_api exporter emits
computed/formula values inline (`tables_export.py`); `{"error"}`-overlay decode extracted
into shared `formula.overlay_cell_value`. **Phase 2** (backend) — registry drift closed
(`length_mm`/`power` added), shared fixed-units guard + `collapse_carried_units` tri-state
in `mutations/guards.py`, top-level `display_units` wire field (D12), numeric-formula units
in `validate_number_config` (D4), `apply_set_formula` `carried_units` reconciliation
(D7/D14), reverse carry-back on `formula→number` (D6). Full backend suite green (1334 passed).
Next: **Phase 3** (frontend — `displayUnits` payload, computed-cell unit display, modal picker).

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
