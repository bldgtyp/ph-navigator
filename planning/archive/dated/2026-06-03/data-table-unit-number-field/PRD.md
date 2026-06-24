---
DATE: 2026-06-03
TIME: 16:42 EDT
STATUS: CONFIRMED FEATURE PRD - ready for phased implementation
        planning
AUTHOR: Codex
SCOPE: Extend the shared DataTable Number field with an optional,
       complete SI/IP unit configuration. Values remain backend/API
       canonical SI numbers; unit conversion is frontend display/input
       behavior only.
RELATED:
  - context/technical-requirements/data-table.md
  - planning/features/ip-si-unit-switching/PRD.md
  - frontend/src/lib/units/
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - frontend/src/shared/ui/data-table/lib/coerceCustomFieldType.ts
  - frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/mutations/models.py
  - backend/features/project_document/mutations/type_conversion.py
---

# DataTable Number With Units PRD

## 1. Intent

Extend the existing DataTable Number field so a user can optionally add
a complete SI/IP unit configuration from the edit-field dialog. When
units are configured, the field behaves as "Number with Units": the
global application unit preference controls how committed cell values
are shown, while the stored value remains the same scalar number.

The core contract is unchanged from the IP/SI foundation:

- backend storage, REST, MCP, downloads, calculations, and validation
  remain SI canonical;
- conversion is frontend display/input behavior only;
- switching the global `SI` / `IP` preference never dirties the project
  document and never rewrites table cell values.

This feature is for values such as material density, material
conductivity / lambda, length, area, volume, airflow, U-value, or
psi-value that are currently awkward as plain dimensionless numbers.

## 2. Field Type And User-Facing Model

Do not add a separate user-facing type up front.

The user creates or converts to a normal `number` field exactly as they
do today. In the edit-field dialog, the Number configuration gains an
optional "Add units" control. Once a complete unit configuration is
present, the field is described in the UI as:

```text
Number with Units
```

Use `number` for dimensionless values: counts, ratios, indexes,
factors, voltage, phase, and other values where SI/IP switching should
not affect display.

Use Number with Units for unitized numbers whose displayed unit can
change under the global SI/IP preference.

Implications:

- the type picker still exposes `Number`, not a second numeric type;
- adding/removing units is a Number field-config edit, not a field-type
  change;
- changing `number -> text/single_select/formula` works through the
  existing type-change pipeline and drops the unit config;
- changing `text/single_select/formula -> number` creates a normal
  Number field first; the user may then add units in the same edit
  dialog if the implementation supports bundled edits, or in a follow-up
  edit.

## 3. Value Contract

Stored cell values remain:

```text
number | null
```

`null` is a first-class value. Clearing a cell writes `null`, matching
the existing nullable number-field behavior. Blank paste/input commits
`null` unless a future required-field contract explicitly rejects the
clear.

The backend should validate only that stored values are numeric or
null. It should not convert values for a user preference.

## 4. Field Config Contract

A Number field may carry no unit metadata, or a complete unit
configuration. Incomplete unit configurations are invalid.

Working config shape:

```json
{
  "precision": 2,
  "units": {
    "mode": "editable",
    "unit_type": "length",
    "si_unit": "m",
    "ip_unit": "ft",
    "precision_si": 2,
    "precision_ip": 2
  }
}
```

Rules:

- Existing Number fields without unit metadata keep the existing config
  shape and behavior.
- `config.precision` remains the existing plain Number precision and
  fallback.
- A unitized Number carries unit metadata under `config.units`.
- A `config.units` object must have all required fields: `mode`,
  `unit_type`, `si_unit`, `ip_unit`, `precision_si`, and
  `precision_ip`.
- Partial configs must not be saved.
- `precision_si` and `precision_ip` are separate because SI and IP
  values often need different visible precision.
- `mode: "editable"` means the user can change/remove the unit config.
- `mode: "fixed"` means the field is a feature-owned domain/catalog
  field whose unit config renders in the UI but cannot be changed by
  the user.
- `unit_type`, not "quantity", is the compatibility key. It names the
  family of unitized number, for example `length`, `density`, or
  `conductivity`.
- `si_unit` and `ip_unit` must belong to the same `unit_type`.
- The selected `si_unit` is the canonical unit for the stored numeric
  value in this field.
- The selected `ip_unit` is the display/input unit used when the global
  preference is `IP`.

The frontend should offer unit choices from a closed registry, not free
text. Free-text unit strings create typo, compatibility, and conversion
ambiguity. The backend may accept only known unit identifiers so stored
field definitions stay clean.

## 5. Critical Semantics: Changing The Field's Units

