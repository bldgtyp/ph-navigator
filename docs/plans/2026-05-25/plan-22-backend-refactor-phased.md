---
DATE: 2026-05-25
TIME: planning (multi-PR phased implementation)
STATUS: Proposed. Phased refactor of the backend ahead of the next
        feature wave (ERV/Pumps/Fans/Thermal-Bridge DataTables,
        Windows/Assemblies builder pages, 3D-Model-Viewer feature).
        Each phase below is a single reviewable PR that lands on
        `main` independently — no phase blocks the others structurally,
        but ordering reflects "cheapest wins first, then big splits,
        then convention cleanup."
PARENT-DOC: docs/code-reviews/2026-05-25/backend-code-review.md
RELATED:
  - context/CODING_STANDARDS.md
  - context/PRD.md
  - backend/features/project_document/schema_mutations.py (1,709 lines — split target)
  - backend/features/mcp/server.py (792 lines — refactor target)
  - backend/features/project_document/document.py (validator extraction)
  - backend/features/project_document/drafts.py (ETag helper extraction)
  - backend/database.py (pool init)
  - backend/features/auth/service.py + backend/features/shared/middleware.py (client_ip)
---

# Plan 22 — Backend Refactor (Phased)

## 0. Why

The backend code-review at `docs/code-reviews/2026-05-25/backend-code-review.md`
identified ten prioritized issues. Three are structurally urgent
because the next feature wave will land directly on top of the
affected files:

- **ERV / Pumps / Fans / Thermal-Bridge** DataTables will register
  through `tables/` and add custom-field handlers — those handlers
  belong in a split `mutations/` sub-package, not back into the
  1,709-line `schema_mutations.py`.
- **Windows / Assemblies builder pages** will add sub-element write
  surfaces beyond the existing whole-table replace pattern — they
  need a clean mutations layout to slot into.
- **3D-Model-Viewer** will add a new `features/model_viewer/` feature
  that must follow the four-module convention consistently — gaps in
  `system/` and `schemas/` need to be closed first so the pattern is
  unambiguous.

The remaining items are smaller correctness, consistency, and
operational fixes. They are batched into thematic PRs that are safe
to land in any order after Phase 1.

This plan is **structural only** — no behavior changes, no new
features, no schema migrations. Every phase preserves wire contracts,
audit-log shapes, and HTTP responses.

## 1. Goal

After all phases land:

- `features/project_document/schema_mutations.py` is gone, replaced
  by a `mutations/` sub-package with one file per concern.
- `features/mcp/server.py` no longer hides ~460 lines of tool
  closures inside a single factory.
- `features/project_document/document.py`'s validator passes live in
  `validation.py`; the lazy import inside the model class is gone.
- Every feature directory under `features/` follows the same
  `routes.py` / `models.py` / `service.py` / `repository.py` layout
  (where applicable).
- All known correctness issues from the review (`assert` in prod
  paths, pool-init race, divergent `client_ip`, double imports) are
  fixed.
- Test coverage holds at parity — no behavior is intentionally
  changed.

## 2. Verification (applies to every phase)

Every PR is done only when **all** of the following pass:

1. `cd backend && uv run ruff check .`
2. `cd backend && uv run ty check`
3. `cd backend && uv run pytest`
4. `make smoke` from repo root.
5. `make e2e` (Playwright) — should be unchanged, since no UI
   behavior changes.
6. `git diff` shows no changes to wire-contract response shapes
   (verify by grepping for `model_dump`, `model_validate`,
   `ProjectDocumentReadSafeEnvelope`, `RoomsSliceResponse`, etc.).
7. `git grep` for the old import paths returns no hits outside the
   PR's compatibility shims (if any).

Each phase additionally lists phase-specific verification under
its own §V.

## 3. Phase Ordering & Dependencies

### 3.1 Recommended Execution Order

**Land the PRs in this order:**

