---
DATE: 2026-06-03
TIME: 17:51 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Implementation sequence for DataTable color field support.
RELATED:
  - planning/features/color-field/PRD.md
  - context/technical-requirements/data-table.md
  - planning/features/editable-fields/PRD.md
---

# DataTable Color Field Plan

## Phase 1 - Contract And Backend

Goal: make `color` a valid persisted table field type.

Steps:

1. Add `CustomFieldType.color`.
2. Add `COLOR_HEX_PATTERN` and normalization helper in the backend
   project-document field layer.
3. Extend `coerce_custom_value` and document validation.
4. Extend schema mutation add/change-type paths and conversion matrix.
5. Update schema fixtures and fingerprints as needed.
6. Rename current DTO/backend `argb_color` objects away from ARGB and
   migrate them to normalized hex storage.
7. Add backend tests before frontend integration.

Verification:

```bash
cd backend
uv run ruff check features tests
uv run ty check features tests
uv run pytest tests -q
```

## Phase 2 - Frontend Type System And Utilities

Goal: make `color` available to the renderer and editor pipeline.

Steps:

1. Add `CustomFieldType.color` and `FieldType.color`.
2. Map `color` in `useTableSchema`.
3. Add color normalization/conversion utilities.
4. Replace DataTable `argb_color` special cases with `color`.
5. Add filter/sort/group/aggregation behavior.
6. Remove frontend ARGB parsing once current DTO/backend payloads emit
   normalized hex.
7. Add unit tests for utilities and schema mapping.

Verification:

```bash
cd frontend
pnpm exec eslint src/shared/ui/data-table
pnpm exec vitest run src/shared/ui/data-table
```

## Phase 3 - Cell UI And Field Config

Goal: provide the editable color experience.

Steps:

1. Add `ColorCell` renderer and editor.
2. Add swatch, native color picker, hex, RGB, CMYK, and clear controls.
3. Wire keyboard commit/cancel and clear-to-null behavior into existing
   grid edit semantics.
4. Add Color to the field type picker with lock/read-only behavior.
5. Add DataTable tests for render, edit, clear, paste, copy, and
   read-only rendering.

Verification:

```bash
cd frontend
pnpm exec vitest run src/shared/ui/data-table
```

## Phase 4 - Material-Like Round Trip

Goal: prove the intended material-record use case without creating a
separate material-only implementation.

Steps:

1. Add a focused material-like table fixture with a built-in `color`
   field or use the first real Material DataTable if it exists by then.
2. Save a non-null color, reload, and assert the swatch and hex match.
3. Clear the value, save/reload, and assert `null`.
4. Add Playwright coverage for create-field/set/clear/reload.

Verification:

```bash
cd frontend
pnpm exec playwright test tests/e2e/<color-field-spec>.spec.ts --project=chromium
```

## Phase 5 - Full Gate

Run the mandatory repo gate from the repo root:

```bash
make format
make ci
```

If `make format` changes files, inspect the diff and rerun `make ci`.

Status: implemented, verified, and committed from the main checkout as
of 2026-06-03 17:51 EDT.

## Implementation Notes

- Keep frontend CMYK as a conversion panel only. Persist hex.
- Keep alpha out of scope.
- Accept short `#rgb` only in frontend input. Backend/API payloads must
  carry expanded `#rrggbb`.
- Color fields do not drive PH-Navigator row coloring, table tinting,
  legends, color-by controls, or view-state rules.
- Avoid one-off material editor code unless Material records are already
  implemented as a DataTable consumer.
- Rename existing `argb_color` DTO/backend objects in the same branch,
  keep that as a narrow compatibility cleanup, and test
  envelope/material readers separately.
