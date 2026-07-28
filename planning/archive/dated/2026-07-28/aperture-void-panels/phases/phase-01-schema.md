---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 1 — add `kind` to ApertureElement (schema + wire + TS). No behavior change.
RELATED: ../PRD.md §2, ../decisions.md A-2
---

# Phase 1 — Schema: `ApertureElement.kind`

Pure data-shape phase. After this merges, documents can carry
`kind: "void"` and validation enforces the void invariant, but nothing
*behaves* differently yet (U-value/export changes are Phase 3; the only way to
produce a void is hand-crafted JSON or `replace_table`).

## Changes

### Backend — `backend/features/project_document/envelope_models.py`

1. Add near the aperture types:
   ```python
   ApertureElementKind = Literal["glazed", "void"]
   ```
2. `ApertureElement` (~:491): add
   ```python
   kind: ApertureElementKind = "glazed"
   ```
3. New `@model_validator(mode="after")` on `ApertureElement`: when
   `kind == "void"`, require `frames.top/right/bottom/left` all `None`,
   `glazing_id is None`, `operation is None`. Error message names the field,
   matching existing validator style (e.g.
   `"ApertureElement(kind=void) must not carry frames/glazing/operation"`).
4. Export the new name via the module `__all__` / `document.py` re-export
   list (`document.py:451` region) if the aperture types are re-exported
   there.

### Frontend — `frontend/src/features/apertures/types.ts`

- `export type ApertureElementKind = "glazed" | "void";`
- Add `kind: ApertureElementKind` to `ApertureElement` (`WireApertureElement`
  inherits it via the existing `Omit`). Locate the wire→domain resolution
  (start at `lib.ts` / `ref-builders.ts` / `store/`) and carry `kind` through;
  TS compile will surface any construction sites that need the field.
- Any element factory/fixture builders in `__tests__` get
  `kind: "glazed"` defaults.

### Explicitly NOT in this phase

- No command changes, no U-value/export changes, no UI.
- **Known intermediate state** (review note): until Phase 3 lands, a
  `replace_table`/MCP-authored void computes a U-value over real area and
  exports a bogus `WindowConstruction`. Accepted — no UI authoring path
  exists yet, and phases 1–3 land before the feature is announced or used.
  Do not "fix" this partially in Phase 1.
- No document migration/upgrade step — default `"glazed"` keeps every stored
  version and draft valid. Confirm no schema-version bump is required by the
  project-document validation conventions (check
  `features/project_document/validation.py` + upgrade path; expectation: none).

## Tests

- `ApertureElement(kind="void", ...)` with any frame/glazing/operation set →
  ValidationError; with all null → valid.
- Omitted `kind` → `"glazed"` (round-trip an existing fixture document
  untouched — serialization must not reorder/perturb other fields).
- Coverage check still passes/fails identically with voids in the tiling.
- `replace_table` (apertures contract) accepts an entry containing a void
  element and round-trips it.

## Verification

- `make ci` green (backend `ty` strict typing + pytest, frontend tsc/vitest).
- Grep check: no consumer branches on `kind` yet.

## Implementation evidence

- Branch: `feature/aperture-void-panels`.
- Added the backend `ApertureElementKind` alias, defaulted
  `ApertureElement.kind` to `"glazed"`, and enforced the assignment-free void
  invariant.
- Re-exported the alias through `project_document.document`; mirrored and
  hydrated the required field in the Apertures frontend contract.
- Focused backend verification:
  `uv run pytest tests/test_project_document_apertures.py tests/test_mcp.py -q`
  (`79 passed, 1 skipped`).
- Frontend type verification: `pnpm exec tsc -b --pretty false` (green).
- Consumer-branch grep found only the schema invariant in
  `envelope_models.py`; no U-value/export/UI consumer behavior changed.
- `make format` and `make ci` green:
  - backend: `1595 passed, 7 skipped`;
  - frontend: `245` test files / `2294` tests passed, structural guards green,
    production build green.
