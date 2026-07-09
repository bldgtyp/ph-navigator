# Phase 01 — Backend: allow unit-bearing number → formula, carry display-units

```
DATE:    2026-07-09
TIME:    11:46 EDT
STATUS:  Planned — not started.
AUTHOR:  Ed + Claude
SCOPE:   Shared project-document schema-mutation pipeline + config validation + formula config.
         Table-agnostic — lands for every FieldDef table at once (D9).
DEPENDS: none (Phase 2 is the visible half; Phase 3 gates built-in airflow fields).
RELATED: PRD.md §5.1/§5.2/§5.4/§7, decisions.md D1-D9
```

## Goal

Make the backend accept converting a **unit-bearing number field into a formula** and let a
numeric formula **carry a display-unit** (`units` config), without weakening the protections
that keep a fixed catalog unit from being silently retargeted. This is the whole
server-side contract; the frontend (Phase 2) only surfaces it.

A green Phase 1 means: an `editFieldBundle` that turns a `number` field with
`units.mode == "fixed"` into a `formula` (with a `formulaSource`) **succeeds** (after the
existing destructive ack), stores `config = {source, ast, deps, result_type, units}`, and the
computed value round-trips through `rooms_response.rows_computed` unchanged.

## Edit sites (all shared, table-agnostic)

### 1. Relax the fixed-units guard — scope it to number→number unit edits
Files: `backend/features/project_document/mutations/bundle.py:80-86` and
`backend/features/project_document/mutations/type_conversion.py:276-282` (identical guards).

Current (both):
```python
if _number_units_are_fixed(existing) and existing.config.get("units") != after.config.get("units"):
    raise api_error(..., "custom_field_fixed_units_locked", "Fixed unit config cannot be edited.", ...)
```
Change to fire **only when the field stays a number field**:
```python
if (
    _number_units_are_fixed(existing)
    and after.field_type is CustomFieldType.number
    and existing.config.get("units") != after.config.get("units")
):
    raise api_error(..., "custom_field_fixed_units_locked", "Fixed unit config cannot be edited.", ...)
```
- Leaving number-hood (`after.field_type != number`) is no longer treated as an illegal unit
  edit — units are expected to move to the formula display slot (or disappear).
- **Do NOT touch** the separate `field_type_locked_keys` guard (`type_conversion.py:288-294`).
  Floor / Zone / iCFA / Space-Type stay type-locked; this phase only unblocks fields that were
  blocked *solely* by the fixed-units check (the airflow / ceiling-height family).

### 2. Permit `units` on a numeric formula in config validation
File: `backend/features/project_document/custom_fields.py` — `validate_number_config`
(`:131-171`), called by the `TableFieldDef.validate_config` model validator (`:225-229`).

Current gate rejects units on any non-number field (`:136-137`). Widen to:
```python
if units is None:
    return config
if field_type is CustomFieldType.number:
    pass
elif field_type is CustomFieldType.formula and config.get("result_type") == "number":
    pass  # D4 — display-only units on a numeric formula
else:
    raise ValueError("units config is only valid for number fields or numeric formulas")
```
The remainder of the validator (required keys, `mode` ∈ {editable, fixed}, `unit_type` in
`NUMBER_UNIT_REGISTRY`, si/ip membership, precision clamp) is unit-type-agnostic and applies
unchanged — a formula's units get the same structural validation as a number's.

### 3. `set_formula` becomes the single reconciliation point for units
File: `backend/features/project_document/mutations/formula_ops.py` — `apply_set_formula`
(`:157-221`), specifically the `new_config` build at `:196-199`.

