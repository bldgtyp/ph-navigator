# Phase 02 — Backend: allow unit-bearing number ⇄ formula, carry display-units

```
DATE:    2026-07-09
TIME:    13:38 EDT
STATUS:  Planned — not started. Revised per the 2026-07-09 pre-implementation review
         (D12 wire transport, D13 guard redesign, D14 always-reconcile; interim
         built-in lock deleted — Phase 1 lands first instead).
AUTHOR:  Ed + Claude
SCOPE:   Shared project-document schema-mutation pipeline + config validation + formula config.
         Table-agnostic — lands for every FieldDef table at once (D9).
DEPENDS: Phase 01 (export must emit computed values BEFORE the guard relax exposes
         GH-exported built-ins to conversion — D8 revised). Phase 3 is the visible half.
RELATED: PRD.md §5.1/§5.2/§5.4/§7, decisions.md D1-D14
```

## Goal

Make the backend accept converting a **unit-bearing number field into a formula** (and back)
and let a numeric formula **carry a display-unit** (`units` config), without weakening the
protections that keep a fixed catalog unit from being silently retargeted — *on either field
type*. This is the whole server-side contract; the frontend (Phase 3) only surfaces it.

A green Phase 2 means: an `editFieldBundle` that turns a `number` field with
`units.mode == "fixed"` into a `formula` (with a `formulaSource`) **succeeds** (after the
existing destructive ack), stores `config = {source, ast, deps, result_type, units}`, the
computed value round-trips through `rooms_response.rows_computed` unchanged, and converting
back to `number` restores the units (so undo works).

## Prerequisite task — close the unit-registry drift (promoted from watch-item)

Frontend `NUMBER_UNIT_TYPES` carries `power` / `length_mm`, absent from backend
`NUMBER_UNIT_REGISTRY`. Today that's a latent number-field bug; D11 hands formulas the
**full unit-type picker**, so it becomes easy to hit (a formula tagged `power` passes the
modal, then 422s at `validate_number_config`). Close it first:

- Either add the two types to the backend registry (needs si/ip unit lists + conversion
  support) or hide unsupported types in the frontend picker — implementer's call (O4).
- Either way, add a **shared snapshot test** asserting the frontend type set ⊆ backend
  registry (`number_unit_registry_snapshot()` exists for exactly this).

## Edit sites (all shared, table-agnostic)

### 1. Redesign the fixed-units guard — one shared helper, effective-units rule (D13)

Files: `backend/features/project_document/mutations/bundle.py:80-86` and
`backend/features/project_document/mutations/type_conversion.py:276-282` — the guard is
**duplicated verbatim** in both, as is `_number_units_are_fixed` (`bundle.py:280`,
`type_conversion.py:626`). This logic is getting subtler; **extract a single shared helper**
(e.g. in a mutations-common module) and call it from both sites, or the copies will drift.

Current (both):
```python
if _number_units_are_fixed(existing) and existing.config.get("units") != after.config.get("units"):
    raise api_error(..., "custom_field_fixed_units_locked", "Fixed unit config cannot be edited.", ...)
```

**Do NOT ship the naive relax** (fire only when `after.field_type == number`) from the
original plan — the review showed it (a) blocks `formula(fixed) → number` and therefore
**undo** of the forward conversion (the client sends no units on a type change, and D6's
server-side seeding runs *after* the guard), and (b) silently drops **all** backend
enforcement of `fixed` once the field is a formula (a `formula → formula` units retag
would sail through; only the modal's disabled controls would protect it, and MCP / raw
API bypass the modal).

Replace with the **effective-units rule**. Fire `custom_field_fixed_units_locked` iff
`_number_units_are_fixed(existing)` and `effective_after_units != existing.config["units"]`,
where:

| `after.field_type` | effective after-units |
|---|---|
| `number` | `after.config.get("units")` if the transition is number→number (unchanged behavior); on `formula → number`, explicit `after.config["units"]` if the client sent one, else **existing units** (the server will seed the carry-back per D6 — treat as equal) |
| `formula` | `mutation.display_units` if provided (D12); explicit-clear counts as a change; else **existing units** (the server will carry forward per D5 — treat as equal) |
| anything else | **always reject** (D13: fixed-unit fields may convert only number ⇄ formula — same protection as today, where the old guard blocked `number(fixed) → text` incidentally) |