Changing `si_unit` or `ip_unit` is a field-configuration change. It must
not rewrite any existing cell values.

Example:

```text
Existing config: unit_type=length, si_unit=mm, ip_unit=in
Stored value: 1000
SI display: 1000 mm
IP display: 39.37 in

User changes si_unit from mm to m.
Stored value remains: 1000
SI display becomes: 1000 m
IP display becomes: 3280.84 ft, if ip_unit=ft
```

This is an accepted product decision. Same-system unit changes preserve
the user's visible cell numbers. Changing `mm` to `m` keeps a cell
showing `1000` in SI mode. This is the simplest user mental model:
field unit configuration changes the unit label / conversion contract,
not the existing cell values.

Tradeoff: this can materially change the physical meaning of existing
records if the user expected rescaling. The UI should make clear that
changing the configured unit does not convert existing cells.

## 6. Global Unit Toggle Behavior

When the global preference is `SI`:

- display the stored value in `config.si_unit`;
- parse bare numeric input as `config.si_unit`;
- if no unit config exists, display/parse as a plain number.

When the global preference is `IP`:

- display the stored SI value converted from `config.si_unit` into
  `config.ip_unit`;
- parse bare numeric input as `config.ip_unit` and convert back into
  the stored `config.si_unit`;
- if no unit config exists, display/parse as a plain number.

Switching the global preference:

- re-renders committed cells immediately;
- does not refetch data;
- does not create a draft;
- does not change stored values;
- must not rewrite an active inline editor's draft text under the
  cursor. On commit, parse the draft under the editor's visible unit
  context.

## 7. User Stories

### US-QTY-1: Add units to a Number field

As an editor, I can create a normal Number field and then add a complete
unit configuration from the edit-field dialog.

Acceptance criteria:

- default value is `null`;
- no unit config is selected by default;
- the field behaves exactly like the existing Number field until units
  are added;
- once I select a unit type, the SI and IP unit pickers show compatible
  units only;
- the dialog cannot save a partial unit config;
- saving the field config does not require any row edits.

### US-QTY-2: Edit values in the active unit system

As an editor, I can edit a Number with Units cell in the unit system I am
currently viewing.

Example:

- field config is `length`, `si_unit=m`, `ip_unit=ft`;
- stored value is `1`;
- IP mode displays `3.28`;
- editing the cell to `6.56` writes `2` to the stored SI value.

Acceptance criteria:

- clearing the cell writes `null`;
- invalid numeric input is rejected before write;
- committed value stored in the project document is numeric SI;
- backend receives no display-unit hint.

### US-QTY-3: Switch global display units

As a viewer or editor, I can switch the global app preference between
SI and IP and see Number with Units cells re-render in the configured
units.

Acceptance criteria:

- plain Number fields do not change;
- Number fields without unit config do not change;
- Number with Units fields re-render;
- draft dirty state is unchanged.

### US-QTY-4: Change a field's type

As an editor, I can change a Number with Units field to existing
DataTable types, or change another field type into Number.

Acceptance criteria:

- adding/removing units from a Number field preserves stored numeric
  values and does not invoke the type-change preflight;
- `short_text/long_text/formula -> number` follows the existing lossy
  numeric coercion policy;
- `number -> short_text/long_text` is lossless text formatting of the
  stored canonical number, not the current display-unit value;
- `single_select -> number` substitutes labels and numeric-coerces as
  today;
- `number -> single_select` remains allowed through the existing Number
  conversion behavior; unit information is dropped;
- type changes that clear incompatible cells use the existing preflight
  acknowledgement flow.

### US-QTY-5: Change only the units

As an editor, I can change the Number field's SI/IP unit config after
values exist.

Acceptance criteria:

- no cell values are rewritten;
- no type-change preflight is required;
- persisted filters for that field are invalidated because their stored
  numeric thresholds may no longer mean the same thing after a unit
  config change;
- formula dependencies and row values continue to point at the same
  field key.

### US-QTY-6: Copy, paste, fill, filter, sort, and aggregate

As an editor, I can use the normal DataTable operations on Number with
Units fields.

Acceptance criteria:

- sort compares stored canonical numeric values;
- numeric filters use the same behavior as Number for MVP; changing the
  unit config invalidates existing filters on that field;
- fill copies the stored numeric value;
- paste preflights the full range before committing;
- aggregations operate on stored numeric values, then render the result
  as bare numbers in the active display unit.

## 8. Initial Unit Roster

Use the existing `frontend/src/lib/units/` foundation as the source for
first supported quantities.

MVP roster, driven by the upcoming Material table:

