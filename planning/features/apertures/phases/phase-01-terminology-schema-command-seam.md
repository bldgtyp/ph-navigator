---
DATE: 2026-06-05
TIME: 15:15 EDT
STATUS: Active — not yet started
AUTHOR: Codex
SCOPE: Schema cutover from `window_types` to `apertures`, id-prefix
       rename, add `name` + `operation` to elements, seed default
       frame and glazing refs, introduce the `ApertureCommand` seam,
       stamp `catalog_schema_version: 1` on new bookshelf copies,
       and enforce the no-holes / no-overlap coverage invariant.
RELATED:
  - planning/features/apertures/PRD.md §2, §7, §12, §13, §21
  - planning/features/apertures/PLAN.md (Phase 01 row, R1, R2, R3)
  - backend/features/project_document/document.py (WindowTypeEntry,
    WindowElement, FrameRef, GlazingRef, CatalogOrigin definitions)
  - backend/features/project_document/tables/window_types.py
  - backend/features/project_document/tables/registry.py
  - backend/features/project_document/mutations/dispatcher.py
    (precedent for the command dispatcher pattern)
  - backend/features/project_document/validation.py
  - backend/features/project_document/tables/_built_in_seeds.py
  - frontend/src/features/windows/ (rename target → apertures)
---

# Phase 1 — Terminology, schema, ApertureCommand boundary, default refs

## P0. Why this slice

Phase 01 is the **contract cutover**. Every later phase in this
feature consumes the renamed schema, the new element fields, the
seeded defaults, and the `ApertureCommand` seam. Without this slice,
phases 02–13 cannot start.

This phase deliberately does **not** ship Builder UI. The Windows
tab keeps its current minimal picker UI through this phase (re-pointed
at the renamed table) so that nothing regresses on main. Phase 02
cuts the route over.

By the end of Phase 01:

- `body.tables.window_types[]` is renamed to `body.tables.apertures[]`
  with `ApertureTypeEntry` / `ApertureElement` / `ApertureElementFrames`
  classes. Id prefixes `win_` / `winel_` are normalized to `apt_` /
  `aptel_`.
- `ApertureElement` carries the required `name: str` (default
  `"Unnamed"`) and `operation: ApertureOperation | None` fields.
- Document validation enforces the **coverage invariant**: every grid
  cell `[r, c]` for `r in 0..len(row_heights_mm)-1`,
  `c in 0..len(column_widths_mm)-1` is covered by exactly one
  element. No holes, no overlaps.
- Two default catalog rows — `PHN-Default-Frame` and
  `PHN-Default-Glazing` — are seeded by migration. Default aperture
  creation **bookshelf-copies** these rows into the new element's
  four frames and one glazing. If either default row is missing
  (operator wiped the catalog), creation surfaces a structured
  `aperture_default_refs_missing` error.
- New `CatalogOrigin` stamps always carry
  `catalog_schema_version: 1`. Existing nullable stamps are tolerated
  (older documents round-trip cleanly).
- A new `ApertureCommand` model + `apply_aperture_command` dispatcher
  ships in `backend/features/project_document/aperture_commands/`,
  parallel to `mutations/dispatcher.py`. The dispatcher emits the
  exact JSON-Patch needed for each semantic gesture.
- The existing whole-table-replace endpoint
  (`window_types_contract`) is kept as a **temporary compatibility
  wrapper** so the tracer-bullet UI in `frontend/src/features/windows/`
  keeps working through Phase 02.
- Frontend `src/features/windows/` is renamed only where required to
  compile against the new types. The full route cutover to
  `/apertures` lands in Phase 02.

Phase 01 does **not** ship: the canvas, the dimensions panel, the
new sidebar, U-Value, HBJSON export, manufacturer filters, the
project refs view, MCP semantic writes, or any operation symbols
on the canvas.

## P1. Acceptance — Phase 1 done when