| Execute | Phase | Title | Rationale |
|---|---|---|---|
| **1st** | Phase 6 | Correctness, safety, code-noise fixes | Cheapest wins, smallest review surface, eliminates known bugs immediately |
| **2nd** | Phase 5 | Convention cleanup | Locks in the four-module pattern before the model-viewer feature uses it |
| **3rd** | Phase 4 | Extract `_load_draft_context` | One-hour win; must land before TB-17 (MCP direct-table-write) |
| **4th** | Phase 3 | Extract `document.py` validator | Decouples validation from the model class; prepares for typed `EquipmentTables` |
| **5th** | Phase 1 | Split `schema_mutations.py` → `mutations/` | Biggest PR — land after the surface is calm; **must precede** the next custom-field-capable table (ERV / Pumps / Fans) |
| **6th** | Phase 2 | Extract MCP tool closures | Land last; **must precede** any new MCP tool addition |

### 3.2 Dependency Map

```
Phase 1 (mutations/ split) ──────────┐
                                     ├── unblocks ERV/Pumps/Fans tables
Phase 2 (MCP tool extraction) ───────┤
                                     │
Phase 3 (document.py validator) ─────┤
                                     │
Phase 4 (drafts.py ETag helper) ─────┤
                                     │
Phase 5 (convention cleanup) ────────┤
                                     │
Phase 6 (correctness/safety) ────────┘── unblocks 3D-viewer & builders
```

- Phases are independent at the file level — any phase **can** be
  done first if circumstances require it. The execution order in
  §3.1 is the recommended sequence, not a hard dependency chain.
- **Hard constraints** (not just recommendations):
  - Phase 1 **must** land before the next custom-field-capable
    table is registered (ERV / Pumps / Fans), otherwise new
    `_apply_*` handlers go back into the 1,709-line file.
  - Phase 2 **must** land before any new MCP tool is added,
    otherwise the new tool goes back into the 460-line closure.
  - Phase 4 **must** land before TB-17 (MCP direct-table-write),
    otherwise the ETag-gating block gets copy-pasted a third time.

---

## Phase 1 — Split `schema_mutations.py` into `mutations/` *(execute 5th)*

### 1.1 Scope

Replace `backend/features/project_document/schema_mutations.py`
(1,709 lines) with a `mutations/` sub-package. Pure structural
refactor — every function, class, constant, and `_apply_*` handler
moves to a new file unchanged.

### 1.2 Target Layout

```
backend/features/project_document/mutations/
    __init__.py            # re-export public symbols for backward compat
    models.py              # AUDIT_KIND_BY_MUTATION, CONVERSION_MATRIX,
                           # all *Mutation Pydantic classes, FieldSchemaMutation union
    dispatcher.py          # apply_schema_mutation, validate_schema_mutation
    guards.py              # _check_stale_fingerprint, _find_field,
                           # _reject_field_id_collision,
                           # _reject_duplicate_display_name,
                           # _resolve_insert_position,
                           # _strip_field_from_rows,
                           # _read_rows_from_envelope,
                           # _replace_rows_in_envelope
    field_ops.py           # _apply_add_field, _apply_rename_field,
                           # _apply_delete_field, _apply_duplicate_field,
                           # _apply_set_description
    options_ops.py         # _resolve_option_target,
                           # _validate_default_option_id,
                           # _apply_edit_options
    type_conversion.py     # _format_number_for_text,
                           # _try_coerce_for_change_type,
                           # _materialize_options_for_text_to_select,
                           # _apply_change_type
    formula_ops.py         # _raise_formula_* error translators,
                           # _apply_set_formula
    bundle.py              # _apply_edit_field_bundle
```

### 1.3 Additionally in this PR

- **Move `_count_ast_nodes` and `_infer_result_type`** (currently
  schema_mutations.py:1629, 1667) to
  `backend/features/project_document/formula/evaluator.py` (or
  `ast_nodes.py` if more appropriate). Lift the 10–12 deferred
  imports to module level. Update callers in `formula_ops.py` to
  import from `formula/`.
- **Refactor `_apply_change_type`** (~202 lines) into:
  - `_change_type_preflight(rows, field_id, policy, ...) -> (writes, incompatible)`
  - `_apply_change_type(body, mutation, capability)` — orchestration
