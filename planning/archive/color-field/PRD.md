---
DATE: 2026-06-03
TIME: 16:24 EDT
STATUS: PRD - Open questions resolved; ready for implementation planning
AUTHOR: Codex
SCOPE: Add a nullable, user-authorable color field type to the shared
       DataTable system, persisted through the backend project-document
       field registry and rendered/edited in the frontend grid.
RELATED:
  - context/technical-requirements/data-table.md
  - context/TECH_STACK.md
  - context/CODING_STANDARDS.md
  - planning/features/editable-fields/PRD.md
  - frontend/src/shared/ui/data-table/types.ts
  - frontend/src/shared/ui/data-table/hooks/useTableSchema.ts
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/lib/coerceCustomFieldType.ts
  - frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts
  - backend/features/project_document/custom_fields.py
  - backend/features/project_document/document.py
  - backend/features/project_document/schema_mutations.py
---

# DataTable Color Field PRD

## Intent

Add a first-class `color` field type to DataTable so users can attach a
single editable color value to a record. The immediate use case is
material/product records, where a color swatch supports assembly
legends, model visualizations, and quick visual recognition.

The field is nullable. Clearing a color writes `null`.

## Storage Decision

Store colors as normalized nullable sRGB hex strings:

```text
null | "#rrggbb"
```

This is the right storage contract for PH-Navigator because:

- it matches existing single-select option colors (`#3b82f6` style);
- it is compact, stable JSON;
- it maps directly to CSS, canvas, WebGL, and most HBJSON visualization
  export paths;
- it avoids carrying a color profile problem into project documents.

CMYK should be supported only as an input/conversion UI. Do not persist
CMYK. A CMYK value cannot round-trip safely without a named color
profile and print/output intent, which is outside this feature.

Alpha is out of scope for v1. If transparency becomes necessary later,
add an explicit `color_alpha` or `color_rgba` decision rather than
overloading this field.

All current PH-Navigator color storage should converge on this contract
during implementation. Current DTO/backend fields that use ARGB-shaped
storage (`argb_color`, `(a,r,g,b)`) should be renamed away from ARGB and
migrated to normalized hex storage. Prefer semantic names such as
`color` on user-facing/domain DTOs unless a boundary needs the storage
format to be explicit.

## Naming

Use `color` for the DataTable field type.

The current table contract mentions `argb_color` as a post-v1
renderer-only type, and envelope/material DTOs still carry
`argb_color` strings such as `(a,r,g,b)`. Do not extend that as the
authorable DataTable type. Treat it as legacy shape to remove from
current DTO/backend objects during this implementation.

Recommended vocabulary:

- `CustomFieldType.color` in persisted table field definitions.
- `FieldType.color` in the renderer taxonomy.
- `ColorValue = string | null` on frontend utility APIs.
- `color` for domain DTO fields where there is only one color meaning.
- `color_hex` only at boundaries where explicitly naming the storage
  format prevents ambiguity.

## User Behavior

Users can:

- add a custom Color field from the field config flow;
- change compatible editable fields to Color through the existing type
  change pipeline;
- edit a color cell directly;
- clear a color cell to `null`;
- paste colors into color cells;
- copy color cells as their hex strings;
- use the field in built-in material records when a table declares a
  built-in `color` field.

Color editing UI:

- visible swatch button in the cell;
- native color picker affordance for fast picking;
- hex input;
- RGB channel inputs;
- CMYK channel inputs that convert to sRGB hex with clear copy that this
  is an approximate screen-color conversion;
- clear button that writes `null`.

Rendering:

- non-null values render as a swatch plus hex text in normal-density
  tables;
- compact density may render swatch-only if the column is narrow, with
  the hex in the title/accessible label;
- `null` renders as the normal empty-cell state, not black or white.
- color field values do not drive row coloring, table tinting, legends,
  color-by controls, or view-state rules in PH-Navigator V2. They are
  stored for downstream consumers and shown only as the cell's own
  editable value.

## Validation And Coercion

Backend accepts only:

- `None`;
- strings matching `^#[0-9A-Fa-f]{6}$`, normalized to lowercase.

Frontend accepts and normalizes:

- `#rgb` -> `#rrggbb`;
- `#rrggbb`;
- `rgb(r,g,b)` / `rgb(r g b)`;
- RGB numeric channels `0..255`;
- CMYK percentages `0..100`, converted to sRGB hex;
- blank input -> `null`.

Rejected values:

- named CSS colors (`red`, `transparent`);
- `rgba(...)`;
- 8-digit hex;
- short `#rgb` in backend/API payloads; this is frontend input sugar
  only, and the persisted/API value must be expanded before write;
- out-of-range channels;
- unprofiled or non-numeric CMYK strings pasted as free text.

## Table Semantics

Filtering:

- v1: `is_empty`, `is_not_empty`, `is`, `is_not`.
- defer color-distance, palette grouping, and "similar to" filters.

Sorting:

- sort by normalized hex string, with `null` following the existing
  empty-value sort behavior.

