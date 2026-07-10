# PRD — Formula fields with units (convert a fixed-unit number field into a formula)

```
DATE:    2026-07-09
TIME:    13:38 EDT
STATUS:  COMPLETE (2026-07-09) — implemented as designed (Option B; guard redesign §5.1,
         wire transport §5.2, edge cases §7.12-7.16, export-first §9). On branch
         feature/formula-field-units, not yet merged to main.
AUTHOR:  Ed + Claude
SCOPE:   Custom-field schema-mutation pipeline (Rooms + all FieldDef tables), backend + frontend.
RELATED: README.md; STATUS.md
```

> **Purpose of this doc:** record the use-case, map the exact current behavior, lay out the
> design space with a recommendation, and enumerate every edge case / guard that a future
> implementer must handle. It stops short of committing an implementation because the central
> design choice (§4) is Ed's to make.

---

## 1. The use-case (Ed's words, lightly framed)

> "I'm working in the ROOMS table. It has a 'Supply Air Flow' rate (CFM ↔ M³/h). I can type
> numbers in fine. But sometimes I want to turn this field into a **formula** — add a new
> field or two and make 'Supply Air Flow' the **sum** of them. That's a common case. Today,
> changing the field type from number → formula errors with *'Fixed unit config cannot be
> edited.'* I should be able to turn these into formula fields. Maybe we gate that the input
> fields are the same unit type — fine — but the conversion should be allowed."

Concrete target workflow:

1. Add two custom number fields with **airflow** units, e.g. "Supply — bedrooms",
   "Supply — baths".
2. Convert the built-in "Supply airflow rate" from `number` → `formula`.
3. Author `{Supply — bedrooms} + {Supply — baths}` as the source.
4. The column keeps showing airflow, honoring the global SI/IP toggle (e.g. `120.0 cfm`
   or `203.9 m³/h`), now **computed** instead of typed.

The value proposition dies if step 4 renders a bare `203.9` with no unit.

---

## 2. Two-part root cause

### 2a. The fixed-units guard blocks the write

Both schema-mutation entry points run the same check *before* the conversion matrix and
*before* the field-type-locked check:

```python
# backend/features/project_document/mutations/bundle.py:80
# backend/features/project_document/mutations/type_conversion.py:276
if _number_units_are_fixed(existing) and existing.config.get("units") != after.config.get("units"):
    raise api_error(..., "custom_field_fixed_units_locked", "Fixed unit config cannot be edited.", ...)
```

- `_number_units_are_fixed(existing)` is `True` for `supply_airflow_m3h` (`units.mode == "fixed"`).
- When converting to `formula`, the frontend builds `after.config` starting from an **empty**
  bag and never re-adds `units` (`customFieldMutations.ts:440`, `:462-464`), so
  `after.config.get("units")` is `None`.
- `fixed_dict != None` → **True → error**, even though `(number → formula)` is a legal
  `discard_then_author` transition and the field is not type-locked.

The guard's *intent* is legitimate: stop a fixed-unit built-in from having its unit config
silently mutated (airflow → length, `fixed` → `editable`, precision drift) — because the
field's unit is part of its meaning and travels downstream into the PH energy model. The
bug is that the guard treats **"units removed because the field is leaving number-hood"**
the same as **"units illegally edited on a still-number field."**

### 2b. Formula fields carry no units — so the result has no unit display

`apply_set_formula` **replaces** the entire config with a fixed shape:

```python
# backend/features/project_document/mutations/formula_ops.py:196-199
new_config = {"source": ..., "ast": ..., "deps": [...], "result_type": infer_result_type(resolved)}
```

There is no `units` slot, and `validate_number_config` actively rejects `units` on any
non-number field (`custom_fields.py:136-137`). Downstream:

- Backend evaluates formulas into a per-row **computed overlay** `rows_computed`
  (`rooms.py:403`, `evaluate_table_formulas`). Values are the raw arithmetic result.
- Frontend maps a formula FieldDef to `{computed_type: result_type === "number" ? "number" :
  "text"}` and **never sets `numberUnits`** (`useTableSchema.ts:235-252`).
- `formatDisplayCellValue` unit-formats **only** `number` fields with `numberUnits`; a
  formula value falls through to `formatClipboardValue` — raw string, **no conversion, no
  suffix, no SI/IP toggle** (`lib/rows/format.ts:8-25`). `ComputedCell` can apply a flat
  `numberPrecision` but knows nothing about unit type or system.

