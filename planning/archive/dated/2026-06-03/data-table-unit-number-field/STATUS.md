---
DATE: 2026-06-03
TIME: 19:40 EDT
STATUS: All five phases complete; `make ci` fully green; feature
        implementation closed, pending only the manual browser smoke.
AUTHOR: Claude (Opus 4.7)
SCOPE: Current state for the DataTable Number with Units planning
       packet.
RELATED:
  - PRD.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/frontend-viewer-units.md
---

# DataTable Number With Units Status

## Current State

- `PRD.md` defines the proposed user behavior, storage contract, table
  semantics, and remaining questions for extending Number fields with
  optional complete SI/IP unit config.
- The clarification pass resolved the user-facing model: this is
  not a separate type in the picker; it is a Number field with added
  units in the edit-field dialog.
- Catalog/domain physical fields may use fixed feature-owned unit
  config; user-created Number fields may use editable unit config.
- Area is confirmed as `m2 <> ft2`; volume is confirmed as `m3 <> ft3`.
- Unit config shape is confirmed as `config.units` with
  `mode: "editable" | "fixed"`.
- Phased implementation plans now live under `phases/`.
- Phase 01 is complete on branch `codex/data-table-number-units`.
- Backend `TableFieldDef` now validates optional complete
  `config.units` on Number fields and rejects partial, incompatible, or
  non-number unit config.
- Frontend `frontend/src/lib/units/numberUnits.ts` provides the MVP
  closed unit registry, conversion helpers, labels, and config guard.
- DataTable schema mapping exposes `FieldDef.numberUnits` for complete
  Number unit config.
- Simplify pass completed after Phase 01; findings folded in:
  precomputed frontend registry lookups, stricter frontend precision
  validation, derived TS unit unions, and backend/frontend registry
  snapshot tests.
- Phase 02 is complete on branch `codex/data-table-number-units`.
- `FieldConfigModal` now lets Number fields add, edit, and remove
  editable unit config while keeping the type picker label as `Number`.
- Fixed unit config renders in the modal but cannot be edited or
  removed; backend mutation paths reject fixed-unit edits through both
  `editFieldBundle` and direct `changeType`.
- Number fields can now change to Single-select; numeric source values
  materialize and map to generated option labels instead of clearing.
- Simplify pass completed after Phase 02; findings folded in:
  shared default number precision for Add Units, local backend test
  fixture helper for unit configs, numeric single-select coercion fix,
  and direct fixed-unit changeType guard.
- Phase 03 is complete on branch `codex/data-table-number-units`.
- `DataTable` now consumes `UnitPreferenceContext` directly (with a
  safe `"SI"` fallback for tests / unprovided hosts) and threads the
  active `unitSystem` through cell render, inline edit, clipboard
  copy/paste, filter evaluation, and aggregation. Plain Number fields
  are unchanged.
- Number-with-units cells render as bare displayed numbers (SI value
  in SI mode, converted IP value in IP mode) at the configured
  precision; the header carries a per-unit chip (`m` / `ft`, etc.).
- Inline edit seeds the draft with the displayed bare number and
  parses commit input back through the active unit system into the
  canonical SI write; paste and fill follow the same path. Copy emits
  the displayed bare number with no suffix.
- Filter operator evaluation and `formatAggregation` are unit-aware:
  user-typed filter values parse in the active display system before
  comparing SI cell values, and aggregates render in the active
  system at the configured precision.
- When a Number field's `numberUnits` config changes between renders,
  `DataTable` drops persisted filters for that field via
  `onViewChange`; unrelated view state is preserved.
- Simplify pass completed after Phase 03; `initialEditorState`
  refactored to remove a nested ternary on the unit-aware seed path
  while keeping the explanatory comment attached.
- Phase 04 is complete on branch `codex/data-table-number-units`.
- The Materials catalog (`backend/features/catalogs/materials/`,
  frontend `MaterialsCatalogPage` + `MaterialEditorModal`) is NOT yet
  DataTable-backed; it keeps its own SQL-backed routes and bespoke
  unit-aware modal. When that catalog is migrated to a DataTable, its
  `density_kg_m3` and `conductivity_w_mk` built-in fields must seed
  `numberUnits.mode = "fixed"` with the MVP pairs (`kg_m3 ↔ lb_ft3`,
  `w_m_k ↔ btu_h_ft_f`). Do NOT add a `R/in` unit pair in MVP; it is
  reciprocal/derived and belongs in a named display helper.