1. `backend/features/project_document/document.py` exports
   `ApertureTypeEntry`, `ApertureElement`, `ApertureElementFrames`,
   `ApertureOperation` (discriminated union), and
   `APERTURE_DEFAULT_FRAME_NAME` / `APERTURE_DEFAULT_GLAZING_NAME`
   constants. The legacy `WindowTypeEntry` / `WindowElement` /
   `WindowElementFrames` names remain re-exported as aliases
   pointing at the new classes for one release window so untouched
   callers do not break inside this phase's PR. Phase 02 deletes the
   aliases.
2. Id prefixes are normalized:
   - `ApertureTypeEntry.id` matches `apt_[A-Za-z0-9_-]+`.
   - `ApertureElement.id` matches `aptel_[A-Za-z0-9_-]+`.
   - Document-level migration shim rewrites `win_` → `apt_` and
     `winel_` → `aptel_` on read. Migration is applied at the
     `validate_document` boundary so any code path that loads an
     older document upgrades transparently.
3. `ApertureElement` adds `name: str = Field(default="Unnamed",
   min_length=1, max_length=200)` with whitespace trim. Empty /
   whitespace-only names raise `ValueError`.
4. `ApertureElement` adds
   `operation: ApertureOperation | None = None`. The
   `ApertureOperation` model:
   ```python
   class ApertureOperation(BaseModel):
       model_config = ConfigDict(extra="forbid")
       type: Literal["swing", "slide"]
       directions: list[Literal["left", "right", "up", "down"]] = Field(default_factory=list)
   ```
   `None` means Fixed. Duplicate directions are rejected.
5. `ApertureTypeEntry` validation adds the **coverage invariant**:
   - For `R = len(row_heights_mm)` and `C = len(column_widths_mm)`,
     every cell `(r, c)` for `0 <= r < R`, `0 <= c < C` is covered
     by exactly one element whose `row_span[0] <= r <= row_span[1]`
     and `column_span[0] <= c <= column_span[1]`.
   - Element spans must stay in bounds (`row_span[1] < R`,
     `column_span[1] < C`).
   - Violations raise `coverage_holes` or `coverage_overlap` errors
     with structured detail naming the offending cell.
6. `body.tables` exposes `apertures: list[ApertureTypeEntry]`.
   `window_types` becomes a `@computed_field` alias returning the
   same list for the duration of Phase 01. Phase 02 deletes it.
7. A new
   `backend/features/project_document/tables/apertures.py` module
   defines `apertures_contract` (mirroring `window_types_contract`)
   and is registered in `tables/registry.py`. The legacy
   `window_types_contract` continues to register the legacy table
   name but its `apply_replace` and `extract_rows` route through the
   new `apertures` slice. Both names resolve to the same data.
8. `backend/features/catalog/seeds/` (or the existing built-in seed
   path) seeds two rows on `make migrate`:
   - `PHN-Default-Frame` (frame_types, `width_mm=50`,
     `u_value_w_m2k=1.5`, `psi_g_w_mk=0.04`, `color="#888888"`).
   - `PHN-Default-Glazing` (glazing_types, `u_value_w_m2k=1.0`,
     `g_value=0.5`, `color="#a8c8ff"`).
   Both rows are marked `seeded=True` so the catalog manager can
   show them as immutable PHN defaults (catalog-side immutability
   ships with the catalog work; for now the rows exist and are
   reachable by name).
9. A new aperture-type factory
   `build_default_aperture_type(catalog: CatalogReader, *, name: str)
   -> ApertureTypeEntry` lives in
   `backend/features/project_document/apertures/factories.py`. It:
   - bookshelf-copies the seeded frame into all four
     `frames.{top,right,bottom,left}` slots;
   - bookshelf-copies the seeded glazing into `glazing`;
   - sets `name=name`, `row_heights_mm=[1000.0]`,
     `column_widths_mm=[1000.0]`, one default element
     (`row_span=(0,0)`, `column_span=(0,0)`, `name="Unnamed"`,
     `operation=None`);
   - stamps every `catalog_origin.catalog_schema_version=1`,
     `synced_at=utcnow()`, `local_overrides=[]`;
   - raises `api_error(503, "aperture_default_refs_missing", ...)`
     if either default row is missing.