| Unit type | SI units | IP units | Notes |
|---|---|---|---|
| `density` | `kg/m3` | `lb/ft3` | Material fields. |
| `conductivity` | `W/(m-K)` | `Btu/(h-ft-F)` | Material lambda values. |
| `length` | `m` | `ft` | Generic table fields; mm/in and ft-in formats deferred. |
| `area` | `m2` | `ft2` | Straight factor conversion. |
| `volume` | `m3` | `ft3` | Straight factor conversion. |

Deferred roster:

- `u_value`: `W/(m2-K)` <> `Btu/(h-ft2-F)`;
- `r_value`: `m2-K/W` <> `h-ft2-F/Btu`;
- `linear_psi`: `W/(m-K)` <> `Btu/(h-ft-F)`;
- `specific_heat`: `J/(kg-K)` <> `Btu/(lb-F)`;
- `airflow`: `m3/h` or `m3/s` <> `cfm`;
- `temperature`: `deg C` <> `deg F`;
- pressure and power/capacity.

These are plausible next additions, but should wait until a real table
needs them.

## 9. Backend Requirements

Backend requirements are intentionally about schema validation, not
conversion:

1. Keep `CustomFieldType.number` as the persisted field type.
2. Keep `CustomValue` unchanged.
3. Validate Number row values as today: finite number or `null`.
4. Validate optional `TableFieldDef.config` unit metadata for known
   unit identifiers and complete, compatible unit pairs.
5. Reject partial unit configs.
6. Preserve existing schema mutation behaviors: add, rename, duplicate,
   delete, set description, edit bundle, change type.
7. Changing a field away from `number` strips unit config.
8. Changing unit config invalidates persisted filters for that field.
9. Do not add backend preference branches, request headers, or unit
   conversion code.

## 10. Frontend Requirements

Frontend requirements:

1. Leave the authorable type picker as `Number`.
2. Extend Number field config with an "Add units" / "Remove units"
   section.
3. When units are present, describe the type summary as
   "Number with Units".
4. Extend the field config modal with a Units section:
   - unit type selector;
   - SI unit selector;
   - IP unit selector;
   - SI decimal precision;
   - IP decimal precision.
5. Add a unit registry that can convert between the field's selected
   `si_unit` and `ip_unit`. Existing helpers are unit-type-specific but
   not yet a general registry for arbitrary user-selected unit pairs.
6. Render the active unit in the field header only.
7. Render cells as bare numbers with no unit suffix.
8. Parse edits, paste values, and numeric filter inputs as bare numbers
   in the active display unit and convert to the stored SI unit before
   writing.
9. Keep active editor draft text stable across a global unit toggle.
10. Keep plain `number` behavior unchanged.

## 11. Table Semantics

### Nulls

`null` displays as the table's standard empty-cell state. It does not
display as `0`.

### Sorting

Sort by stored numeric value. Do not sort by formatted text.

### Filtering

MVP keeps existing Number filter behavior for the active display value.
When the field's unit config changes, invalidate persisted filters for
that field. This avoids preserving thresholds that now mean something
different.

### Aggregation

Aggregate stored numeric values first, then format the aggregate in the
active display unit. Keep existing Number aggregation options,
including `sum`, for MVP.

### Grouping

Exact numeric grouping on high-precision physical quantities is rarely
useful. v1 can allow the existing exact grouping behavior, but rounded
or bucketed grouping should be deferred.

### Clipboard

MVP clipboard behavior remains number-like:

- copy bare displayed numbers, with no unit suffix;
- paste bare numbers in the active unit system;
- do not parse explicit suffixes in MVP.

Explicit suffix parsing such as `2 in`, `50 mm`, and
`0.035 Btu/(h-ft-F)` is desirable but deferred.

Downloads and API/MCP reads remain SI canonical and are not the same as
clipboard copy.

## 12. Formula Semantics

Formula fields should read a Number with Units field as the stored
canonical number. Formula evaluation remains backend/SI.

Do not add formula unit algebra in this feature. A formula result of
type `number` stays dimensionless unless a later feature adds a typed
formula result with unit metadata.

Converting `formula -> number` should keep the existing snapshot
behavior. Unit config can then be added to the resulting Number field.

## 13. What This Feature Is Not

This feature is not:

- backend-side user-preference conversion;
- a migration to IP-stored project data;
- a generic dimensional-analysis engine;
- formula unit algebra;
- per-cell units;
- unit suffixes in cell values;
- automatic rescaling when a user changes field unit config;
- a replacement for domain-specific built-in field names that already
  encode canonical units such as `width_mm` or `u_value_w_m2k`;
- a full Window Builder format system for feet-and-inches or fractions.

## 14. Built-In Physical Field Policy

The built-in physical field decision resolved from the first draft was:

