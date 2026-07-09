# Decisions — Formula fields with units

```
DATE:    2026-07-09
TIME:    11:46 EDT
STATUS:  Accepted (design). Implementation not started.
AUTHOR:  Ed + Claude
RELATED: PRD.md (§4, §4a), phases/
```

Accepted design decisions, folded here so the phase plans can assume them. Rationale lives in
`PRD.md`; this is the short ledger.

| # | Decision | Rationale (PRD ref) |
|---|----------|---------------------|
| D1 | **Option B — unit-aware formula fields.** A formula that returns a number may carry a display-unit; it formats through the existing unit path (SI/IP toggle, precision, suffix). | §4 — Option A ships a unit-less airflow column, failing the use-case. Ed accepted B. |
| D2 | **The output unit is a free-choice display LABEL.** Never derived from, nor validated against, the formula's inputs. No dimensional algebra. | §4a — "same unit type" is both wrong (`/0.77`) and insufficient (`W÷CFM` morphs). |
| D3 | **No unit-type validation of formula dependencies** — not even a soft warning in v1. | §6, §4a — a soft warn can't cover `/literal` or morphing formulas; an inconsistent half-measure. |
| D4 | **Reuse the existing number `units` config shape and key** (`units: {mode, unit_type, si_unit, ip_unit, precision_si, precision_ip}`) on formula fields, not a new `display_units` key. Validity is gated on `result_type == "number"`. | Shares `validate_number_config` (backend) and `formatNumberUnitsDisplay` (frontend) verbatim; formula config is an open dict, so no collision. The result_type gate disambiguates the overload. |
| D5 | **Unit carry-forward on conversion.** `number(units) → formula` defaults the formula's display-unit to the source field's units; `mode` carries too (a `fixed` catalog field stays `fixed`/locked; an `editable` field stays editable). Plain unit-less number → formula stays unit-less. | §4 recommendation — smallest gesture that keeps Supply Air Flow displaying as airflow. |
| D6 | **Round-trip symmetry.** `formula(units) → number` carries the display-unit back onto the resulting number field. | §5.4 — a `number → formula → number` round-trip restores the original unit; built-in airflow fields can be reverted to seed config. |
| D7 | **Units are threaded through `set_formula`, never stashed in an intermediate field config.** `TableFieldDef.validate_config` runs on every construction; a formula config carrying `units` without a `result_type == "number"` would fail validation. So `apply_set_formula` is the single construction point that reconciles `{source, ast, deps, result_type}` **and** `units`. | Phase-01 §"Ordering gotcha". |
| D8 | **The export must EMIT computed values (in-repo), which dissolves the built-in "gate."** Computed values are never persisted (derived-on-read — correct, keep it); MCP + frontend already surface `rows_computed`; only the gh_api tabular export drops them (`tables_export.py:19-20`, a pre-logged gap). Phase-03 adds computed values to that exporter (~25-40 LOC), then unlocks the two built-in airflow fields. v1 mechanism (Phases 1-2) still ships for custom fields first. | §7.6 revised by the 2026-07-09 export investigation — the risk was one exporter omitting a trivially-computable value, not an external read-path we couldn't control. |
| D9 | **The change lives in shared data-table modules, not per-table code.** Every FieldDef table (`rooms`, `space_types`, all equipment tables, catalogs) inherits the behavior through the uniform `TableFieldRegistry` contract; no per-table wiring. | The schema-mutation pipeline, `custom_fields.py`, `formula/*`, and `shared/ui/data-table/*` are table-agnostic. |
| D10 | **Export wire shape = INLINE.** The gh_api export emits a formula field's computed value inline on the record keyed by `field_key` (no separate `computed` block). No collision — a formula has no stored cell. GH reads a formula column like any field via the passed-through `field_defs`. | Ed confirmed 2026-07-09. Zero client work if the GH side reads fields generically (its design goal). |
| D11 | **Formula display-unit UI = REUSE the number field's `FieldConfigSectionNumberUnits` verbatim** (full unit-type picker; supports selected / none / disabled-`fixed`), relabeled "Display units" + a one-line hint ("Formats the computed result; applies to numeric formulas"). No bespoke "keep/clear/change" control. | Ed's lean 2026-07-09. One units UX across number + formula (uniformity iron-law); the retag case (`W÷CFM → electric_efficiency`) needs the full picker anyway; least code. Section shown for formula fields; backend authoritative on dropping units for non-numeric results (D7). |

## Open (do not block Phase 1/2 on these)

- **O2 — Precision defaults** when a formula gains display-units but the source had none (only
  relevant if we later allow adding units to a from-scratch formula). Not on the conversion path.
- **O3 — Soft-hide the Display-units section for non-numeric formulas** (refinement of D11).
  Requires client-side result-type inference; v1 shows the section always and lets the backend
  reconcile. Nice-to-have, not blocking.