10. New module
    `backend/features/project_document/aperture_commands/` ships
    with:
    - `models.py` — `ApertureCommand = Annotated[Union[...],
      Field(discriminator="kind")]`. Initial commands:
      `createApertureType`, `renameApertureType`,
      `duplicateApertureType`, `deleteApertureType`,
      `editDimension`, `addRow`, `addColumn`, `deleteRow`,
      `deleteColumn`, `mergeElements`, `splitElement`,
      `pickFrame`, `pickGlazing`, `setElementOperation`,
      `setElementName`, `pasteAssignment`. Phase 01 ships the
      first four plus `setElementName` and `setElementOperation`
      as the minimum needed for the existing Windows tab to keep
      functioning; the others are stubbed with
      `not_implemented_yet` errors and filled in by the phases
      that own those gestures.
    - `dispatcher.py` —
      `apply_aperture_command(body, command, *, actor_user_id,
      catalog) -> tuple[ProjectDocumentV1, dict[str, object]]`.
      Mirrors `mutations/dispatcher.py`'s shape: ETag preflight,
      handler lookup, final `validate_document`, audit envelope.
    - `routes.py` — `POST /projects/{id}/versions/{vid}/apertures/
      command` accepting `ApertureCommand` and the draft `if-match`
      header.
    - Browser routing layer in `frontend/src/features/windows/api.ts`
      (renamed `apertures/api.ts` in Phase 02) gains an
      `applyApertureCommand(projectId, versionId, command)` helper
      that the new sidebar (Phase 02) will consume. Phase 01 only
      uses it for `createApertureType` / `renameApertureType` /
      `duplicateApertureType` / `deleteApertureType` /
      `setElementName` to keep the tracer-bullet UI hot through
      the cutover.
11. `CatalogOrigin.catalog_schema_version` defaults to `1` on
    **new** bookshelf copies (not retroactively on existing data).
    The factory in §P1.9 and the `pickFrame` / `pickGlazing`
    handlers stamp it explicitly. Existing nullable values
    round-trip unchanged.
12. Frontend types in `frontend/src/features/windows/types.ts` are
    extended with `name`, `operation`, and the canonical id prefixes
    in any pattern checks. The existing `WindowsTypeLayout` /
    `WindowTypeDetail` / `WindowElementCard` files are renamed in
    place if needed but no Builder rebuild ships here.
13. Backend tests:
    - Document validation: coverage holes / overlaps surface
      structured errors; positive cases pass.
    - `build_default_aperture_type`: returns a valid entry; raises
      structured error when either seed row is missing.
    - `apply_aperture_command` dispatcher: each shipped command
      produces the expected next body and audit entry; unknown
      `kind` returns 422.
    - Document migration shim rewrites `win_` / `winel_` ids on
      load; the new ids match the canonical patterns.
14. `make ci` is green: typecheck, lint, ruff format, ty, alembic
    migration, pytest, frontend prettier, eslint, structural guards,
    vitest, build.

## P2. Files

### New

- `backend/features/project_document/apertures/__init__.py`
- `backend/features/project_document/apertures/factories.py`
  (`build_default_aperture_type`).
- `backend/features/project_document/apertures/coverage.py`
  (pure coverage / span checks; reused by validation and by the
  `mergeElements` / `splitElement` commands when those land).
- `backend/features/project_document/aperture_commands/__init__.py`
- `backend/features/project_document/aperture_commands/models.py`
- `backend/features/project_document/aperture_commands/dispatcher.py`
- `backend/features/project_document/aperture_commands/handlers/sidebar.py`
  (`createApertureType`, `renameApertureType`,
  `duplicateApertureType`, `deleteApertureType`).
- `backend/features/project_document/aperture_commands/handlers/element.py`
  (`setElementName`, `setElementOperation`; the rest are stubs that
  raise `not_implemented_yet` until phases 05/06/07/08 fill them in).