Grouping:

- group by exact normalized hex.

Aggregation:

- Count and Count Unique.

Clipboard:

- copy non-null as `#rrggbb`;
- paste runs whole-range preflight like other editable types;
- if any color fails validation, commit nothing and use the existing
  paste review dialog.

Formula:

- formula fields may read color fields as text hex values.
- formulas do not produce stored `color` cell values in v1 unless the
  existing formula result typing is expanded separately.

## Backend Requirements

1. Add `color` to `CustomFieldType`.
2. Keep `CustomValue` as `str | int | float | bool | None`; color values
   remain strings after per-field validation.
3. Add `coerce_custom_value(..., CustomFieldType.color)` validation and
   normalization.
4. Add color validation to document reference validation so stored row
   `custom_values` cannot contain malformed colors.
5. Add schema mutation support:
   - add field with `field_type="color"`;
   - change type to/from `color`;
   - duplicate/delete/rename behave as existing scalar field types.
6. Extend conversion matrix:
   - color -> short_text: lossless;
   - short_text/long_text/url -> color: preflight, only valid color-like
     strings survive;
   - single_select -> color: lossy unless option colors are explicitly
     used as source values;
   - number -> color: not allowed;
   - color -> number/single_select/formula: not allowed in v1, unless a
     later plan defines exact semantics.
7. Update published JSON Schema and schema-version upgrade fixtures.
8. Rename current DTO/backend fields that use `argb_color` away from
   ARGB and migrate them to normalized hex storage in the same
   implementation branch. Because there are no deployments, no
   production data migration compatibility is required. Keep the cleanup
   scoped to current color-bearing DTO/backend objects and their tests.

## Frontend Requirements

1. Add `color` to `CustomFieldType` and `FieldType`.
2. Replace DataTable-only `argb_color` handling with `color`; remove
   frontend ARGB parsing once current DTO/backend payloads no longer
   emit ARGB-shaped values.
3. Map persisted `CustomFieldType.color` to renderer `FieldType.color`.
4. Implement color utilities:
   - normalize hex;
   - parse RGB;
   - convert CMYK to sRGB;
   - validate paste values;
   - format accessible labels.
5. Add `ColorCell` renderer/editor integrated with existing active-cell,
   keyboard, paste, fill, and clear semantics.
6. Add a `FieldConfigModal` type option for Color.
7. Include color in natural-zero handling as `null`.
8. Add filter/sort/group/aggregation catalogue support.
9. Ensure locked/read-only tables render colors but hide edit affordances.
10. Add Material use path only through table field definitions, not a
    one-off material editor color implementation.

## Test Coverage

Backend:

- enum/schema accepts `field_type="color"`;
- `coerce_custom_value` accepts valid hex, normalizes lowercase, accepts
  `None`, rejects malformed values;
- document validation rejects invalid color row values;
- add/rename/delete/duplicate schema mutations work for color fields;
- change-type preflight covers text -> color success/failure and color
  -> text success;
- paste/cell-write endpoint preserves `null` and normalized hex;
- schema fingerprint changes when a field changes to/from color;
- regression fixture for built-in material-like color field.

Frontend:

- color parser/normalizer unit tests for hex, RGB, CMYK, blank, invalid;
- `useTableSchema` maps `color` correctly;
- `naturalZero("color") === null`;
- DataTable renders swatch, empty state, copy value, and read-only state;
- cell editor commits picker/hex/RGB/CMYK values and clear-to-null;
- paste preflight rejects partial bad ranges atomically;
- filter/sort/group behavior for exact hex and empty values;
- field config can add/change to Color when unlocked and shows locked
  state when not editable;
- focused integration test on a material-like table row round-tripping
  a nullable color through backend save/reload;
- regression tests proving current DTO/backend color objects no longer
  emit or accept ARGB-shaped values.

Browser/E2E:

- create a Color field, set a value, clear it, save, reload, confirm the
  swatch and `null` survive.
- paste a mixed valid/invalid color range and verify nothing commits.

## Acceptance Criteria

- A user can add an editable Color field to a DataTable.
- The stored project document contains `null` or normalized `#rrggbb`
  only for that field.
- Color values round-trip through save/reload.
- Clearing the field writes `null`.
- Invalid paste/input cannot partially commit.
- Existing non-color field behavior is unchanged.
- Current DTO/backend color objects no longer use `argb_color` or
  ARGB-shaped storage.
- Color fields do not affect PH-Navigator row/table rendering beyond
  the cell's own editor and display.
- Test coverage above is green under `make format` and `make ci`.

## Resolved Questions

1. Current DTO/backend objects should stop using ARGB-shaped color
   storage in this implementation branch. Persist normalized hex and
   rename away from `argb_color`.
2. Short `#rgb` is accepted by frontend input only. Backend/API payloads
   accept only `null | "#rrggbb"`.
3. Color fields are for downstream consumer use. They do not participate
   in PH-Navigator V2 row coloring, table tinting, legends, color-by
   controls, or other view-state rendering behavior.
