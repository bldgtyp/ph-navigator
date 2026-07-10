# Phase 01 — Emit computed/formula values in the Grasshopper export

```
DATE:    2026-07-09
TIME:    13:38 EDT
STATUS:  DONE (2026-07-09) — exporter now emits computed values inline; landed first.
         Impl: gh_api/tables_export.py + shared formula.overlay_cell_value helper.
AUTHOR:  Ed + Claude
SCOPE:   backend/features/gh_api/tables_export.py (the GET /tables/{table_name} exporter).
         Fixes computed values for ALL tables + ALL formula fields, not just airflow.
DEPENDS: none. (Renumbered from phase-03 in the 2026-07-09 review — see "Why this is
         Phase 1" below. It does not need formula units to exist; it emits whatever
         `evaluate_table_formulas` yields, and units are display-only anyway.)
RELATED: PRD.md §7.6/§7.16, decisions.md D8 (revised), D10, STATUS.md
```

## Why this is Phase 1 (reordered by the 2026-07-09 review)

The original plan ran backend → frontend → export, temporarily adding the two Rooms
airflow built-ins to `ROOMS_FIELD_TYPE_LOCKED_KEYS` so no GH-exported built-in could
become a formula while the exporter still dropped computed values. The review killed
that ordering:

- The Phase-2 guard relax is **table-agnostic** (D9, by design). There are **18
  fixed-unit built-ins across 8 exported tables** (`appliances`, `fans`,
  `hot_water_tanks`, `hot_water_heaters`, `pumps`, `ventilators`, `rooms`,
  `thermal_bridges`) — and **only Rooms even has a `field_type_locked_keys` list**.
- A lock on just `supply_airflow_m3h` / `extract_airflow_m3h` would leave ~16 other
  built-ins (fan wattage, ventilator airflow, tank volumes, …) convertible to formula
  during the gap — and each converted one would export **empty** to honeybee-ph.
  Silent energy-model corruption is the worst failure mode in this stack.
- Locking all 18 across 8 tables is more code than the export fix itself (~25-40 LOC).

So: land this exporter change **before** the guard relax. No interim lock is ever
added, no unlock step ever needed — the D8 "gate" is dissolved by ordering, not by
scaffolding.

## Background — why this was ever framed as a gate

Investigation (2026-07-09) settled the architecture:

- **Computed/formula values are never persisted.** The JSONB document stores formula *config*
  (`source/ast/deps/result_type`) + input values only. The resolved value is derived on every
  read by `evaluate_table_formulas(registry, body)` → `{row_id: {field_key: value}}`. This is
  correct and stays — persisting derived values would reintroduce staleness.
- **MCP `get_document` / `get_table` and the frontend already surface `rows_computed`.** The
  **only** consumer that drops computed values is the Grasshopper/honeybee-ph tabular export.
- `backend/features/gh_api/tables_export.py:19-20` already documents the gap: *"No
  computed/formula values — raw stored fields only (computed rollups are a logged follow-up)."*

Fixing the exporter fixes computed-value export for **all** tables and **all** formula
fields (including today's built-in `record_id` and any user formulas), independent of the
units feature.

## The change (small, one file)

File: `backend/features/gh_api/tables_export.py`.

1. **Path → contract map.** The module already builds `{contract.table_path}` for its drift
   guard (`:119-121`). Extend that to `{contract.table_path: contract}` (or add a lookup) so
   `export_table` can fetch the `TableContract` for the requested `path`.
2. **Compute the overlay.** In `export_table` (`:58-80`), after resolving the envelope:
   ```python
   contract = _contract_by_path[path]                     # from the map above
   overlay = evaluate_table_formulas(contract.field_registry, body)  # same call as every read
   ```
   `contract.field_registry` is exposed (`contracts.py:271`); guard `is not None` (all 12
   exported tables are FieldDef tables, so it's always present).
3. **Merge into records — INLINE (D10, confirmed).** In `_record` (`:83-96`), for each formula
   `field_def` set `record[field_key] = overlay[row_id].get(field_key)`. A formula field_key
   never collides — a formula has no stored cell — so it drops cleanly alongside the typed
   built-ins and `custom_values`. GH reads a formula column exactly like any other field,
   interpreting type via the passed-through `field_defs` (the exporter's existing design goal).
   No separate `computed` block.
4. **Formula error overlays.** `evaluate_table_formulas` can yield `{"error": "..."}` for a row.
   Emit `null` for the export — an energy model can't consume `#ERROR`.
5. **Update the module docstring** (`:9-21`) — remove the "No computed/formula values" caveat;
   document the new shape.

Est. ~25-40 LOC + tests. No persistence change, no migration, no new architecture.

## Decisions already settled

- **Wire shape: INLINE — confirmed (D10).** No parallel `computed` block.
- **GH client awareness** (separate repo, honeybee_grasshopper_ph_plus). With inline, a generic
  field reader needs no change; a hardcoded reader needs to know a `formula` field carries a
  value in the record. Confirm which the client does before the GH side depends on it —
  a shape check, not a blocker for landing this phase (nothing regresses; formula columns
  were empty before and populated after).

## Tests

- gh_api export suite: a table with a formula field exports the resolved value inline; a
  formula error row exports `null`; a non-formula table is unchanged.
- Generality: at least one non-Rooms table with a formula field (e.g. a computed rollup on an
  equipment table) exports its computed value.
- (Deferred to Phase-2 verification: a built-in `supply_airflow_m3h` converted to a formula
  exports its computed value — the conversion itself doesn't exist until Phase 2 lands.)

## Verification

- `make ci` green. Manual: `GET /tables/rooms` on a project with a formula field (e.g. the
  built-in `record_id`, or a custom formula) returns the computed value in the record.

## Risk

Low and in-repo. The only outward-facing consideration is the GH client's field-reading
assumption (above) — confirm before the honeybee-ph side depends on formula columns. This
phase strictly improves the export (all tables, all formulas) and removes the need for any
built-in conversion lock in Phase 2.