**Net:** unblocking 2a without addressing 2b yields an airflow column that shows unit-less
SI numbers and ignores the unit toggle. That is not the feature Ed asked for.

---

## 3. Key facts that make the design tractable

- **Stored number values are canonical SI.** A number-with-units field stores the SI value
  (`supply_airflow_m3h` = m³/h); IP is a display/parse-time conversion only
  (`numberUnits.ts` convert helpers; `airflow.ts` `m3hToCfm`/`cfmToM3h`). The formula
  evaluator reads the **stored SI** value. So `{A} + {B}` where both are airflow SI values
  produces an airflow SI value — arithmetically correct with **no unit math in the engine**.
  A formula's output unit is therefore purely a **display** concern, identical to how a
  number field already works.
- **`supply_airflow_m3h` is not a typed RoomRow column.** Its value lives in
  `custom_values` (typed columns are only `id/floor_level/building_zone/icfa_factor/
  catalog_origin/notes`, `rooms.py:551-561`). Converting it to a formula does **not** strand
  a typed column — this is exactly why it is *not* in `field_type_locked_keys` while
  `icfa_factor` (typed) is.
- **A formula already ships in Rooms.** `record_id` ("Display Name") is a built-in `formula`
  (`concat({Number}, " — ", {Name})`) whose own description says "edit the formula or change
  the type to enter values directly." Formula ⇄ type changes are an established pattern.
- **`number → formula` is `discard_then_author`** (`models.py:100`): every non-empty stored
  cell is discarded and the user authors a fresh source; destructive, `acknowledge_destructive`
  required. (Today the fixed-units guard fires *before* this ack path is ever reached.)

---

## 4. The central design decision (Ed's call)

**Does a formula field get to carry a "display unit," or not?**

### Option A — "Just unblock" (minimal)
Relax the guard so `fixed-unit number → formula` is allowed; formula result renders as a
bare number (optionally with flat precision). Small change, no schema addition.
- **Pro:** tiny; ships in one phase.
- **Con:** the airflow column loses CFM/M³h formatting and the SI/IP toggle. Fails the
  stated use-case's step 4. Reverse (formula → number) can't restore units either.

### Option B — "Unit-aware formula" (recommended)
Let a formula field carry an optional `units` display config (same shape as number units),
valid only when `result_type == "number"`. The computed numeric result formats through the
existing unit path (SI/IP toggle, precision, suffix), exactly like a number field.
- **Pro:** actually delivers the use-case; symmetric with number fields; reuses the entire
  existing unit registry + format helpers; makes formula ⇄ number round-trips unit-stable.
- **Con:** touches the config schema, `validate_number_config`, the conversion carry-forward,
  and the frontend display/mapping path. Bigger, but bounded.

**Recommendation: Option B, with unit carry-forward on the conversion.** When a number field
with units (fixed *or* editable) is converted to a formula, **carry its `units` blob forward**
as the formula's display units instead of dropping it. For the built-in airflow case this
also means the guard passes naturally (`existing.units == after.units`) and the airflow
meaning is preserved. Plain number fields (no units) → formula behave exactly as today
(no display units). This is the smallest design that satisfies "turn Supply Air Flow into
a sum and keep it airflow."

### 4a. The output unit is a free-choice DISPLAY LABEL — not derived, not validated

The tempting rule "a formula may only combine fields of the same unit type" is **both wrong
and insufficient**, and these real cases prove it:

- `{Supply airflow at 75% fan speed} / 0.77` — airflow ÷ a **dimensionless** constant =
  airflow. There is no "same unit type across operands" here at all; one operand has no unit.
- `{Wattage} / {Airflow CFM}` — W ÷ (m³/h) = Wh/m³ = **`electric_efficiency`** (which the
  registry already carries: `{si: wh_m3, ip: w_cfm}`). The result **morphs** into a third
  unit type that neither input has.

The unit system has **no dimensional algebra** — it cannot compose or morph unit types — so
any attempt to *derive* or *validate* a formula's output unit from its inputs is doomed.
The design deliberately does **none** of that. Instead:

> **A formula that returns a number may carry an optional output display-unit, chosen freely
> by the user from the registry. It is a formatting label — SI/IP toggle, precision, suffix —
> fully decoupled from the inputs, never derived and never validated against them. Same trust
> model as the user typing a raw number: pick the right one and it's right.**