Today it rebuilds `config = {source, ast, deps, result_type}`, **dropping any units**. Change
it to preserve/reconcile units, gated on the freshly-inferred `result_type`:
```python
result_type = infer_result_type(resolved)
carried = carried_units if carried_units is not None else existing.config.get("units")
new_config: dict[str, object] = {
    "source": mutation.source,
    "ast": ast_to_json(resolved),
    "deps": deps,
    "result_type": result_type,
}
if carried is not None and result_type == "number":
    new_config["units"] = carried          # D4/D5 — keep display units on numeric result
# else: units intentionally dropped (D7 reconciliation — e.g. source edited to text/bool)
```
Add an **optional internal param** `carried_units: dict | None = None` to `apply_set_formula`
(NOT to the `SetFormulaMutation` wire model). Two callers:
- **Standalone `setFormula`** (user edits an existing formula's source): passes nothing;
  `existing.config.get("units")` preserves the field's own display units across a source edit,
  and auto-drops them if the edit flips `result_type` away from number (handles PRD §7.3-4).
- **Bundle** (conversion path): passes the carried units (next site).

### 4. Bundle: thread carried units through, don't stash them (ordering gotcha — D7)
File: `backend/features/project_document/mutations/bundle.py` — `apply_edit_field_bundle`
(`:57-277`).

**Why not just put `units` in the step-4 config:** step 4 (`:204-218`) does
`existing.model_copy(update={"config": target_config})`, which triggers `validate_config`.
At that moment a formula has **no `result_type`** yet (set_formula runs at step 5), so a config
carrying `units` would fail the new validator ("units only valid for numeric formula"). So:

1. Before step 4, capture `carried_units = after.config.get("units")` when the bundle targets a
   formula (`after.field_type is CustomFieldType.formula`).
2. In step 4's `target_config`, **exclude `units`** for a formula target (units are not a
   step-4-owned key for formulas; they'll be re-applied by set_formula). ast/deps/result_type
   are already server-owned and absent here.
3. At step 5 (`:221-234`), pass `carried_units=carried_units` into `apply_set_formula`. Now the
   only construction that carries `units` also has a `result_type` → validation is coherent.
4. If `result_type != number`, set_formula drops the units (D7); optionally record
   `audit_extras["display_units_dropped"] = True` so the action log explains the drop.

### 5. Reverse: `formula(units) → number` restores the display-unit (D6)
File: `type_conversion.py` — the `formula → *` snapshot path in `apply_change_type`
(`:412-421`, policy `lossy` for `formula → number` per `models.py:126`).

When the source formula carried `units` and the target is `number`, seed the new number
field's `config["units"]` from the formula's units (they share the exact shape). Precision
follows the units. Result: `number(units) → formula → number` is unit-stable and a reverted
built-in airflow field matches its seed config. Guard: only when `after.config` doesn't already
specify units (respect an explicit client override).

## What is NOT changing

- `CONVERSION_MATRIX` — `number → formula` is already `discard_then_author` (`models.py:100`);
  no matrix entry changes. The destructive-ack preflight is unchanged and now simply becomes
  *reachable* for fixed-unit fields (it was blocked by the guard firing first — PRD §7.2).
- The formula evaluator / `evaluate_table_formulas` — units are display-only; the engine stays
  unit-blind and computes on stored SI (PRD §4a corollary). No evaluator change.
- Per-table code — none. All edits are in shared modules (D9).

## Tests (backend, `pytest` via `uv run`, run from `backend/`)

Add to the schema-mutation / custom-field suites (e.g.
`backend/features/project_document/**/tests/` alongside the existing changeType / setFormula
tests). Cover at least **one non-Rooms FieldDef table** to prove generality (D9).

1. **Unblock:** `editFieldBundle` number(fixed airflow) → formula with `formulaSource`, no
   `acknowledge_destructive`, with non-empty cells → `422 custom_field_coercion_preflight_required`
   (the ack path is now reached, not `custom_field_fixed_units_locked`).
2. **Success + carry-forward:** same with `acknowledgeDestructive: true` → 200; stored config is
   `{source, ast, deps, result_type: "number", units: <airflow>}`; `rows_computed` holds the
   computed values; SI values match the arithmetic.
3. **`/0.77` and `/{Factor}` parity:** a formula dividing an airflow field by a literal, and by
   a unit-less number field, both yield identical numeric results tagged airflow (PRD §4a corollary).
4. **result_type reconciliation:** set a numeric formula's source, then edit it to `concat(...)`
   (text) → units are dropped from config; validator does not reject.
5. **Text/bool formula rejects units:** constructing a formula field with `units` but
   `result_type != "number"` raises `invalid_project_document` at the validator boundary.
6. **Round-trip (D6):** number(airflow) → formula → number restores `config.units`.
7. **Locks preserved:** iCFA / Floor / Zone / Space-Type still reject a type change
   (`custom_field_field_type_locked`); a *still-number* fixed field still rejects a unit edit
   (`custom_field_fixed_units_locked`) — the guard scoping didn't over-loosen.
8. **MCP path parity:** the same conversion via the MCP `save_draft` / bundle route validates
   identically (config validation is model-level, so this should pass for free — assert it).

## Verification

- `make ci` (backend slice green). New tests above pass.
- Manual: seed a project, POST an `editFieldBundle` converting a custom airflow number field to
  a formula; GET the rooms slice; confirm `field_defs[..].config.units` present and
  `rows_computed` populated.

## Risks / watch-items

- **Ordering (D7)** is the sharp edge — get the capture/thread sequence right or `validate_config`
  will reject mid-bundle. Test 5 guards the invariant.
- **Registry drift (PRD §7.9):** reusing `validate_number_config` for formulas widens exposure to
  the frontend-only `power` / `length_mm` unit types that the backend registry lacks. Not caused
  here, but add a note / snapshot test so a formula authored with an unknown unit_type fails
  loudly rather than surprising Phase 2.
- **Built-in airflow fields:** this phase makes the *mechanism* general, but the two PH-semantic
  airflow built-ins must stay conversion-locked until Phase 3 (D8). Simplest interim: add
  `supply_airflow_m3h` / `extract_airflow_m3h` to `ROOMS_FIELD_TYPE_LOCKED_KEYS` **temporarily**
  (so custom fields get the feature, built-ins wait), and remove them in Phase 3. Confirm with Ed.