- **Refactor `_apply_edit_field_bundle`** (~204 lines) by extracting
  each of the six numbered comment sections into its own
  `_bundle_step_<n>_<name>(...)` helper inside `bundle.py`.
- **Replace `isinstance` dispatch chain** in
  `dispatcher.apply_schema_mutation` with a
  `_HANDLERS: dict[str, Callable]` lookup keyed by
  `mutation.kind`. Same for `validate_schema_mutation`.

### 1.4 Backward-compatibility shim

`mutations/__init__.py` re-exports every public symbol that
`schema_mutations.py` exported, so callers that do
`from features.project_document.schema_mutations import X` keep
working through the transition. After all internal callers are
updated within this PR, leave a 5-line
`schema_mutations.py` that re-exports from `mutations/` for one
release cycle, then delete in Phase 1.5 (separate PR).

### 1.5 Verification (phase-specific)

- `git grep "from features.project_document.schema_mutations"` —
  every hit is either the compat shim or a deliberately retained
  legacy path.
- `cd backend && uv run pytest tests/test_project_document_schema_mutations.py
   tests/test_project_document_schema_mutation_endpoint.py
   tests/test_mcp_custom_fields.py` — all pass with zero changes.
- Audit-log payload shapes unchanged: spot-check three mutation
  kinds (`addField`, `changeType`, `editFieldBundle`) by snapshotting
  `audit_action.payload` before and after on a fresh DB.
- No file in `mutations/` exceeds 500 lines. (Stretch: no file
  exceeds 400.)

### 1.6 Risks

- Largest single PR in the plan. Estimate 600–800 lines moved, 20–30
  imports updated across `drafts.py`, `mcp/server.py`,
  `service.py`, and the table contracts.
- Mitigation: do the move in a single mechanical commit (no logic
  edits), then a second commit for the dispatcher and the two
  big-function extractions, then a third commit for the AST helper
  move. Three commits in one PR makes review tractable.

---

## Phase 2 — Extract MCP tool closures from `build_mcp_server()` *(execute 6th — last)*

### 2.1 Scope

`backend/features/mcp/server.py` lines 61–518 are ~460 lines of
`@mcp.tool()` closures inside `build_mcp_server()`. The only reason
they're closures is the captured `allow_env_token` bool.

### 2.2 Target Structure

Option A (recommended): each tool becomes a module-level function
that takes `allow_env_token` as an explicit parameter, plus a thin
registrar:

```python
# backend/features/mcp/tools/__init__.py
from . import projects, documents, schema_mutations, tables, ...

def register_all(mcp: FastMCP, *, allow_env_token: bool) -> None:
    projects.register(mcp, allow_env_token=allow_env_token)
    documents.register(mcp, allow_env_token=allow_env_token)
    ...
```

```python
# backend/features/mcp/tools/projects.py
def register(mcp: FastMCP, *, allow_env_token: bool) -> None:
    @mcp.tool()
    async def list_projects(...) -> ...:
        return await _list_projects(..., allow_env_token=allow_env_token)

async def _list_projects(..., *, allow_env_token: bool) -> ...:
    """Unit-testable, no @mcp.tool decorator."""
    ...
```

`build_mcp_server()` shrinks to ~30 lines: instantiate `FastMCP`,
call `register_all`, return.

### 2.3 Additionally in this PR

- Narrow `mutation: BaseModel` to `mutation: FieldSchemaMutation`
  in `_apply_mcp_schema_mutation_with_audit` (server.py:698) — drop
  the `cast` at line 723.
- Tag the `replace_table` stub (server.py:171–195) with `# TB-17`
  in the code so a code search finds the placeholder.
- Fix `project_access_for_token` (mcp/service.py:141) to return
  `mode="edit"` when scope is `"project:write"`.

### 2.4 Verification (phase-specific)

- `cd backend && uv run pytest tests/test_mcp.py tests/test_mcp_custom_fields.py` —
  all pass without modification.
- Start the MCP server locally and run one tool through the
  Inspector to confirm the wire surface is unchanged.
- New unit tests: import and call at least three tool body
  functions directly (without `build_mcp_server()`), proving the
  per-tool testability gain.

### 2.5 Risks