- Grid integration tests now pin the fixed-vs-editable parity: a
  fixed-mode built-in number field renders the unit chip and converts
  to IP identically to an editable-mode field; a built-in dimensionless
  number field with no `numberUnits` remains plain Number under both
  unit systems.
- No production code changed in Phase 04 — fixed-mode modal display
  (Phase 02), backend `editFieldBundle` / `changeType` rejection of
  fixed-unit edits (Phase 02), and the unit-aware grid pipeline
  (Phase 03) together cover the policy. Phase 04's contribution is
  end-to-end coverage so the future catalog migration can rely on it.
- Simplify pass completed after Phase 04; no material simplifications
  applied — the two new integration tests are tight and load-bearing.
- Phase 05 is complete on branch `codex/data-table-number-units`.
- Stable context docs now describe the implemented contract:
  `context/technical-requirements/data-table.md` field-types row +
  "Number with Units" subsection (grid-surface specifics); the full
  registry / payload / mode / migration contract lives in
  `context/technical-requirements/frontend-viewer-units.md` §11.5.5.
  Simplify pass collapsed the initial duplicated narrative across the
  two files into a short pointer + grid-only specifics in data-table.md
  and the full contract in frontend-viewer-units.md.
- `make format` clean and `make ci` fully green (86 files, 998 tests)
  after bumping the `coerceCustomFieldType.test.ts` formula-parity
  count from 33 → 34 to match the post-color CONVERSION_MATRIX. The
  bump is a stale-expectation fix, not a contract change — the
  backend matrix already had the same 34 entries.

## Feature Closeout

All five phases (01 Contract + Registry, 02 Field Config UI, 03 Grid
Behavior, 04 Fixed Catalog Fields, 05 Verification + Docs) have shipped
on `codex/data-table-number-units`. The MVP roster (`density`,
`conductivity`, `length`, `area`, `volume`) is wired end-to-end and
documented in the canonical context docs.

### Deferred work

- **Browser smoke validation.** The Phase 05 plan calls for a manual
  IP/SI toggle walk-through, fixed-mode-modal visual check, and round-
  trip edit verification. Automated test coverage exercises the same
  paths; the walk-through is the user's responsibility before merging
  the feature PR.
- **Materials catalog migration to DataTable.** When `MaterialsCatalog
  Page` and `MaterialEditorModal` are reworked onto the shared
  DataTable primitive, the built-in `density_kg_m3` and
  `conductivity_w_mk` fields must seed `numberUnits.mode = "fixed"`
  with the canonical pairs (`kg_m3 ↔ lb_ft3`, `w_m_k ↔ btu_h_ft_f`).
  No `R/in` in MVP — reciprocal/derived display belongs in a named
  helper, not the generic conductivity pair.
- *(Resolved 2026-06-03)* Pre-existing
  `coerceCustomFieldType.test.ts` count drift — fixed inline as the
  pre-merge gate; backend matrix was already authoritative and
  matched the new 34-entry frontend.

## Next Step

Feature complete. No further phases planned. Promote the durable
decisions out of this STATUS into the context docs (already done in
Phase 05) and let this folder graduate to a historical record.

## Verification

Phase 01 focused verification:

- `cd backend && uv run ruff check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run ruff format --check features/project_document/custom_fields.py tests/test_project_document_custom_fields.py`
- `cd backend && uv run pytest tests/test_project_document_custom_fields.py`
- `cd frontend && pnpm exec vitest run src/lib/units/units.test.ts src/shared/ui/data-table/__tests__/useTableSchema.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`

Full mandatory gate completed for the Phase 02 commit:

- `make format`
- `make ci`

Phase 02 focused verification:

- `cd backend && uv run ruff check features/project_document/mutations/models.py features/project_document/mutations/bundle.py features/project_document/mutations/type_conversion.py tests/test_project_document_schema_mutations.py`
- `cd backend && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document_schema_mutations.py`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/FieldConfigModal.test.tsx src/shared/ui/data-table/__tests__/customFieldMutations.test.ts`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run build`

Phase 02 full verification:

- `make format`
- `make ci`

Phase 03 focused verification:

- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table src/lib/units`

Phase 03 full verification:

- `make format`
- `make ci`

Phase 04 focused verification:

- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx`

Phase 04 full verification:

- `make format`
- `make ci`

Phase 05 focused verification:

- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table src/lib/units`

Phase 05 full verification:

- `make format` — clean.
- `make ci` — green (86 files, 998 tests) after the inline fix to
  `coerceCustomFieldType.test.ts` count expectation.
