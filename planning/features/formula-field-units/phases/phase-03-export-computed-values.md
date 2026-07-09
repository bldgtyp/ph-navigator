# Phase 03 — Emit computed/formula values in the Grasshopper export (then unlock built-ins)

```
DATE:    2026-07-09
TIME:    12:55 EDT
STATUS:  Planned — in-repo change, no external dependency. Supersedes the earlier "gate" framing.
AUTHOR:  Ed + Claude
SCOPE:   backend/features/gh_api/tables_export.py (the GET /tables/{table_name} exporter).
         Fixes computed values for ALL tables + ALL formula fields, not just airflow.
DEPENDS: Phase 01 (formula config with units). Independent of Phase 02.
RELATED: PRD.md §7.6, decisions.md D8 (revised), STATUS.md
```

## Why this replaces the old "confirm the export" gate

Investigation (2026-07-09) settled the architecture:

- **Computed/formula values are never persisted.** The JSONB document stores formula *config*
  (`source/ast/deps/result_type`) + input values only. The resolved value is derived on every
  read by `evaluate_table_formulas(registry, body)` → `{row_id: {field_key: value}}`. This is
  correct and stays — persisting derived values would reintroduce staleness.
- **MCP `get_document` / `get_table` and the frontend already surface `rows_computed`.** The
  **only** consumer that drops computed values is the Grasshopper/honeybee-ph tabular export.
- `backend/features/gh_api/tables_export.py:19-20` already documents the gap: *"No
  computed/formula values — raw stored fields only (computed rollups are a logged follow-up)."*

So the risk that made Phase 3 a "gate" is really just this one exporter omitting a value it can
trivially compute. Fix the exporter and the gate disappears — converting **any** field
(built-in airflow included) to a formula exports correctly, and every table gains computed-value
export at once.

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
   Decide: emit `null` (clean, GH sees "no value") or pass the error object through. Recommend
   `null` for the export — an energy model can't consume `#ERROR`.
5. **Update the module docstring** (`:9-21`) — remove the "No computed/formula values" caveat;
   document the new shape.

Est. ~25-40 LOC + tests. No persistence change, no migration, no new architecture.

## Decisions to confirm

- **Wire shape: INLINE — confirmed (D10).** No parallel `computed` block.
- **GH client awareness** (separate repo, honeybee_grasshopper_ph_plus). With inline, a generic
  field reader needs no change; a hardcoded reader needs to know a `formula` field carries a
  value in the record. Confirm which the client does before the GH side depends on it.

## Then: unlock the built-in airflow fields

Once the export emits computed values:

1. Remove `supply_airflow_m3h` / `extract_airflow_m3h` from the **temporary** Phase-1 entry in
   `ROOMS_FIELD_TYPE_LOCKED_KEYS` (`backend/features/project_document/tables/rooms.py:508-510`).
   They become convertible-to-formula like any other field.
2. Round-trip test on a built-in: number → formula → number restores seed units (Phase-1 D6).
3. **Export smoke:** a project whose supply airflow is a formula exports the *computed* value via
   `GET /tables/rooms`, not empty.

## Tests

- gh_api export suite: a table with a formula field exports the resolved value (inline or in the
  `computed` block); a formula error row exports `null`; a non-formula table is unchanged.
- Generality: at least one non-Rooms table with a formula field (e.g. a computed rollup on an
  equipment table) exports its computed value.
- Post-unlock: built-in `supply_airflow_m3h` as a formula exports its computed value.

## Verification

- `make ci` green. Manual: `GET /tables/rooms` on a project with a formula supply-airflow field
  returns the computed value in the record.

## Risk

Low and in-repo. The only outward-facing consideration is the GH client's field-reading
assumption (above) — confirm before the honeybee-ph side depends on it. This phase strictly
improves the export (all tables, all formulas) and removes the external gate entirely.