Resulting behavior matrix for a fixed-unit field:
- `number → number`, units untouched → pass; units edited → **reject** (unchanged).
- `number → formula`, no explicit display_units → pass (carry-forward); retargeted
  display_units → **reject** (fixed can't be retargeted, even via conversion).
- `formula → formula` (rename, source edit, retag attempt): units retag → **reject**
  (backend-enforced now); otherwise pass.
- `formula → number`, no explicit units → pass (carry-back seeds them; **undo works**);
  explicit-and-equal → pass; explicit-and-different → **reject**.
- `number|formula (fixed) → text/url/single_select/…` → **reject** (D13).

`editable`-units fields skip the guard entirely, as today. Do **not** touch the separate
`field_type_locked_keys` guard (`type_conversion.py:288-294`) — Floor / Zone / iCFA /
Space-Type stay type-locked.

### 2. Wire model: top-level `display_units` on the bundle mutation (D12)

File: `backend/features/project_document/mutations/models.py` — `EditFieldBundleMutation`
(`:271`).

**Why not in `after.config`:** `after` is a `TableFieldDef`, whose
`validate_config` is a `model_validator(mode="after")` (`custom_fields.py:225`) — it runs
**at request parse**. A formula-target `after.config = {source, units}` carries no
`result_type` (server-owned; the client never sends it), so the widened validator (site 3)
would 422 the request before `bundle.py` ever runs. This is the same reason
`formula_source` is already a top-level mutation field rather than a config key — mirror it.

Add an optional tri-state field (exact Pydantic mechanics are the implementer's choice —
a sentinel default, or a value + explicit-clear flag pair):

- **absent** → carry forward the existing field's units (the default path; covers both the
  `number → formula` conversion and a same-type formula edit that doesn't touch units);
- **explicit clear** → bare-number formula (no units);
- **provided** → set/retag (validated against the registry when it lands in config at
  site 4/5; guard-checked at site 1 for fixed fields).

Only meaningful when the bundle targets a formula; reject or ignore it (implementer's
choice, documented) for other target types.

### 3. Permit `units` on a numeric formula in config validation

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
unchanged. Note the invariant is coherent for **stored** configs — `apply_set_formula` always
writes `result_type`, so a persisted formula with units always has it. The wire-parse case
never carries units in config at all (D12), so the strict gate is safe.

### 4. `set_formula` becomes the single reconciliation point for units

File: `backend/features/project_document/mutations/formula_ops.py` — `apply_set_formula`
(`:157-221`), specifically the `new_config` build at `:196-199`.

Today it rebuilds `config = {source, ast, deps, result_type}`, **dropping any units**. Change
it to preserve/reconcile units, gated on the freshly-inferred `result_type`:
```python
result_type = infer_result_type(resolved)
carried = _resolve_carried_units(carried_units, existing)   # tri-state, see below
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
Add an **optional internal param** `carried_units` to `apply_set_formula` (NOT to the
`SetFormulaMutation` wire model) with tri-state resolution matching D12:
provided → use it; explicitly cleared → `None`; absent → `existing.config.get("units")`.
Two callers:
- **Standalone `setFormula`** (user edits an existing formula's source): passes nothing;
  the absent-branch preserves the field's own display units across a source edit, and
  auto-drops them if the edit flips `result_type` away from number (PRD §7.3-4).
- **Bundle** (next site): passes the resolved `mutation.display_units` tri-state through.

### 5. Bundle: step 5 runs for EVERY formula-typed target (D14)

File: `backend/features/project_document/mutations/bundle.py` — `apply_edit_field_bundle`,
steps 4-5 (`:204-234`).

Today step 5 short-circuits on `mutation.formula_source is not None`. That breaks twice
under this feature:
- **Same-type formula rename:** with D12, the client strips `units` from a formula's
  `after.config`, so step 4's `target_config` no longer carries them — if step 5 doesn't
  run, the rename **drops the field's units**.
- **Units-only retag** (the flagship `W÷CFM → electric_efficiency` case): `handleSave`
  sends `formulaSource` only when the source draft is dirty; a retag without a source edit
  would skip step 5 and the units change **silently vanishes**.

Change: when `final_field.field_type is CustomFieldType.formula`, **always** run the
set_formula reconciliation, with `source = mutation.formula_source` if provided else the
existing stored `config["source"]`, and `carried_units` = the D12 tri-state. Re-parsing an
unchanged source is idempotent and cheap. Conversion *into* formula still requires an
authored `formula_source` (matrix `discard_then_author` — keep/assert the existing
"formula target needs a source" validation for the conversion case).

Step-4 details:
1. For a formula target, step 4's `target_config` **excludes `units`** (they're not a
   step-4-owned key; the only construction that carries `units` also has a `result_type` —
   the D7 ordering invariant). ast/deps/result_type are already server-owned and absent.
2. Audit: append `"display_units"` to `properties_changed` when the effective units differ
   from the existing ones; when a source edit flips `result_type` and drops units, record
   `audit_extras["display_units_dropped"] = True` so the action log explains it.

### 6. Reverse: `formula(units) → number` restores the display-unit (D6)

File: `type_conversion.py` — the `formula → *` snapshot path in `apply_change_type`
(`:412-421`, policy `lossy` for `formula → number` per `models.py:126`).

When the source formula carried `units` and the target is `number`, seed the new number
field's `config["units"]` from the formula's units (they share the exact shape). Precision
follows the units. Guard: only when `after.config` doesn't already specify units (respect an
explicit client override — which site 1's guard has already vetted for fixed fields).
Result: `number(units) → formula → number` is unit-stable, a reverted built-in airflow field
matches its seed config, and **undoing the forward conversion works** (site 1's effective-
units rule treats the absent-units carry-back as legal).

## What is NOT changing

- `CONVERSION_MATRIX` — `number → formula` is already `discard_then_author` (`models.py:100`);
  no matrix entry changes. The destructive-ack preflight is unchanged and now simply becomes
  *reachable* for fixed-unit fields (it was blocked by the guard firing first — PRD §7.2).
- The formula evaluator / `evaluate_table_formulas` — units are display-only; the engine stays
  unit-blind and computes on stored SI (PRD §4a corollary). No evaluator change. (Verified in
  review: the resolver topo-sorts formula-referencing-formula deps, so converting a field that
  other formulas reference is an ordinary graph update.)
- Per-table code — none. All edits are in shared modules (D9). **No interim lock on the
  built-in airflow fields** — the original plan's temporary `ROOMS_FIELD_TYPE_LOCKED_KEYS`
  entry is deleted from the plan; Phase 1 (export) landing first makes it unnecessary, and a
  two-field lock was insufficient anyway (18 fixed-unit built-ins across 8 tables).

## Tests (backend, `pytest` via `uv run`, run from `backend/`)

Add to the schema-mutation / custom-field suites (e.g.
`backend/features/project_document/**/tests/` alongside the existing changeType / setFormula
tests). Cover at least **one non-Rooms FieldDef table** to prove generality (D9).

1. **Unblock:** `editFieldBundle` number(fixed airflow) → formula with `formulaSource`, no
   `acknowledge_destructive`, with non-empty cells → `422 custom_field_coercion_preflight_required`
   (the ack path is now reached, not `custom_field_fixed_units_locked`).
2. **Success + carry-forward:** same with `acknowledgeDestructive: true`, `display_units`
   absent → 200; stored config is `{source, ast, deps, result_type: "number", units: <airflow>}`;
   `rows_computed` holds the computed values; SI values match the arithmetic.
3. **Parse safety (D12):** the bundle request never carries `units` in a formula target's
   `after.config`; a hand-built request that does (formula config with `units`, no
   `result_type`) fails validation at the model boundary — assert the error is clean, not a 500.
4. **`/0.77` and `/{Factor}` parity:** a formula dividing an airflow field by a literal, and by
   a unit-less number field, both yield identical numeric results tagged airflow (PRD §4a corollary).
5. **result_type reconciliation:** set a numeric formula's source, then edit it to `concat(...)`
   (text) → units are dropped from config; validator does not reject; audit records the drop.
6. **Text/bool formula rejects units:** constructing a formula field with `units` but
   `result_type != "number"` raises at the validator boundary.
7. **Round-trip / undo (D6 + D13):** number(fixed airflow) → formula → number with **no
   explicit units on the reverse** succeeds and restores `config.units` — the exact undo path.
8. **Fixed enforcement on formulas (D13):** a `formula(fixed) → formula` bundle with a
   retargeted `display_units` → `custom_field_fixed_units_locked`, even though the modal would
   never send it (MCP/raw-API parity).
9. **Units-only retag persists (D14):** an `editable` formula, bundle with `display_units`
   changed and **no `formula_source`** → 200; stored units updated; source/ast unchanged.
10. **Rename preserves units (D14):** a rename-only bundle on a unit-carrying formula keeps
    `config.units` intact.
11. **D13 conversion allowlist:** number(fixed) → text still rejects
    (`custom_field_fixed_units_locked`); number(editable) → text still succeeds.
12. **Locks preserved:** iCFA / Floor / Zone / Space-Type still reject a type change
    (`custom_field_field_type_locked`); a *still-number* fixed field still rejects a unit edit —
    the guard redesign didn't over-loosen.
13. **Registry snapshot:** frontend unit-type set ⊆ backend `NUMBER_UNIT_REGISTRY`
    (prerequisite task).
14. **MCP path parity:** the same conversion via the MCP `save_draft` / bundle route validates
    identically (config validation is model-level, so this should pass for free — assert it).

## Verification

- `make ci` (backend slice green). New tests above pass.
- Manual: seed a project, POST an `editFieldBundle` converting a **built-in** fixed-unit
  airflow field to a formula (no interim lock — Phase 1 already fixed the export); GET the
  rooms slice; confirm `field_defs[..].config.units` present and `rows_computed` populated;
  `GET /tables/rooms` (gh_api) returns the computed value inline. Convert back; confirm the
  seed units are restored.

## Risks / watch-items

- **The guard is the sharp edge now.** The effective-units rule has five legs (matrix above) —
  implement it once in the shared helper with the matrix as table-driven tests, not twice
  inline. Both former copies (`bundle.py`, `type_conversion.py`) must route through it.
- **Tri-state wire semantics (D12).** JSON has no absent-vs-null distinction in naive Pydantic
  defaults — pick the mechanism deliberately (sentinel default or clear-flag) and test all
  three states end-to-end.
- **Step-5 always-run (D14)** re-parses the stored source on every formula-target bundle —
  confirm no observable side effects for a no-op re-parse (audit noise, fingerprint churn).