- `backend/features/project_document/aperture_commands/routes.py`
- `backend/features/project_document/tables/apertures.py` (renamed
  contract; mirrors `window_types.py`).
- `backend/migrations/<timestamp>_rename_window_types_to_apertures.py`
  (Alembic migration; also seeds default frame / glazing rows if
  the catalog tables already exist).
- `backend/features/project_document/__tests__/test_apertures_validation.py`
- `backend/features/project_document/__tests__/test_aperture_commands.py`
- `backend/features/project_document/__tests__/test_aperture_factory.py`

### Modified

- `backend/features/project_document/document.py`
  - Add `ApertureOperation`.
  - Rename `WindowElementFrames` → `ApertureElementFrames`,
    `WindowElement` → `ApertureElement`,
    `WindowTypeEntry` → `ApertureTypeEntry`.
  - Add `name: str = Field(default="Unnamed", ...)` to
    `ApertureElement`.
  - Add `operation: ApertureOperation | None = None` to
    `ApertureElement`.
  - Update id-prefix regexes to `apt_` / `aptel_`.
  - Add coverage validation hook in `ApertureTypeEntry`
    `@model_validator`.
  - Re-export legacy names (`WindowTypeEntry = ApertureTypeEntry`,
    etc.) with a `# deprecated: removed in Phase 02` comment.
  - `ProjectDocumentTables.apertures: list[ApertureTypeEntry]`
    replaces `window_types`. Add a `@computed_field` alias
    `window_types` for the duration of Phase 01.
- `backend/features/project_document/tables/registry.py`
  - Register `apertures_contract` under both `"apertures"` and
    `"window_types"` (alias) for Phase 01. Phase 02 drops the
    alias entry.
- `backend/features/project_document/tables/window_types.py`
  - Thin re-export of `apertures_contract` for the duration of
    Phase 01. The old file is deleted in Phase 02.
- `backend/features/project_document/validation.py`
  - Add a document-load migration shim that rewrites `win_` /
    `winel_` ids to `apt_` / `aptel_`. Idempotent. Logs once per
    upgraded document at `info` level.
- `backend/features/project_document/document.py` `CatalogOrigin`
  - No schema change; just update the `build_default_aperture_type`
    + `pickFrame` / `pickGlazing` handlers to stamp
    `catalog_schema_version=1` explicitly.
- `backend/features/catalog/seeds/built_in.py`
  (or equivalent) — add the two default rows.
- `backend/main.py` (router wiring) — mount the new
  `aperture_commands/routes.py` router.
- `frontend/src/features/windows/types.ts`
  - Extend `WindowElement` with `name: string` and
    `operation: ApertureOperation | null`.
  - Add `ApertureOperation` union.
- `frontend/src/features/windows/api.ts`
  - Add `applyApertureCommand()` helper hitting the new endpoint.
- `frontend/src/features/windows/components/WindowsTypeLayout.tsx`
  / `WindowTypeDetail.tsx` / `WindowElementCard.tsx`
  - Compile-fix against the new types. No visual rebuild.

### Deleted

None in this phase. Phase 02 deletes the legacy aliases and
`tables/window_types.py`.

## P3. Component / model shapes

```python
# backend/features/project_document/document.py — sketch

class ApertureOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["swing", "slide"]
    directions: list[Literal["left", "right", "up", "down"]] = Field(
        default_factory=list
    )

    @model_validator(mode="after")
    def _no_dup_directions(self) -> "ApertureOperation":
        if len(self.directions) != len(set(self.directions)):
            raise ValueError("duplicate directions are not allowed")
        return self


class ApertureElement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^aptel_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(default="Unnamed", min_length=1, max_length=200)
    row_span: tuple[int, int]
    column_span: tuple[int, int]
    frames: ApertureElementFrames = Field(default_factory=ApertureElementFrames)
    glazing: GlazingRef | None = None
    operation: ApertureOperation | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError("element name must not be empty")
            return stripped
        return value


class ApertureTypeEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^apt_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    row_heights_mm: list[float] = Field(min_length=1)
    column_widths_mm: list[float] = Field(min_length=1)
    elements: list[ApertureElement] = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_coverage(self) -> "ApertureTypeEntry":
        check_aperture_coverage(self)  # raises with structured detail
        return self
```