- `FastMCP` may inspect the closure's enclosing scope for
  introspection; verify by running the tool registry and confirming
  every tool's name, description, and parameter schema is identical
  before vs after.

---

## Phase 3 — Extract `document.py` validator passes into `validation.py` *(execute 4th)*

### 3.1 Scope

`ProjectDocumentBody.validate_document_references` in
`backend/features/project_document/document.py` (lines 322–485) is a
~163-line `@model_validator(mode="after")` that runs five passes
and contains a lazy import to break a circular dependency.

### 3.2 Target Structure

Move each pass to a standalone function in `validation.py`:

```python
# backend/features/project_document/validation.py
def validate_core_option_lists(body: ProjectDocumentBody) -> None: ...
def validate_rooms_custom_field_uniqueness(body: ProjectDocumentBody) -> None: ...
def validate_rooms_custom_value_types(body: ProjectDocumentBody) -> None: ...
def validate_default_option_ids(body: ProjectDocumentBody) -> None: ...
def validate_rooms_formula_cycles(body: ProjectDocumentBody) -> None: ...

def validate_document_references(body: ProjectDocumentBody) -> None:
    """Composite — call from validate_document() and from the model_validator."""
    validate_core_option_lists(body)
    validate_rooms_custom_field_uniqueness(body)
    validate_rooms_custom_value_types(body)
    validate_default_option_ids(body)
    validate_rooms_formula_cycles(body)
```

The `@model_validator` on `ProjectDocumentBody` becomes a 3-line
shim that delegates to `validation.validate_document_references`.
The lazy `from features.project_document.formula.evaluator import …`
moves to module level in `validation.py` (no longer circular,
because `validation.py` is a leaf module).

### 3.3 Additionally in this PR

- Add `ROOMS_CORE_DISPLAY_NAMES` parity test: a unit test that
  reads the frontend's `roomsTableFieldDefs` registry (parse the TS
  file or import a generated JSON fixture) and asserts equality.
  Fail-loud is the goal — silent drift is the bug.
- Rename `EmptyEquipmentTables` to `EquipmentTables` and replace
  `fans/pumps/ervs: list[dict[str, object]]` with typed row stubs
  (`FanRow`, `PumpRow`, `ErvRow`) as empty Pydantic models. This
  establishes the typed pattern before the table contracts land.

### 3.4 Verification

- `cd backend && uv run pytest tests/test_project_document.py
   tests/test_project_document_window_types.py
   tests/test_project_document_default_option_fill.py` — pass.
- New unit tests in `tests/test_project_document_validation.py`
  hitting each of the five extracted functions independently.

---

## Phase 4 — Extract `_load_draft_context` from `drafts.py` *(execute 3rd)*

### 4.1 Scope

`replace_table_slice` (drafts.py:34) and
`apply_schema_mutation_to_draft` (drafts.py:105) share ~35 lines of
identical setup. Extract once before MCP direct-table-write (TB-17)
becomes the third copy.

### 4.2 Target Structure

```python
# backend/features/project_document/drafts.py
@dataclass(frozen=True)
class DraftContext:
    base_body: ProjectDocumentBody
    base_version_etag: str
    draft_etag: str | None
    version_locked: bool  # already-raised before return; here for completeness

def _load_draft_context(
    conn: Connection[Any],
    *,
    project_id: UUID,
    version_id: UUID,
    user: UserPublic,
    if_match: str | None,
    if_match_version: str | None,
) -> DraftContext: ...
```

Both call sites become 1 line + business logic.

### 4.3 Additionally in this PR

- **Add `_apply_default_option_fill`** to `tables/rooms.py`,
  extracting the new-row default-option-id forward-fill from
  `apply_rooms_replace` (lines 129–198). This brings
  `apply_rooms_replace` under the 50-line guideline.
- **Use `DiffTarget = Literal["draft"]`** as the route annotation
  in `routes.py:231` for the `to:` query parameter.

### 4.4 Verification

- `cd backend && uv run pytest tests/test_project_document.py
   tests/test_table_views.py
   tests/test_project_document_schema_mutation_endpoint.py` — pass.