> Should built-in physical fields use Number with Units, or should they
> keep typed field names like `width_mm` with render-time unit
> descriptors?

This matters because there are two different classes of table fields.

**User-created table fields** are flexible. If a user adds "Insulation
Thickness" as a Number field and then adds `m <> ft` units, the field's
unit meaning lives entirely in the field config. Same-system unit
changes do not rewrite cells. This is AirTable-like and user-editable.

**Built-in domain fields** are part of PH-Navigator's model contract.
For example, a built-in field named `conductivity_w_mk` or `width_mm`
can be used by calculations, catalog refresh, MCP, downloads, and other
feature code. Its canonical unit is encoded in the field key and should
not become ambiguous just because a user edits the display config.

Recommended policy for MVP:

- user-created Number fields may use editable unit config;
- built-in physical fields should keep canonical SI field keys and
  feature-owned unit descriptors;
- built-in physical fields may display with the same frontend unit
  registry, but fields with fixed domain/catalog meaning should expose
  fixed unit config that the user cannot redefine;
- feature authors may explicitly mark a built-in physical field as
  user-flexible when its canonical unit is not part of the domain
  contract;
- built-in dimensionless numbers such as people count, phase, voltage,
  and iCFA factor should remain plain Number fields.

For the Material table, density and conductivity should be built-in
catalog/domain fields with fixed canonical SI units. Prefer field keys
such as `density_kg_m3` and `conductivity_w_mk` plus feature-owned fixed
display descriptors. If the Material table also allows user-created
supplemental numeric fields, those can use editable Number with Units
config.

## 15. Confirmed Clarification Decisions

Resolved:

1. Same-system unit changes do not rewrite or rescale cell values.
2. Complete SI/IP unit pairs are required; partial configs are invalid.
3. Unit config is added to an existing Number field from the edit-field
   dialog rather than selected as a separate type up front.
4. User-facing label is "Number with Units".
5. Cells copy/render bare numbers; unit suffix appears in the header
   only.
6. Explicit unit suffix parsing is deferred.
7. SI and IP precision are separate config values.
8. Fractional inches / feet-and-inches are deferred.
9. Keep existing aggregation behavior, including `sum`, for MVP.
10. Changing unit config invalidates persisted filters for that field.
11. Number with Units to Single-select is allowed through the existing
    Number conversion path; unit config is lost.
12. MVP roster is density, conductivity, length, area, and volume.
13. Area is `m2 <> ft2`; volume is `m3 <> ft3`.
14. Catalog/domain physical fields may use fixed feature-owned unit
    config, especially in catalog tables.
15. The config shape uses `config.units.mode: "editable" | "fixed"`.
16. Unit config changes invalidate filters for that field and preserve
    unrelated view state.

No open PRD questions remain. Implementation plans may still choose
exact module boundaries and test ordering, but should not reopen the
product decisions above without a new decision note.

## 16. Risks And Edge Cases

- **Semantic relabeling risk.** Changing `si_unit` without row rewrites
  can make old values physically wrong if the user expected rescaling.
- **Filter invalidation.** Unit config changes need to clear persisted
  filters for that field without disturbing unrelated view state.
- **Precision drift.** A value that displays cleanly in SI may look
  noisy in IP unless precision is tracked per unit system.
- **Offset units.** Temperature cannot use factor-only conversion, and
  aggregation semantics differ from length/area/volume.
- **Reciprocal units.** `R/in` from conductivity is not the same as
  converting conductivity to another linear conductance unit.
- **Ambiguous abbreviations.** `m`, `min`, `in`, `ft`, `cfm`, and
  thermal unit strings need closed identifiers separate from display
  labels.
- **Plain number confusion.** The UI needs a clear "Add units" affordance
  so users understand that Number fields remain dimensionless until
  configured.
- **Clipboard/API mismatch.** User-facing clipboard copies bare display
  numbers while downloads/API/MCP remain SI.
- **Built-in field policy.** Some built-in fields are currently numbers
  but not physical quantities (`num_people`, `phase`, `icfa_factor`).
  These should not become unit-aware accidentally.

## 17. Acceptance Criteria For A Future Implementation

This PRD is ready for implementation planning when:

- confirmed; all PRD decisions above are accepted.

Implementation is complete when:

- users can add/remove a complete unit config on Number fields;
- Number with Units cells store only SI numeric values or `null`;
- global unit preference toggles display without draft writes;
- unit config edits never rewrite cells;
- changing unit config invalidates filters on that field;
- type-change preflight remains the existing Number authority;
- sorting/filtering/aggregation/copy/paste have tests for SI and IP;
- plain Number fields remain unchanged.