```python
# backend/features/project_document/apertures/coverage.py — sketch

def check_aperture_coverage(entry: ApertureTypeEntry) -> None:
    rows = len(entry.row_heights_mm)
    cols = len(entry.column_widths_mm)

    cover: dict[tuple[int, int], str] = {}
    for el in entry.elements:
        r0, r1 = el.row_span
        c0, c1 = el.column_span
        if not (0 <= r0 <= r1 < rows):
            raise CoverageError(
                "aperture_element_row_span_out_of_bounds",
                element_id=el.id,
                row_span=el.row_span,
                rows=rows,
            )
        if not (0 <= c0 <= c1 < cols):
            raise CoverageError(...)
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                if (r, c) in cover:
                    raise CoverageError(
                        "aperture_coverage_overlap",
                        cell=(r, c),
                        first_element_id=cover[(r, c)],
                        second_element_id=el.id,
                    )
                cover[(r, c)] = el.id

    for r in range(rows):
        for c in range(cols):
            if (r, c) not in cover:
                raise CoverageError(
                    "aperture_coverage_hole",
                    cell=(r, c),
                )
```

```python
# backend/features/project_document/aperture_commands/models.py — sketch

class CreateApertureType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["createApertureType"] = "createApertureType"
    proposed_name: str | None = None  # autoname if absent

class RenameApertureType(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["renameApertureType"]
    aperture_type_id: str = Field(pattern=APT_ID_PATTERN)
    new_name: str = Field(min_length=1, max_length=200)

# ... 16 commands total in the union (six implemented in Phase 01,
# ten stubbed). Each command is annotated, discriminated, and
# extra="forbid".

ApertureCommand = Annotated[
    CreateApertureType | RenameApertureType | DuplicateApertureType
    | DeleteApertureType | EditDimension | AddRow | AddColumn
    | DeleteRow | DeleteColumn | MergeElements | SplitElement
    | PickFrame | PickGlazing | SetElementOperation
    | SetElementName | PasteAssignment,
    Field(discriminator="kind"),
]
```

```python
# backend/features/project_document/aperture_commands/dispatcher.py
# — sketch (mirrors mutations/dispatcher.py)

def apply_aperture_command(
    body: ProjectDocumentV1,
    command: ApertureCommand,
    *,
    actor_user_id: str,
    catalog: CatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    handler = _HANDLERS.get(command.kind)
    if handler is None:
        raise api_error(422, "aperture_command_unsupported_kind", ...)
    next_body, audit = handler(body, command, actor_user_id, catalog)
    validated = validate_document(next_body.model_dump(mode="json"))
    return validated, audit
```

```ts
// frontend/src/features/windows/api.ts — addition

export type ApertureCommand =
  | { kind: "createApertureType"; proposed_name?: string }
  | { kind: "renameApertureType"; aperture_type_id: string; new_name: string }
  | { kind: "duplicateApertureType"; aperture_type_id: string; new_name?: string }
  | { kind: "deleteApertureType"; aperture_type_id: string }
  | { kind: "setElementName"; aperture_type_id: string; element_id: string; new_name: string }
  | { kind: "setElementOperation"; aperture_type_id: string; element_id: string; operation: ApertureOperation | null }
  // ... stubbed kinds (server returns 422 not_implemented_yet)
  ;

export async function applyApertureCommand(
  projectId: string,
  versionId: string,
  command: ApertureCommand,
  draftEtag: string | null,
): Promise<ApertureCommandResponse> {
  // POST /projects/{projectId}/versions/{versionId}/apertures/command
  // headers: { "If-Match": draftEtag ?? "" }
}
```

## P4. Sequence