- Spot-check: a 412 (ETag mismatch) response on both endpoints
  carries the same error code and body shape as before.

---

## Phase 5 — Convention cleanup (pattern consistency) *(execute 2nd)*

Pure consistency fixes. None of these change behavior; all of them
make the codebase predictable for the upcoming model-viewer feature
which will use the four-module pattern from day one.

### 5.1 Scope

1. **`features/system/`**: add `models.py`; move `HealthResponse`
   and `VersionResponse` out of `routes.py`.
2. **`features/schemas/`**: add `service.py`; move the cached
   `model_schema()` helper out of `routes.py`.
3. **`CurrentUser` type alias**: define once in
   `features/auth/routes.py`; import from there in the five other
   `routes.py` files (`projects`, `catalogs/materials`,
   `catalogs/frame_types`, `catalogs/glazing_types`, `mcp`).
4. **`get_request_id(request)` utility**: add to
   `features/shared/http.py` (new file). Use in `routes.py:220`,
   `store.py`, and `middleware.py`.
5. **`log_project_action()` wrapper**: add to `projects/audit.py`
   (new file, mirroring `project_document/audit.py` and
   `catalogs/_shared.py`). Replace the direct
   `auth_repository.log_action()` call in `projects/service.py`.
6. **Document the `service.py` facade pattern**: add a docstring at
   the top of `features/project_document/service.py` explaining
   that it intentionally re-exports from siblings to provide a
   stable import surface. Same for any other facades introduced by
   Phases 1–2.
7. **Document `formula/ast_nodes.py` naming**: add a one-line
   comment explaining that this module fills the `models.py` role
   for the formula sub-package; the rename to `models.py` is
   rejected to keep the AST-vocabulary obvious to readers.

### 5.2 Verification

- `git grep "CurrentUser = Annotated"` returns exactly one hit.
- `git grep "request.state.request_id"` returns hits only inside
  `features/shared/`.
- `git grep "auth_repository.log_action"` returns hits only inside
  the per-feature `audit.py` wrapper modules.
- All routes still respond on the same paths with the same shapes
  (smoke test).

---

## Phase 6 — Correctness, safety, and code-noise fixes *(execute 1st — start here)*

Small, mechanical, high-confidence fixes. Group into one PR so they
land together.

### 6.1 Scope

1. **`database.py` `get_pool()` race**: wrap the
   `if _pool is None` block in a `threading.Lock`. Add a unit test
   that calls `get_pool()` from 50 threads concurrently and asserts
   only one pool was created (mock `ConnectionPool` to count
   constructions).
2. **`refresh.py` bare `assert`**: replace lines 200 and 219 with
   `if … is None: raise RuntimeError(...)`.
3. **`client_ip()` unification**: move the `X-Forwarded-For`-aware
   implementation from `shared/middleware.py:_client_ip()` to
   `features/shared/http.py:client_ip(request)`. Update
   `auth/service.py:client_ip()` to delegate. Add a unit test with
   `X-Forwarded-For: 1.2.3.4, 5.6.7.8` confirming the leftmost IP
   is returned.
4. **`options.py` double import**: delete the
   `from collections.abc import Iterable as IterableT` alias
   (line 16). Update the (one or two) usages.
5. **`options.py` deferred `import secrets`**: move to module level.
6. **`main.py` `lifespan` return type**: annotate as
   `async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:`.
7. **`logging_config.py` redaction recursion**: recurse one level
   into nested `dict` values inside `_redact_sensitive`. Add unit
   test for `details={"token": "abc"}`.
