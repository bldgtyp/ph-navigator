---
DATE: 2026-06-03
TIME: 17:51 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current state for DataTable color field planning.
RELATED:
  - planning/features/color-field/README.md
  - planning/features/color-field/PRD.md
  - planning/features/color-field/PLAN.md
---

# DataTable Color Field Status

## Current State

Implementation is complete in the main checkout at
`/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-v2`.

Phases 1-3 are implemented and verified:

- backend `CustomFieldType.color` with strict nullable `#rrggbb`
  validation;
- catalog/material/frame/glazing DTOs renamed from `argb_color` to
  `color` and normalized to hex;
- Alembic compatibility migration for local DBs that still have
  `argb_color` version columns;
- frontend `FieldType.color` and `CustomFieldType.color`;
- color utility support for strict stored hex plus frontend hex/RGB/CMYK
  input normalization;
- DataTable color cell renderer/editor, field picker entry, filter,
  sort, group, aggregation, paste/edit coercion, and local type-change
  preflight.

## Key Decisions

- Persist color cells as `null | "#rrggbb"` normalized sRGB hex.
- Add a user-authorable DataTable `color` field type.
- Do not persist CMYK. CMYK is an input/conversion affordance only.
- Do not extend `argb_color` as the authorable table field type.
- Current DTO/backend objects should stop using `argb_color` and
  ARGB-shaped storage during this implementation.
- Short `#rgb` is frontend input sugar only; backend/API payloads accept
  only `null | "#rrggbb"`.
- Color fields are for downstream consumers and do not drive
  PH-Navigator row coloring, table tinting, legends, color-by controls,
  or view-state behavior.
- Alpha is out of scope for v1.

## Next Step

None. Feature is ready for normal downstream use.

## Verification

- `make format` completed with no additional edits.
- `make ci` completed successfully:
  - backend Ruff format, Ruff lint, Ty, Alembic upgrade, and 427
    passing tests with 1 skipped integration test;
  - frontend Prettier check, ESLint, structural guards, 979 passing
    Vitest tests, and production Vite build.
- Browser smoke on the current-code local app created a `Color` field in
  the Rooms DataTable, opened the color editor, verified hex/RGB/CMYK
  controls, saved RGB 220/230/240, and rendered `#dce6f0` with no
  browser console errors.
- Simplify pass refactored the color editor onto the existing Radix
  Popover anchoring/portal pattern, removed custom placement/listener
  code, fixed stale comments, reran `make format && make ci`, and
  browser-smoked the reported modal bug. The editor stayed fixed at the
  same viewport box while RGB fields were edited, clicks inside the
  editor did not close it, and Save wrote `#788ca0`.