1. **Commit 1 — Schema rename + ApertureElement fields + coverage.**
   Add `ApertureOperation`, rename classes, add `name` /
   `operation`, normalize id prefixes, add coverage validation, and
   the document-load migration shim. Leave legacy name aliases in
   place so the rest of the backend compiles. Tests in
   `__tests__/test_apertures_validation.py` cover positive cases
   plus four negative cases: hole, overlap, span-out-of-bounds,
   empty-name.
2. **Commit 2 — Apertures table contract + registry alias.** Add
   `tables/apertures.py`, register both names, route
   `tables/window_types.py` through the new contract. Update any
   `extract_rows` callers to read from `body.tables.apertures`.
3. **Commit 3 — Default-refs seed + factory.** Add the two seed
   rows to the catalog migration, add
   `apertures/factories.build_default_aperture_type`, raise
   structured error if seeds are missing. Tests:
   `test_aperture_factory.py` covers happy path and missing-seed
   path.
4. **Commit 4 — ApertureCommand dispatcher + Phase 01 handlers.**
   Wire up the six Phase 01 commands and stub the rest. Route
   `aperture_commands/routes.py`. Tests:
   `test_aperture_commands.py` covers each shipped command, the
   stub `not_implemented_yet`, ETag preflight, and audit envelope.
5. **Commit 5 — Frontend types + api helper + tracer-bullet
   compile fix.** Extend `frontend/src/features/windows/types.ts`,
   add `applyApertureCommand`, and switch the existing sidebar's
   add / rename / duplicate / delete actions to drive the new
   command instead of the whole-table-replace. Element-card name
   becomes editable through `setElementName`. No layout change.
6. **Commit 6 — Migration + CI green.** Generate the Alembic
   migration that runs the rename, ensures the seed rows, and is
   idempotent on existing dev DBs. `make ci` green from the repo
   root.

Each commit should pass `make ci` independently. If a commit
breaks `make ci`, that commit must be re-split before opening the
PR.

## P5. Tests

### Backend — unit

- `test_apertures_validation.py`:
  - 1×1 grid, single element → valid.
  - 2×2 grid, four 1×1 elements → valid.
  - 2×2 grid, one element covering `row_span=(0,1), column_span=(0,1)`
    → valid.
  - 2×2 grid with one cell uncovered → `aperture_coverage_hole`.
  - Two elements overlapping at `(0, 0)` → `aperture_coverage_overlap`
    naming both element ids.
  - `row_span=(0, 2)` on a 2-row grid → out-of-bounds.
  - Empty / whitespace element name → `ValueError`.
  - `ApertureOperation.directions=["left", "left"]` → `ValueError`.
- `test_aperture_factory.py`:
  - Happy path: catalog seeded → returns valid entry, both refs
    have `catalog_origin.catalog_schema_version == 1`, `synced_at`
    is set, `local_overrides == []`.
  - Missing frame seed → `aperture_default_refs_missing` with
    detail naming `"frame_types"`.
  - Missing glazing seed → similar with `"glazing_types"`.
- `test_aperture_commands.py`:
  - `createApertureType` with no `proposed_name` → auto-named
    `"Unnamed Aperture Type"`; second call → `"Unnamed Aperture
    Type (2)"`; case-insensitive suffix search.
  - `renameApertureType` to a colliding trimmed-lower name →
    structured error.
  - `duplicateApertureType` copies the source, mints fresh ids
    (different aperture id and different element ids), preserves
    `catalog_origin` blocks.
  - `deleteApertureType` removes the entry and would empty the
    list → still valid (sidebar shows empty state at the UI
    layer).
  - `setElementName` with empty string → 422.
  - `setElementOperation` accepts `None`, `swing+[left,up]`,
    rejects `swing+[left,left]`.
  - Unknown `kind` → 422 `aperture_command_unsupported_kind`.
  - Stale ETag → 412.

### Backend — integration

- `POST /projects/{id}/versions/{vid}/apertures/command` with each
  shipped command → 200, draft body updated, draft ETag rotates.
- Same with `If-Match` mismatch → 412.
- Locked version → 423; viewer access → 403.

### Backend — migration