8. **`formula/__init__.py` `Literal` export**: rename the export to
   `LiteralNode` (already the AST class's secondary name) and
   remove the bare `Literal` alias from `__all__`. Update the (one
   or two) consumers.
9. **`repository.py` SQL-interpolation comment**: add a 1-line
   comment above the f-string interpolation explaining the
   constant is module-level and never user-controlled.
10. **`audit.py` `conn: Any`**: tighten to `Connection[Any]`.
11. **`shared/middleware.py` origin check** (line 67): decide
    whether `None` origins should 403 or pass. Document the
    decision in a comment either way. If they should pass for
    non-browser clients (curl smoke tests), update the check to
    `if origin is not None and origin not in settings.cors_origins_set`.

### 6.2 Verification

- `cd backend && uv run pytest` — all green.
- New tests for items 1, 3, 7 above.
- `cd backend && uv run ruff check .` — clean.
- `cd backend && uv run ty check` — clean.

### 6.3 Risks

- Item 11 (`shared/middleware.py` origin check) is the only item
  with a possible behavior change. Get explicit user confirmation
  on the desired behavior before flipping the check. Default
  recommendation: pass `None`-origin requests for non-mutating
  paths only — preserves curl-based smoke tests without weakening
  CSRF defense for browser-originated writes.

---

## 4. Pre-conditions for the next feature wave

After all six phases land, the backend is ready for the upcoming
features. Each new feature can rely on the following invariants:

### 4.1 DataTable pages (ERV, Pumps, Fan, Thermal-Bridge)

- Register a `TableContract` in
  `features/project_document/tables/<table_name>.py`.
- Add custom-field `_apply_*` handlers (if needed) to
  `features/project_document/mutations/field_ops.py` or a
  table-specific `mutations/<table_name>_ops.py`.
- Add the typed row model to `document.py:EquipmentTables`.
- Add a parity test against the frontend field-def registry.

### 4.2 Builder pages (Windows, Assemblies)

- Sub-element mutations (add/remove elements inside a window type
  or assembly) get their own mutation surface in
  `mutations/<feature>_mutations.py` — separate from the
  `FieldSchemaMutation` union, which is custom-field-only.
- Assemblies with per-layer material refs reuse the
  `refresh.py` pattern: add an entry to
  `_COMPARED_FIELDS_BY_CATALOG`.

### 4.3 3D-Model-Viewer

- Create `features/model_viewer/` with the four-module layout:
  `routes.py`, `models.py`, `service.py`, `repository.py`.
- Persist viewer view-state (camera, layer visibility) via the
  existing `table_views` feature with `table_key="3d_viewer"` —
  do not build a parallel persistence path.
- Geometry payload lives in R2, **not** in the versioned project
  document. The viewer endpoint returns a presigned URL plus a
  geometry-blob ETag computed independently of `document_etag`.

## 5. Sequencing relative to existing work

- Plan 20 (Pumps table reuse test) and Plan 21 (custom-field
  header config modal) are unrelated and can land in parallel.
- The custom-fields Phase 4 work in Plan 17 is the immediate
  upstream for **Phase 1** of this plan: ideally Plan 17 lands
  first so `mutations/` is split against the final set of
  handlers.
- TB-17 (MCP direct-table-write) is the planned third copy of the
  `_load_draft_context` block; Phase 4 should land before TB-17
  starts.

## 6. Out of scope (do **not** add to these PRs)

- New features, new routes, new tables, new schemas.
- Any change to the wire contract of an existing endpoint.
- Alembic migrations (none of these phases touch persistence
  schemas).
- Frontend changes — frontend is a separate review/plan track.
- Performance optimizations beyond the function-level import lifts
  in Phase 1 and the validator extractions in Phase 3.
- Replacing the AST `isinstance` dispatch chains with a `match`
  statement — captured as a follow-up after Phase 1 lands and the
  dispatch sites are visible in one place.

## 7. Estimated effort

| Phase | Scope | Estimated effort |
|---|---|---|
| 1 | `mutations/` split + AST helper move + two function extractions | 4–6 h |
| 2 | MCP tool extraction | 2–3 h |
| 3 | Validator extraction + parity test + EquipmentTables typing | 2 h |
| 4 | `_load_draft_context` + rooms helper + DiffTarget | 1 h |
| 5 | Convention cleanup (7 items) | 1.5 h |
| 6 | Correctness/safety fixes (11 items) | 2 h |
| **Total** | | **12.5–15.5 h** |

Land in 6 PRs over ~2 weeks at a comfortable pace. None of these
PRs depend on each other for correctness; the recommended ordering
(6 → 5 → 4 → 3 → 1 → 2) is purely to keep review surface area
small early and reserve the big PRs for last.