Why this is correct, not just convenient: the engine computes on **canonical-SI** stored
values, so `{Wattage}/{Airflow}` genuinely produces the SI base of `electric_efficiency`
(Wh/m³). If the user tags the formula `electric_efficiency`, the SI display is exact and the
IP toggle converts Wh/m³ → W/cfm correctly *because the value really is Wh/m³*. The one
footgun — a user tagging an output unit whose SI base doesn't match the arithmetic — yields a
wrong IP conversion, exactly as a mistyped number yields a wrong value. That is an acceptable,
user-owned risk, not something the app polices. This collapses the feature's complexity: the
hard part I first worried about (unit validation) is **deleted**, not solved.

**Corollary — unit-less fields are raw scalars, and a literal and a field are identical to the
engine.** The evaluator is unit-blind: it reads each ref's **stored** value and does raw
arithmetic. A number field with no units (the default; e.g. iCFA, People) contributes its
stored value verbatim with no SI/IP transform — so a `{Factor}` field holding `0.77` behaves
*exactly* like the literal `0.77` in `{Supply airflow at 75%} / {Factor}`; the result is
still airflow. Consequences:
- No rule requires a field (or a formula's inputs) to have units. A dimensionless coefficient
  is *correctly* modeled as a unit-less field; giving it a unit type would be the mistake.
- **Toggle-invariance:** because refs resolve to stored SI, the computed result is identical in
  SI and IP view. Even a *mis-united* `{Factor}` wouldn't corrupt the math — only that field's
  own cell would render converted; the formula reads the stored value, not the display.
- Promoting the constant to a field buys **per-row variation** (a different factor per room)
  — that's the practical reason to do it, not a semantic difference.
- Same footgun boundary as literals: `{airflow} + {Factor}` (adding a dimensionless where the
  dimension matters) computes happily and mislabels — identical risk to `{airflow} + 0.77`.
  Not policed; correct data entry is the user's.

The rest of this PRD specifies **Option B** under this free-choice-label rule. If Ed picks
Option A, only §5.1 (guard relax) and §7's destructive-ack item apply; the rest is deferred.

---

## 5. Behavior specification (Option B)

### 5.1 Redesign the fixed-units guard — effective-units rule (D13)

> **Revised by the 2026-07-09 review.** The first draft scoped the guard to
> `after.field_type == number`, which (a) blocked `formula(fixed) → number` — and therefore
> **undo** of the forward conversion — because the client sends no units on a type change and
> the D6 carry-back seeding runs *after* the guard; and (b) silently dropped **all** backend
> enforcement of `fixed` once the field was a formula (a formula→formula units retag would
> pass; only the modal's disabled controls would protect it, and MCP / raw API bypass the
> modal). Note `_number_units_are_fixed` checks only `config.units.mode` — once formulas
> carry fixed units it is true for formula fields too, so the guard's reach changes whether
> you plan for it or not.

The guard fires iff the existing field has fixed units **and the *effective* after-units
differ from the existing units**, where effective = the explicit units in the request if
provided (config `units` for a number target; top-level `display_units` for a formula
target, §5.2), else *the units the server will carry/seed* (= existing units on
number ⇄ formula conversions and same-type formula edits). Conversions of a fixed-unit
field to any **other** type (text, url, …) stay rejected — the same protection the old
guard provided incidentally (D13). Full behavior matrix in `phases/phase-02-backend.md`.

The guard is currently **duplicated verbatim** in `bundle.py:80` and
`type_conversion.py:276` (as is `_number_units_are_fixed`): extract one shared helper and
route both sites through it. (Do **not** loosen the *separate* `field_type_locked_keys`
guard — floor/zone/iCFA/space-type stay type-locked.)

### 5.2 Formula config gains an optional display-units slot; units travel top-level on the wire
`apply_set_formula` currently rebuilds config as `{source, ast, deps, result_type}`. It must
**preserve** an existing display-units blob across a source edit, and the config schema must
permit it:

- Reuse the number `units` shape (`mode/unit_type/si_unit/ip_unit/precision_si/precision_ip`)
  under the same `units` key on the **stored** formula config (D4), so the frontend
  `formatNumberUnitsDisplay` path is shared verbatim.
- Extend `validate_number_config` so `units` is valid on a `formula` field
  **iff `result_type == "number"`**; still rejected on text/url/etc. and on a formula whose
  `result_type` is `text`/`bool`. (Coherent for stored configs: `set_formula` always writes
  `result_type`.)
- **Wire transport (D12, from the 2026-07-09 review):** the client must NOT put `units` inside
  a formula target's `after.config`. `EditFieldBundleMutation.after` is a `TableFieldDef`
  whose `validate_config` runs **at request parse** — a formula config with `units` and no
  `result_type` (server-owned; never sent by the client) 422s before the bundle runs. Instead
  the bundle mutation gains a **top-level tri-state `display_units` field**, mirroring the
  existing `formula_source` precedent (which is top-level for exactly this reason): absent →
  carry forward existing units; explicit clear → bare number; provided → set/retag.
- On conversion `number(units) → formula`, the server carries the source field's `units`
  forward into the formula config (the absent-branch default). `mode` carries too: a `fixed`
  built-in stays `fixed` (unit not user-editable on the formula either); an `editable` field's
  output unit stays editable in the modal.
- **The output unit is a free user choice (§4a), not derived from the formula.** After the
  carry-forward default, an `editable`-mode formula lets the user set *any* registry unit-type
  as the output (e.g. change the `{Wattage}/{Airflow}` field's display to `electric_efficiency`),
  or clear it (`mode`/`units` absent → bare number). No dep inspection, no unit inference.
- **The set_formula reconciliation runs on every formula-target bundle (D14)**, not only when
  the source changed — otherwise a rename-only bundle (whose config no longer carries units
  per D12) would drop the units at the field-replace step, and a units-only retag (source not
  dirty → client sends no `formulaSource`) would silently vanish.

### 5.3 Display path
- `useTableSchema` maps a formula FieldDef with a display-units blob AND `result_type ==
  "number"` to `numberUnits`, so the existing `number`-with-units branch in
  `formatDisplayCellValue` handles it — SI/IP toggle, per-system precision, suffix.
- `ComputedCell` (or the cell chooser) routes number-with-units formula results through
  `formatNumberUnitsDisplay(valueSi, config, unitSystem)` rather than the flat
  `numberPrecision` path.
- The computed value is still read-only (it's a formula) — units affect **display only**,
  never entry.

### 5.4 Reverse conversion `formula → number`
`formula → number` is `lossy` today and lands a bare number field. Under Option B, if the
formula carried display units, carry them back onto the resulting number field so a
`number(units) → formula → number` round-trip preserves the unit (and the built-in airflow
field can be restored to its seed config). Precision follows the units. The §5.1 guard's
effective-units rule treats the absent-units carry-back as legal — this is what makes
**undo of the forward conversion** work; the client sends no units on a type change.

### 5.5 Adding the input fields
No new work: the modal already supports authoring custom **number fields with units**
(`FieldConfigSectionNumberUnits.tsx`). The user creates airflow-unit input fields the normal
way; only the *sum-target* conversion is new.

---

## 6. What is explicitly out of scope (for v1)

- **Unit-type validation of formula dependencies** ("all refs must share a unit type"). Killed
  by design (§4a), not merely deferred: the rule is *wrong* (`airflow / 0.77` has a unitless
  operand) and *insufficient* (`{Wattage}/{Airflow}` morphs to a type neither input has). The
  unit system has no dimensional algebra, so there is nothing correct to validate against. A
  soft best-effort warning for the trivial pure-`+`/`-`-over-direct-refs case is a *maybe*
  (Open Question 4), but the default is **no validation at all**.
- **Auto-deriving / morphing the formula's output unit from its refs.** The output unit is a
  free user display-choice (§4a): defaulted by carry-forward on conversion, then any registry
  unit-type (or none) for `editable` formulas. The app never infers or composes it.
- **Unit-aware arithmetic in the evaluator.** Not needed; SI-canonical storage makes the raw
  arithmetic land on the correct SI base already. The output unit is display-only.

---

## 7. Edge cases & guards (implementer checklist)

1. **Two orthogonal locks — do not conflate.** `field_type_locked_keys` (floor/zone/iCFA/
   space-type) is separate from the fixed-units guard. Only the *fixed-units* guard blocks the
   airflow fields. The §5.1 relax must not weaken the type-locked guard.
2. **Guard ordering.** The fixed-units check currently precedes the conversion-matrix and
   locked-key checks. Ensure the destructive-ack preflight (`custom_field_coercion_preflight_
   required`) is actually reachable for these fields after the relax — the user must get the
   "this clears N typed values" confirmation before the airflow cells are discarded.
3. **`result_type` must be `number` for units to apply.** A formula authored as `concat(...)`
   (text) or a comparison (bool) must not carry/keep display units. Reconcile on every
   `setFormula`: if the new `result_type != number`, strip display units (and reflect that in
   the modal). `infer_result_type` is best-effort/static — decide behavior when it can't prove
   `number` (treat non-`number` as "no units").
4. **result_type flips on a source edit.** Editing an existing unit-carrying formula from
   `A + B` (number) to a text expression must drop the units cleanly, not leave an orphaned
   `units` blob. Covered by (3)'s reconciliation.
5. **Destructive discard is real.** `number → formula` discards **all** currently-typed
   Supply-airflow values (they become computed). Existing manual entries are lost — the ack
   copy should say so plainly ("N typed airflow values will be replaced by the formula
   result").
6. **Downstream consumers read the value from a new place — RESOLVED, see Phase 1.** After
   conversion the field's value moves from `custom_values["supply_airflow_m3h"]` to the computed
   overlay `rows_computed[row]["supply_airflow_m3h"]`. Computed values are **derived-on-read,
   never persisted** (correct architecture — no staleness). MCP `get_document`/`get_table` and
   the frontend **already** surface `rows_computed`; the **only** consumer that drops computed
   values is the Grasshopper tabular export (`gh_api/tables_export.py:19-20`, a pre-logged gap:
   *"No computed/formula values — raw stored fields only"*). So this is not an external
   unknown — **Phase 1 makes that exporter emit computed values** (~25-40 LOC, all tables) and
   lands *before* the guard relax, which removes the need to lock any built-in at all (§7.16).
   See `phases/phase-01-export-computed-values.md`.
7. **Fixed vs editable output unit on the formula.** A `fixed` built-in (airflow) should keep
   `mode: fixed` on the formula so the unit can't be silently retargeted; an `editable` source
   field's output unit stays editable. The modal's fixed-controls-disabled logic
   (`FieldConfigSectionNumberUnits.tsx`, `fixed` prop) should extend to formula display units.
8. **Precision.** `precision_si`/`precision_ip` carry with the units and must reach the
   computed-cell formatter (which today only knows a single flat `numberPrecision`).
9. **Backend/frontend unit-registry drift (pre-existing) — promoted to a Phase-2
   prerequisite.** Frontend `NUMBER_UNIT_TYPES` has entries (`power`, `length_mm`) absent from
   backend `NUMBER_UNIT_REGISTRY`; a field authored with those passes frontend validation but
   is rejected by `validate_number_config`. Not caused by this feature, but D11 hands formulas
   the **full unit-type picker**, making the drift much easier to hit than today — close it
   (add to backend registry, or hide in the picker — O4) plus a shared snapshot test
   (frontend ⊆ backend) before the picker ships on formulas.
10. **Schema fingerprint / cycle / deps unchanged.** Conversion changes `field_type` + config,
    so the schema fingerprint changes (expected). Formula cycle-checking, `deps`, and the
    linear-history save model are unaffected — a formula summing sibling fields is an ordinary
    dependency graph.
11. **Keep the frontend `typeConversionMatrix.ts` and backend `CONVERSION_MATRIX` in sync** —
    no matrix entries change (both already have `number → formula = discard_then_author`), but
    the carry-forward config logic lives in `buildNextConfigForFieldTypeChange` and must be
    updated in lockstep with the backend guard.

The following five entries came out of the 2026-07-09 pre-implementation code review
(verified against the code, not hypothetical):

12. **Wire-parse validation kills any in-config units payload (D12).**
    `EditFieldBundleMutation.after` is a `TableFieldDef` (`models.py:288`) and
    `validate_config` is a `model_validator(mode="after")` (`custom_fields.py:225`) — it runs
    when the request parses, *before* `bundle.py:80`. A formula-target
    `after.config = {source, units}` carries no `result_type` (server-owned) and would 422 at
    the model boundary; the bundle's careful step-4/step-5 threading never gets a chance.
    Units must travel as a **top-level mutation field** (like `formula_source`, which is
    top-level for exactly this reason). The frontend strips `units` from formula configs
    unconditionally.
13. **The reverse conversion — and undo — must pass the guard.** `_number_units_are_fixed`
    checks only `config.units.mode` (`bundle.py:280`), so once formulas carry fixed units it
    is true for them too. A guard scoped to `after.field_type == number` fires on
    `formula(fixed) → number` because the client sends no units on a type change
    (`buildNextConfigForFieldTypeChange` starts from `{}`) and the D6 seeding runs *after*
    the guard — blocking both the round-trip and **undo of the forward conversion**. The
    effective-units rule (§5.1) treats the absent-units carry-back as legal.
14. **Fixed-unit enforcement must survive on formula fields.** With a number-scoped guard, a
    `formula(fixed) → formula` edit retargeting `units` passes backend validation entirely —
    only the modal's disabled controls protect it, and MCP / raw API bypass the modal. The
    effective-units rule rejects a changed `display_units` on a fixed formula (§7.7's intent,
    now enforced server-side).
15. **A units-only retag must actually persist.** `handleSave` sends `formulaSource` only when
    the source draft is dirty (`FieldConfigModal.tsx:486`), and bundle step 5 short-circuits
    on `formula_source is None` (`bundle.py:221`) — so the flagship
    `{Wattage}/{Airflow} → electric_efficiency` retag (units dirty, source untouched) would
    be silently dropped once step 4 stops carrying units (D12). Fix is backend-side (D14):
    step 5 reconciles on **every** formula-target bundle, defaulting the source to the stored
    one. Robust for all clients; the frontend does not force-send the source.
16. **The guard relax exposes 18 fixed-unit built-ins across 8 exported tables — order the
    phases accordingly.** `appliances`, `fans`, `hot_water_tanks`, `hot_water_heaters`,
    `pumps`, `ventilators`, `rooms`, `thermal_bridges` all carry `mode: "fixed"` built-ins,
    and **only Rooms has a `field_type_locked_keys` list** — the originally-planned interim
    lock on the two Rooms airflow fields would leave ~16 others convertible while the GH
    export still dropped computed values (silent empty values into the energy model). The
    export fix is smaller than any lock (~25-40 LOC), so it lands **first** (Phase 1) and no
    lock is ever needed (D8 revised).

---

## 8. Open questions

*Resolved (now in `decisions.md`):* Option B accepted (D1); reuse the `units` key gated on
`result_type == "number"` in the *stored* config (D4); the export path is an in-repo change
that lands first (D8 revised / §7.6 / §7.16); hard/soft unit-validation killed (D2/D3); export
wire shape = inline (D10); formula display-unit UI reuses the number units section, relabeled
"Display units" (D11); units travel top-level on the wire (D12 / §7.12); fixed-unit fields
convert only number ⇄ formula under the effective-units guard (D13 / §7.13-14); set_formula
reconciliation runs on every formula-target bundle (D14 / §7.15).
Remaining live questions:

1. **Confirm the honeybee-ph GH client** reads a formula field's inline value from the exported
   record (Phase-1 touchpoint — shape choice, not a blocker).
2. **Should the two built-in airflow fields ship a *default* formula** (like `record_id` does),
   or stay plain number until a user opts in? (Likely stay plain; opt-in only.)

---

## 9. Phase sketch (Option B — detailed plans in `phases/`; reordered 2026-07-09, §7.16)

- **Phase 1 — Export computed values** (`phases/phase-01-export-computed-values.md`). Make the
  Grasshopper export (`gh_api/tables_export.py`) emit computed/formula values (~25-40 LOC, all
  tables). Standalone, lands **first**: the Phase-2 guard relax exposes 18 fixed-unit built-ins
  across 8 exported tables, and with the export already correct no built-in ever needs an
  interim conversion lock.
- **Phase 2 — Backend** (`phases/phase-02-backend.md`). Close the unit-registry drift (§7.9);
  redesign the guard on the effective-units rule (§5.1, D13); top-level `display_units` wire
  field (§5.2, D12); allow `units` on formula when `result_type == number`; carry units forward
  on `number → formula` and back on `formula → number` (§5.4, D6); set_formula reconciliation
  on every formula-target bundle (D14) with result_type reconciliation (§7.3-4). No built-in
  lock — Phase 1 already landed.
- **Phase 3 — Frontend** (`phases/phase-03-frontend.md`). Map formula+units → `numberUnits` in
  `useTableSchema`; route computed number cells through `formatNumberUnitsDisplay`; add the
  (fixed-aware) display-unit section to the modal; top-level `displayUnits` payload (D12) —
  `buildNextConfigForFieldTypeChange` keeps stripping `units` from formula configs.