- Apply migration against a fixture DB that contains a document with
  `win_AA` / `winel_AA_1` ids → after migration the load path returns
  `apt_AA` / `aptel_AA_1`. Idempotency: re-applying does nothing.

### Frontend — unit

- Existing `lib.test.ts` updated for the new field set; element
  name editing round-trips through `applyApertureCommand`.

### Browser check

- Open the existing Windows tab on a dev project.
- Add an aperture type from the sidebar — verify it lands with
  one default element, default frame, and default glazing
  bookshelf-copied.
- Rename it; duplicate it; delete it.
- Edit the element's name through whatever surface the tracer-
  bullet currently exposes.
- Confirm Save / Save As writes the new shape.

### Regression

- Refresh-from-catalog (existing flow) continues to detect drift
  on the renamed table.

## P6. Out of scope (lands in later phases)

- The Apertures route, layout shell, sidebar rebuild — **Phase 02**.
- SVG canvas, geometry, view direction, zoom — **Phase 03 / 04**.
- Dimensions panel + parser + format selector — **Phase 05**.
- Element cards, per-side picker filtering, badges,
  click-on-region pickers — **Phase 06**.
- Operations editor + presets + symbols — **Phase 07**.
- Merge / split + copy/paste + undo — **Phase 08**.
- U-Value service + chips — **Phase 09**.
- HBJSON export — **Phase 10**.
- Manufacturer filters — **Phase 11**.
- Drift detection refinement + refresh dialog + refs view —
  **Phase 12**.
- Semantic MCP write tools (the route exists; the MCP-side wrapper
  ships in **Phase 13**).
- Deleting the legacy `WindowTypeEntry` aliases and
  `tables/window_types.py` — **Phase 02**.

## P7. Risks

- **R-01-1. Live document migration must be safe.** The
  document-load shim rewrites ids in-place. Mitigation: the shim is
  pure (operates on the parsed dict before pydantic constructs it),
  idempotent, and unit-tested against a fixture with mixed
  `win_` / `apt_` ids. The Alembic migration also runs the same
  rewrite as a one-time normalisation so cached documents in
  Postgres get the new ids.
- **R-01-2. Adding `name` and `operation` to existing element
  documents.** Existing dev rows have neither field. Mitigation:
  pydantic defaults supply `name="Unnamed"` and `operation=None`;
  the migration also issues an `UPDATE` over `project_documents`
  to backfill so the on-disk JSON matches the shipped model.
- **R-01-3. Coverage validation rejects existing documents.** Any
  existing dev document that has gaps is invalid under the new
  rule. Mitigation: the migration scans existing documents, and
  for any that fail coverage, rewrites them so the existing single
  default element covers the whole grid (single element with
  `row_span=(0,R-1)`, `column_span=(0,C-1)`). Operator runs the
  migration on a dev DB only — production has none.
- **R-01-4. Default-refs seeding creates "fake" catalog rows.**
  The `PHN-Default-*` rows look like real catalog products to
  pickers. Mitigation: rows are marked `seeded=True` and the
  catalog manager filters them from the catalog list by default
  (a `Show PHN defaults` toggle reveals them). Until the catalog
  manager ships that toggle (catalog feature scope, not this PRD),
  the rows appear in the picker list — acceptable transitional
  state.
- **R-01-5. ApertureCommand surface grows uncontrolled.** Risk:
  each later phase adds two or three commands, the union balloons.
  Mitigation: the command shape is one-gesture-equals-one-command;
  no "bulkUpdate" commands. Phase 13 (semantic MCP) is the audit
  point — if the command list looks bloated by then, the MCP
  surface is the right place to consolidate, not the browser side.
- **R-01-6. Legacy `WindowTypeEntry` alias.** Carrying the alias
  for one phase risks third-party imports leaking past Phase 02.
  Mitigation: the alias module emits a runtime
  `DeprecationWarning` on import (filtered by pytest under
  `error::DeprecationWarning`) so any test that imports the alias
  fails CI; Phase 02 deletes the alias outright.
