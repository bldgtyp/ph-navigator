# PH-Navigator V2 Backend Code Review

**DATE: 2026-05-25**

---

## 1. Executive Summary — Top Issues by Impact

The backend is genuinely well-structured. The pattern language is consistent, raw-SQL repository discipline is held firmly, Pydantic v2 is used correctly throughout, and `from __future__ import annotations` / `__all__` hygiene is good. Several features are clearly ahead of schedule in sophistication (formula engine, MCP tooling). That said, five issues warrant attention before the next feature wave lands.

**Top 10 Issues, Prioritized**

1. **`schema_mutations.py` is 1,709 lines and mixes three distinct roles** — mutation wire contracts (Pydantic models), mutation business logic (apply-dispatchers), and formula-error translation helpers — in one file. Every new DataTable page with custom-field support will deepen it further. Split now. *(Critical — structural)*

2. **`mcp/server.py` implements all MCP tools as ~460 lines of closures inside `build_mcp_server()`** — a single factory function that cannot be unit-tested per-tool, cannot be imported piecemeal, and will require navigating a 460-line body to add each new tool. *(High — structural + testability)*

3. **`document.py`'s `validate_document_references` model-validator (~163 lines body)** runs five distinct validation passes inline, including a lazy import inside the class body. These passes belong in `validation.py` or a `document_validator.py`. *(Medium — correctness risk on extension)*

4. **`project_document/` has 15 top-level sibling modules with no sub-namespacing.** When ERV/Pumps/Fans/Assemblies/Thermal-Bridge tables land, the flat layout becomes unnavigable. Plan a `mutations/` and `workflows/` sub-package now. *(Medium — scaling)*

5. **`service.py` is a pure re-export facade** (51 lines, 0 logic) pulling from 6 different modules. This is useful but violates the stated CLAUDE.md convention ("each feature gets a `service.py`" that *contains* logic). Document the pattern explicitly or rename. *(Low-medium — convention clarity)*

6. **`_count_ast_nodes` and `_infer_result_type` (schema_mutations.py:1629, 1667) re-import 5–6 AST node classes inside the function body on every call.** These helpers belong in `formula/` and the imports should be module-level. *(Medium — performance + readability)*

7. **`options.py` imports `Iterable` from `collections.abc` twice** with two different aliases (`Iterable` and `IterableT`) at lines 15–16, and does a deferred `import secrets` inside `mint_option_id()`. *(Low — code noise)*

8. **`refresh.py` uses bare `assert` statements** (lines 200, 219) in production code paths instead of defensive raises. These are stripped by `-O` and will produce unhelpful `AssertionError` instead of structured responses. *(Medium — runtime safety)*

9. **`database.py`'s `get_pool()` is not thread-safe for the first call.** The `if _pool is None: _pool = ...` pattern is a double-checked locking hole under concurrent first-call scenarios. *(Low at current scale; real in production)*

10. **`client_ip` is implemented differently in two places** — `auth/service.py` reads `request.client.host` only; `shared/middleware.py` parses `X-Forwarded-For`. One will log wrong IPs behind a reverse proxy. *(Medium — operational)*

---

## 2. Structural / Organizational Issues

### 2.1 `project_document/` — Flat Module Sprawl

Current layout (15 sibling modules + 2 sub-packages):

```
features/project_document/
    __init__.py
    audit.py
    custom_fields.py
    diff.py
    document.py
    downloads.py
    drafts.py
    models.py
    options.py
    refresh.py
    repository.py
    routes.py
    schema_mutations.py   ← 1,709 lines
    service.py            ← facade only
    store.py
    validation.py
    versions.py
    formula/              ← well-organized
    tables/               ← well-organized
```

The `formula/` and `tables/` sub-packages are exemplary. The top-level sibling list is already at its limit and will grow with each new DataTable feature.

**Recommended sub-namespacing:**

```
features/project_document/
    document.py               (unchanged)
    custom_fields.py          (unchanged)
    models.py                 (unchanged)
    validation.py             (unchanged)
    options.py                (unchanged)
    routes.py                 (unchanged)
    tables/                   (unchanged, add contracts per table)
    formula/                  (unchanged)
    workflows/                (NEW — extracted from current siblings)
        __init__.py
        audit.py
        diff.py
        downloads.py
        drafts.py
        refresh.py
        store.py
        versions.py
        repository.py
    mutations/                (NEW — split schema_mutations.py)
        __init__.py
        models.py             (wire contract Pydantic classes)
        dispatcher.py         (apply_schema_mutation, validate_schema_mutation)
        guards.py             (_find_field, _reject_*, _strip_field_from_rows, etc.)
        field_ops.py          (_apply_add/rename/delete/duplicate/set_description)
        options_ops.py        (_apply_edit_options, _resolve_option_target)
        type_conversion.py    (_apply_change_type, coercion helpers)
        formula_ops.py        (_apply_set_formula, formula-error translators)
        bundle.py             (_apply_edit_field_bundle)
    service.py                (keep as facade)
```

When a new table (ERVs) needs custom-field support, its `_apply_*` handlers land in `mutations/field_ops.py` or a new `mutations/erv_ops.py`, not back in the 1,709-line file.

### 2.2 Inconsistent `models.py` Presence

CLAUDE.md convention: "each feature gets `routes.py`, `models.py`, `service.py`, and `repository.py`."

- `features/system/` — only `routes.py`. `HealthResponse` and `VersionResponse` are defined inline in `routes.py`. Should be in `models.py`.
- `features/schemas/` — only `routes.py`. The `model_schema()` cache helper is service logic; it should be in a `service.py`.
- `features/shared/` — no `models.py`. `ErrorEnvelope` lives in `errors.py`. Fine — `shared/` is cross-cutting utilities, not a "feature."
- `features/project_document/formula/` — no `models.py`; AST dataclasses live in `ast_nodes.py`. Reasonable naming choice for the domain, but it diverges from convention. Document it.

### 2.3 `features/mcp/server.py` — Factory Closure Architecture

All MCP tools are `@mcp.tool()` closures inside `build_mcp_server()` (lines 61–518, ~460 lines). The only reason everything lives inside the factory is the `allow_env_token` closure variable.

**Problems:** Individual tools cannot be imported and unit-tested in isolation. Adding a new tool requires finding the insertion point in a 460-line body. The module-level helpers below the factory (`current_token`, `parse_uuid`, `raise_mcp_error`, etc., lines 521–792) demonstrate the correct pattern — they are already module-level functions.

**Recommendation:** Extract each `@mcp.tool()` body into a module-level function that accepts `allow_env_token` as an explicit parameter. `build_mcp_server()` becomes ~30 lines of registration calls. Alternatively, create a `McpToolset` class that holds `allow_env_token` and registers methods.

### 2.4 Stray `backend/frontend/` Directory

The task prompt flags a stray `backend/frontend/` directory. If it exists on disk, it is almost certainly a scaffolding leftover. Delete it — it will confuse path-based test runners.

---

## 3. Per-Module Findings

### `backend/main.py` (72 lines)

Solid. Clean lifespan, correct middleware order, no business logic.

**Minor (confidence 80):** `lifespan` lacks a return-type annotation. Annotate as `async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:` (and add the `AsyncGenerator` import) to make the protocol contract explicit.

---

### `backend/config.py` (147 lines)

Very clean. Derived properties (`cors_origins_list`, `mcp_allowed_hosts_list`, etc.) are well-factored. No major issues.

---

### `backend/database.py` (64 lines)

**Issue (confidence 80):** `get_pool()` is not thread-safe for the first call. The `if _pool is None: _pool = ...` pattern is a double-checked locking hole. Under Uvicorn with multiple sync workers or concurrent async tasks hitting the first call simultaneously, two pool instances could be created. Use a `threading.Lock` around the `if _pool is None` block, or initialize the pool unconditionally at module level and expose `reset_pool_for_tests()` for teardown.

**Minor:** `connection()` docstring says "for repository read operations" but it is also used for reads inside transaction-adjacent workflows. The distinction between `connection()` and `transaction()` is "no explicit transaction" vs "explicit transaction" — the docstring should say that rather than implying it is read-only.

---

### `backend/logging_config.py` (202 lines)

Excellent. Sensitive-key redaction, truncation, global-context injection, and pytest-handler preservation are all well-considered.

**Issue (confidence 80):** `_redact_sensitive` only checks top-level keys on the event dict. Nested dicts (e.g. `details={"token": "abc"}` in `api_error` payloads) are not recursed into. This is probably an acceptable scope decision but should be documented explicitly, or the redactor should recurse one level into nested `dict` values.

---

### `backend/features/shared/errors.py` (109 lines)

Clean. `api_error()` and `error_response()` serve different call sites correctly (service code raises; middleware constructs directly). The distinction is valid but undocumented — add a comment.

---

### `backend/features/shared/middleware.py` (107 lines)

Good. Origin-check for mutating methods is sensible defense-in-depth.

**Issue (confidence 85):** The origin check at line 67 (`if origin not in settings.cors_origins_set`) also rejects requests with *no* `Origin` header (non-browser clients). `origin` will be `None` for curl/server-to-server calls, which won't be in `cors_origins_set`. This means every `POST/PUT/PATCH/DELETE` to `/api/` paths from non-browser clients gets a 403 — even if the comment says "Non-browser write clients should use dedicated token surfaces such as MCP." Verify this is intentional; curl-based smoke tests against REST write endpoints will silently fail.

---

### `backend/features/auth/`

Follows the pattern cleanly.

**Issue (confidence 80):** `auth/service.py:client_ip()` reads `request.client.host` only. `shared/middleware.py:_client_ip()` parses `X-Forwarded-For` with fallback. In a proxied deployment, `auth/service.py:client_ip()` will record the proxy IP in the audit log, not the real client IP. Consolidate to a single `client_ip(request)` utility in `features/shared/` that both use.

---

### `backend/features/projects/service.py` (198 lines)

**Minor (confidence 75):** `get_project_detail()` (line 173) has optional `project: ProjectSummary | None` and `owner_display_name: str | None` parameters for a bypass shortcut used by `update_project_metadata`. If `project` is supplied but `project_id` doesn't match, no error is raised. Consider splitting into `_build_project_detail(project_id, ...)` (internal) and `get_project_detail(project_id, ...)` (public, always loads from DB) to make the bypass explicitly internal.

**Minor:** `update_project_metadata` calls `auth_repository.log_action()` directly. `catalog/_shared.py` wraps this in `log_catalog_action()`. `project_document/audit.py` wraps it in `log_document_action()`. The `projects` feature is the only one calling `log_action` directly — inconsistent. Add a `log_project_action()` wrapper.

---

### `backend/features/project_document/document.py` (486 lines)

**Issue (confidence 90) — Over-long model-validator:** `validate_document_references` (lines 322–441 + `_validate_rooms_formula_cycles` lines 442–485) is ~163 lines and runs five distinct passes:
1. Core option-list integrity
2. Rooms custom-field uniqueness
3. Per-row custom-value type validation
4. `default_option_id` integrity
5. Formula cycle detection

This validator belongs in `validation.py` or a dedicated `document_validator.py`, not on the model class. The lazy import inside `_validate_rooms_formula_cycles` (lines 447–452) is a workaround for a circular import that only exists because formula validation is coupled to model initialization. Moving the cycle check to `validate_document()` eliminates the lazy import and the coupling.

**Issue (confidence 80):** `ROOMS_CORE_DISPLAY_NAMES` (line 36) is described as "canonical source" but the docstring says the true canonical is the frontend `roomsTableFieldDefs` registry. There is no parity test between the two. If "ERVs" is renamed on the frontend, the backend check silently drifts.

**Minor:** `EmptyEquipmentTables` (line 48) carries `fans`, `pumps`, `ervs` as `list[dict[str, object]]`. Rename to `EquipmentTables` and introduce typed row stubs (`ErvRow`, etc.) now, even as empty dataclasses, to establish the typed pattern before TableContracts are registered.

---

### `backend/features/project_document/schema_mutations.py` (1,709 lines)

This is the most important file to split. The module mixes:

**Models (lines 1–302):** `AUDIT_KIND_BY_MUTATION`, `CONVERSION_MATRIX`, all 8 `*Mutation` Pydantic classes, `FieldSchemaMutation` union.

**Dispatcher (lines 304–371):** `apply_schema_mutation`, `validate_schema_mutation`.

**Field CRUD dispatchers (lines 374–596):** `_apply_add_field`, `_apply_rename_field`, `_apply_delete_field`, `_apply_duplicate_field`, `_apply_set_description`.

**Shared guards (lines 553–714):** `_check_stale_fingerprint`, `_find_field`, `_reject_field_id_collision`, `_reject_duplicate_display_name`, `_resolve_insert_position`, `_strip_field_from_rows`, `_read_rows_from_envelope`, `_replace_rows_in_envelope`.

**EditOptions (lines 718–900):** `_resolve_option_target`, `_validate_default_option_id`, `_apply_edit_options`.

**ChangeType (lines 903–1241):** `_format_number_for_text`, `_try_coerce_for_change_type`, `_materialize_options_for_text_to_select`, `_apply_change_type`.

**SetFormula (lines 1244–1414):** 5 `_raise_formula_*` error translators + `_apply_set_formula`.

**EditFieldBundle (lines 1418–1626):** `_apply_edit_field_bundle`.

**AST helpers (lines 1629–1709):** `_count_ast_nodes`, `_infer_result_type`.

**Specific issues:**

- **`_count_ast_nodes` (line 1629) and `_infer_result_type` (line 1667):** Each performs 5–6 deferred `from features.project_document.formula.ast_nodes import ... as ...` imports inside the function body — 10–12 import resolutions per call. These functions belong in `formula/evaluator.py` or `formula/ast_nodes.py`. Move them and make the imports module-level.

- **`_apply_change_type` (lines 1038–1240, ~202 lines):** The longest single function in the backend, 4× the 50-line guideline. It handles option materialization, per-row preflight coercion (including `substitute_labels` branch), acknowledgement gating, field-def replacement, option-list namespace operations, and row writes. Extract:
  - `_change_type_preflight(rows, field_id, policy, ...) -> (compatible_writes, incompatible)`
  - `_apply_change_type(body, mutation, capability)` — orchestration only

- **`_apply_edit_field_bundle` (lines 1422–1626, ~204 lines):** Also far exceeds 50 lines. The numbered comment sections (`# --- 1. Identity ---` through `# --- 6. Default-option-id validation ---`) document six sub-steps that deserve extraction.

- **`apply_schema_mutation` dispatcher (lines 304–349):** The `isinstance` chain works but a dict-of-handlers would be cleaner and easier to extend when new tables need their own mutation flavors:
  ```python
  _HANDLERS: dict[str, Callable[...]] = {"addField": _apply_add_field, ...}
  ```

---

### `backend/features/project_document/drafts.py` (353 lines)

**Issue (confidence 85) — Duplicated ETag-gating block:** `replace_table_slice` (line 34) and `apply_schema_mutation_to_draft` (line 105) share ~35 lines of identical transaction setup:
1. `require_editor_user`
2. `get_project_version_for_update`
3. Check `version["locked"]`
4. `validate_document(version["body"])`
5. `document_etag`
6. `get_draft_for_update`
7. ETag comparison (two branches: no draft vs existing draft)
8. Derive `base_body` + `base_version_etag`

This block will be copy-pasted a third time when MCP direct-table-write lands (TB-17). Extract to `_load_draft_context(conn, project_id, version_id, user_id, if_match, if_match_version) -> (base_body, base_version_etag, draft_etag_or_none)`.

---

### `backend/features/project_document/store.py` (274 lines)

Good. `CurrentDocumentParts` frozen dataclass is an excellent pattern.

**Minor (confidence 80):** `load_current_document_parts` (line 190) calls `require_editor_user(access)` — draft reads require editor authentication. `get_saved_document` (line 47) does not require a user. The asymmetry is correct but undocumented. Add a comment explaining why.

**Minor:** `ReadSafeErrorCode` in `models.py` declares `"schema_migration_failed"` but it is never used in the codebase. Either document the intent (reserved for a future migration path) or remove it.

---

### `backend/features/project_document/repository.py` (258 lines)

Clean raw SQL. All queries use parameterized placeholders.

**Issue (confidence 80):** `PROJECT_VERSION_PUBLIC_COLUMNS` (line 13) is interpolated into SQL via Python f-strings. This is safe because it is a module-level string literal, not user input — but it looks identical to string-concatenation SQL injection on a quick scan. Add a comment: `# Module-level constant, never user-controlled — safe to interpolate`. Alternatively, use `psycopg.sql.SQL` composition as `catalogs/_shared.py` does for dynamic table names.

**Minor:** `save_draft_to_version` and `insert_version_from_body` each contain a second `UPDATE projects` statement after the primary operation. Both are in the same transaction, so atomicity is preserved. Add a comment noting this explicitly, or consider consolidating to a single CTE query.

---

### `backend/features/project_document/validation.py` (53 lines)

Perfect — short, focused, correct. No issues.

**Note:** `document_etag` (line 18) calls `body.model_dump(mode="json")` which is O(document-size). It is called on the hot path for every read, save, and patch. Not urgent at current scale, but worth tracking.

---

### `backend/features/project_document/options.py` (165 lines)

**Issue (confidence 85):** Lines 15–16 import `Iterable` from `collections.abc` twice:
```python
from collections.abc import Iterable, Mapping
from collections.abc import Iterable as IterableT
```
Remove the alias. Use `Iterable` everywhere.

**Minor:** `mint_option_id()` (line 160) does a deferred `import secrets` inside the function body. Move to module level.

---

### `backend/features/project_document/refresh.py` (258 lines)

Good design. N+1 pattern is clearly documented.

**Issue (confidence 90) — Bare `assert` in production code paths:** Lines 200 and 219:
```python
assert origin is not None  # _iter_catalog_refs guarantees this
```
`assert` is stripped by Python's `-O` flag. Replace with:
```python
if origin is None:
    raise RuntimeError(f"Expected catalog_origin on ref; this is a bug in _iter_catalog_refs")
```

---

### `backend/features/project_document/audit.py` (52 lines)

**Minor:** `conn: Any` — should be `Connection[Any]` to match the type used in `repository.py`.

---

### `backend/features/project_document/diff.py` (94 lines)

Excellent.

**Minor:** `get_project_diff` accepts `to_value: str` but the route parameter in `routes.py` line 231 is `to: str`. The `DiffTarget = Literal["draft"]` type alias exists in `models.py` — use it as the route annotation to make the allowed values visible in the OpenAPI spec.

---

### `backend/features/project_document/custom_fields.py` (151 lines)

Clean.

**Minor:** Missing blank line after `mint_custom_field_id()` ends (around line 46) before the `# Scalar set...` comment. Minor style.

---

### `backend/features/project_document/models.py` (107 lines)

**Minor:** `ProjectDocumentReadSafeEnvelope.body: Any` (line 44) — narrow to `JsonValue` (imported from `validation.py`) to signal what shape consumers should expect.

---

### `backend/features/project_document/routes.py` (234 lines)

Good.

**Minor:** `request_id(request)` (line 220) duplicates the same expression pattern from `store.py` and `middleware.py`. Add `get_request_id(request: Request) -> str` to `features/shared/` and import it everywhere.

---

### `backend/features/project_document/tables/contracts.py` (151 lines)

Excellent design. `CustomFieldCapability` frozen dataclass is a principled dependency-injection interface.

**Issue (confidence 80):** `CustomFieldCapability` now has 18 fields (callables + values). Every new custom-field-capable table must populate all 18. Consider whether a `build_capability(...)` factory function with required and optional parameters (via `default=None` guards) would reduce registration boilerplate per table.

**Minor:** `TableContract.parse_replace_payload` (line 141) is a method on the dataclass. It is the only method (all other slots are callable fields). Consider making it a module-level function `parse_replace_payload(model, raw_payload)` for consistency with the rest of the pattern.

---

### `backend/features/project_document/tables/rooms.py` (476 lines)

Large but justified — the most feature-complete table contract.

**Issue (confidence 80) — `apply_rooms_replace` (lines 129–198, ~70 lines):** Exceeds 50-line guideline. Three distinct concerns:
1. `default_option_id` forward-fill for new rows
2. Early-exit equality check
3. Option-list merge

Extract `_apply_default_option_fill(rooms_payload, prior_row_ids, custom_fields)`.

**Issue (confidence 75):** `_read_rooms_core_field_for_formula` (line 377) converts list-valued cores (e.g. `erv_unit_ids`) to comma-joined strings. This is a local convention with no parity test against the TypeScript evaluator. If the TS evaluator handles `erv_unit_ids` differently (length, first element, etc.), the two evaluators diverge silently.

**Minor (line 460):** `_rooms_core_field_type_for_formula` uses `# type: ignore[arg-type]` in the `rooms_custom_fields` registration. The `ignore` is hiding a legitimate type mismatch: `_rooms_core_field_type_for_formula` returns `RoomFormulaType | None` but the `CustomFieldCapability` slot expects `Callable[[str], Literal["text", "number", "single_select", "bool"] | None]`. The types are equivalent — fix the `CustomFieldCapability` annotation to use the correct union instead of suppressing the error.

---

### `backend/features/project_document/tables/window_types.py` (80 lines)

Clean. Correct non-custom-field table pattern.

---

### `backend/features/project_document/tables/registry.py`

Clean.

**Minor:** When the table count grows beyond ~8 (ERV, Pumps, Fans, Assemblies, Thermal-Bridge), the `_TABLES` dict literal becomes a maintenance target. Consider a `@register_table` decorator used in each `tables/*.py` module so `registry.py` never needs manual edits.

---

### `backend/features/project_document/tables/__init__.py`

**Issue (confidence 80):** `RegisteredTableResponse = RoomsSliceResponse | WindowTypesSliceResponse` will need to grow with each new table. This is a manually-maintained union. When the `_TABLES` dict is extended, `RegisteredTableResponse` must also be extended. Consider deriving it programmatically from the registered contracts, or accept the maintenance burden and document it.

---

### `backend/features/project_document/formula/evaluator.py` (572 lines)

Well-structured.

**Issue (confidence 80) — Nested `accessor` closure in `evaluate_table_formulas` (lines 481–497):** The closure is defined inside a `for row in rows` loop and captures `row`, `per_row_computed`, `custom`, and `formula_field_by_id` by reference. The `# noqa: B023` annotations suppress the "function defined in loop" warning. The code is currently safe because `accessor` is synchronous and is never stored beyond the iteration body. However, the comment explains *that* it is intentional but not *why* it is safe. If this function is ever made async, the closure will silently capture the wrong `row`. Refactor `accessor` as a module-level function accepting these values as explicit parameters:

```python
def _make_row_accessor(
    row: object,
    custom: dict[str, CustomValue],
    per_row_computed: dict[str, object],
    formula_field_by_id: dict[str, CustomFieldDef],
    capability: CustomFieldCapability,
) -> Callable[[str], object | None]:
    ...
```

---

### `backend/features/project_document/formula/parser.py` (531 lines)

Good recursive-descent implementation.

**Minor:** `_add()` (line 375) determines operator type via `"+" if self._advance().kind is TokenKind.PLUS else "-"`. This only works because the `while` condition already confirms `PLUS or MINUS`. It is correct but slightly fragile — use the dict lookup pattern from `_mul()` (lines 385–390) for consistency.

---

### `backend/features/project_document/formula/resolver.py` (275 lines)

Well-written.

**Issue (confidence 80):** `_core_display_name_for` (line 91) zips `core_keys` and `core_names` with a length equality guard, silently falling back to the raw key if lengths diverge. If one parallel tuple is extended without the other, `{erv_unit_ids}` in a formula would fail to resolve instead of matching `{ERVs}`. This is a silent failure mode. Use a `dict[str, str]` mapping instead of parallel tuples, and raise at registration time if a key is unmapped.

---

### `backend/features/project_document/formula/__init__.py`

**Issue (confidence 85):** Exports `Literal` (line 22) — this re-exports the AST node class `Literal_` as `Literal`. Callers doing `from features.project_document.formula import Literal` get the AST node, not `typing.Literal`. Use the canonical alias `Literal_` or `LiteralNode` (already defined in `ast_nodes.py`) in the `__all__` export.

---

### `backend/features/mcp/server.py` (792 lines)

The module-level helpers (lines 521–792) are all clean. The factory closure problem is covered in §2.3.

**Issue (confidence 85):** `_apply_mcp_schema_mutation_with_audit` (line 698) takes `mutation: BaseModel` and passes it via `cast(FieldSchemaMutation, mutation)` (line 723). This is a type-system lie — if a non-`FieldSchemaMutation` `BaseModel` were passed, the runtime behavior is undefined. Narrow the type to `FieldSchemaMutation` throughout the internal helpers.

**Minor:** `replace_table` (lines 171–195) is a stub that always raises. It should carry a `# TB-17` tag in the code (not just the docstring) so a search for `TB-17` finds it.

---

### `backend/features/mcp/service.py` (175 lines)

Good.

**Minor:** `project_access_for_token` (line 141) sets `mode="view"` on the returned `ProjectAccess` regardless of requested scope. Write-scope token callers get a `mode="view"` access object, making the `mode` field misleading. Set `mode="edit"` when scope is `"project:write"`.

---

### `backend/features/catalogs/`

Each catalog follows the four-module pattern consistently. `_shared.py` is well-designed.

**Issue (confidence 80):** `CurrentUser = Annotated[tuple[UserPublic, object], Depends(require_current_user)]` is defined identically in `auth/routes.py`, `projects/routes.py`, `catalogs/materials/routes.py`, `catalogs/frame_types/routes.py`, `catalogs/glazing_types/routes.py`, and `mcp/routes.py`. Define once in `features/auth/routes.py` and import everywhere else.

---

### `backend/features/table_views/service.py`

Good.

**Minor:** `validate_table_key()` is called independently in three functions. Could be applied at the route level via a FastAPI dependency or `Annotated` path parameter validator, reducing per-function repetition. Not urgent.

---

### `backend/features/schemas/routes.py` (46 lines)

`model_schema()` is a cached service helper defined in a routes file. Move to a `service.py`.

---

### `backend/features/system/routes.py` (51 lines)

`HealthResponse` and `VersionResponse` should be in a `models.py`.

---

## 4. Duplication & Shared-Abstraction Opportunities

| # | Pattern | Location | Action |
|---|---|---|---|
| 1 | ETag-gating + draft-load block | `drafts.py:34`, `drafts.py:105` | Extract `_load_draft_context()` helper |
| 2 | `client_ip()` implementation | `auth/service.py`, `shared/middleware.py` | Consolidate to `features/shared/http.py` |
| 3 | `CurrentUser` type alias | 6 separate `routes.py` files | Define once in `features/auth/routes.py` |
| 4 | Audit-log wrapper | `project_document/audit.py`, `catalogs/_shared.py`, `projects/service.py` (direct), `mcp/service.py` (direct) | Add `log_project_action()` to `projects/`; route all direct `log_action` calls through feature-level wrappers |
| 5 | `validate_document()` final safety net | `rooms.py:198`, `window_types.py:44`, `schema_mutations.py:348` | Document the intentional double-validation or unify to one call site |
| 6 | AST dispatch chain | `_count_ast_nodes`, `_infer_result_type`, `_resolve_walk`, `collect_field_refs`, `_eval_node` | All implement the same structural dispatch over 6 node types. When a new node is added, all 5 chains must be updated. Consider `node.kind`-based `match` statement (Python 3.10+) |
| 7 | `request_id(request)` | `routes.py:220`, `store.py`, `middleware.py` | `get_request_id(request)` utility in `features/shared/` |

---

## 5. Type Hints & Documentation Gaps

### 5.1 Weakened Type Annotations

| Location | Issue |
|---|---|
| `audit.py:16` | `conn: Any` — should be `Connection[Any]` |
| `schema_mutations.py:671` | `_strip_field_from_rows` returns `list[object]` — at runtime it is `list[RoomRow]`; the wide type forces callers to use `getattr` instead of typed attribute access |
| `mcp/server.py:698` | `mutation: BaseModel` — should be `mutation: FieldSchemaMutation` |
| `store.py:238` | `row_schema_version: object` — could be `int \| None` |
| `schema_mutations.py:305` | `dict[str, object]` audit payload return — a `TypedDict` per mutation kind would catch caller errors |

### 5.2 Missing Module-Level Docstrings

- `features/project_document/__init__.py` — empty
- `features/table_views/__init__.py` — empty

### 5.3 Missing Function Docstrings on Public/Complex APIs

- `_apply_change_type` — no docstring; complex enough to need one
- `_try_coerce_for_change_type` — short inline comment only
- `get_project_detail` (projects/service.py:173) — no docstring explaining the optional bypass

### 5.4 `Literal` Export Name Collision

`formula/__init__.py` exports `Literal` (the AST node class `Literal_`) at line 22. This collides with `typing.Literal` for any caller that does `from features.project_document.formula import Literal`. Use `Literal_` or `LiteralNode` in the `__all__` list.

---

## 6. Refactoring Recommendations (Prioritized)

### P1 — Split `schema_mutations.py` into `mutations/` sub-package

**Scope:** ~2–3 hours mechanical; no logic changes. Do before adding another custom-field-capable table.

Target structure: see §2.1 `mutations/` layout above. The `service.py` facade re-exports `FieldSchemaMutation` and `apply_schema_mutation` from `mutations/` for backward import compatibility.

### P2 — Extract MCP tool closures from `build_mcp_server()`

**Scope:** ~1–2 hours; no logic changes. Each tool becomes a module-level function accepting `allow_env_token` explicitly. Factory becomes ~30 lines.

### P3 — Extract `_load_draft_context` from `drafts.py`

**Scope:** ~30 minutes. Prevents a third copy-paste when TB-17 lands.

### P4 — Harden `database.py` pool initialization

**Scope:** ~15 minutes. Add a `threading.Lock` or move initialization to module level.

### P5 — Consolidate `client_ip` to `features/shared/`

**Scope:** ~20 minutes. Eliminates the proxy-IP logging bug.

### P6 — Replace bare `assert` in `refresh.py:200, 219`

**Scope:** ~5 minutes.

### P7 — Add `models.py` to `system/`, `service.py` to `schemas/`

**Scope:** ~15 minutes. Pattern compliance.

### P8 — Move `_count_ast_nodes` and `_infer_result_type` to `formula/`

**Scope:** ~20 minutes. Eliminates 10–12 function-level import resolutions per call.

### P9 — Fix `options.py` double import and deferred `secrets` import

**Scope:** ~5 minutes.

### P10 — Fix `CurrentUser` alias duplication (6 copies)

**Scope:** ~15 minutes.

---

## 7. Recommendations for Scaling to Upcoming Features

### 7.1 DataTable Pages (ERV, Pumps, Fan, Thermal-Bridge)

Each new DataTable page follows the `TableContract` registration pattern. The slot to fill is `features/project_document/tables/<table_name>.py` + an entry in `registry.py`.

**Critical preparation:**
- Complete **P1** (split `schema_mutations.py`) before registering a custom-field-capable ERV or Pumps table. Otherwise the `_apply_*` handlers for those tables go back into the 1,709-line file.
- Replace `EmptyEquipmentTables.fans/pumps/ervs: list[dict[str, object]]` with typed row models (`ErvRow`, `FanRow`, `PumpRow`) before their `TableContract`s are registered. Untyped dicts mean `extract_rows` returns untyped payloads through the entire read path.
- Each new table that mirrors `ROOMS_CORE_DISPLAY_NAMES` should have a parity test against the corresponding frontend field-def registry constant — add this to the test harness from the start.
- The `core_field_keys` / `core_display_names` parallel-tuple pattern in `resolver.py` is fragile (see §3 / `resolver.py` finding). Switch to a `dict[str, str]` mapping before adding ERV core fields.

### 7.2 Builder Pages (Windows, Assemblies)

**Windows:** The `window_types` table contract exists. A builder page will need sub-element write operations (add/remove elements within a window type's grid). These are more granular than whole-table replace and will likely need a mutation surface. Design that surface in `tables/window_types.py` or a new `mutations/window_mutations.py` rather than extending `FieldSchemaMutation` (which is the custom-field mutation surface, not the table-structure mutation surface).

**Assemblies:** No schema yet. When it lands:
- Define `AssemblyRow` in `document.py` alongside the other row types.
- Register an `assemblies_contract` in `registry.py` and add to `ProjectDocumentTables`.
- If assemblies carry per-layer material references (bookshelf-copy model), they will need the same `CatalogOrigin` / refresh-report pattern as `FrameRef` / `GlazingRef`. The `refresh.py` pattern is parametrized enough to reuse with a new `_COMPARED_FIELDS_BY_CATALOG` entry.
- `RegisteredTableResponse` in `tables/__init__.py` must be extended manually for each new table — consider deriving it from the `_TABLES` registry to eliminate the manual step.

### 7.3 3D Model Viewer

**Payload size concern:** If 3D geometry lives in the project document, `document_etag` (SHA-256 over `model_dump`) will be O(geometry-size) on every read. For large geometry, separate the geometry blob into R2 (already in config) with its own ETag and load it independently of the versioned project document.

**Persistence:** The `table_views` feature's pattern (user-scoped, per-table view state stored as opaque JSON in `project_table_views`) is a natural fit for 3D viewer camera positions and layer visibility state. Reuse it with `table_key="3d_viewer"` rather than building a separate persistence path.

**New routes:** Add a `features/model_viewer/` feature with its own `routes.py`, `models.py`, `service.py`, and `repository.py` following the established four-module pattern. Do not put viewer endpoints in `project_document/routes.py` — that router is already complex.

### 7.4 General Scaling

- **`registry.py` `_TABLES` dict** will grow to 7+ entries (Rooms, WindowTypes, ERVs, Pumps, Fans, Assemblies, ThermalBridges). Consider a `@register_table` decorator so `registry.py` never needs manual edits.
- **`document.py` model-validator:** Extract validation passes to `validation.py` during the ERV addition — before the validator grows beyond its current ~163-line body.
- **The `service.py` facade** is a useful import-stability pattern. Extend it rather than adding new direct import paths from the feature internals.

---

## Appendix: File Length Reference

| File | Lines | Status |
|---|---|---|
| `schema_mutations.py` | 1,709 | **Split now** |
| `mcp/server.py` | 792 | **Refactor factory** |
| `formula/evaluator.py` | 572 | Acceptable (single concern) |
| `formula/parser.py` | 531 | Acceptable (RD parser) |
| `document.py` | 486 | Borderline (validator too long) |
| `tables/rooms.py` | 476 | Borderline (`apply_rooms_replace` too long) |
| `drafts.py` | 353 | Fine (extract ETag helper) |
| `formula/resolver.py` | 275 | Fine |
| `store.py` | 274 | Fine |
| `repository.py` | 258 | Fine |
| `refresh.py` | 258 | Fine (fix asserts) |
| `routes.py` | 234 | Fine |
| `logging_config.py` | 202 | Fine |
| `projects/service.py` | 198 | Fine |
| `mcp/service.py` | 175 | Fine |
| `options.py` | 165 | Fine (fix double import) |
| `tables/contracts.py` | 151 | Fine |
| `custom_fields.py` | 151 | Fine |
| `config.py` | 147 | Fine |
| `models.py` | 107 | Fine |
| `validation.py` | 53 | Perfect |
| `audit.py` | 52 | Fine |
| `versions.py` | 49 | Perfect |
| `downloads.py` | 22 | Perfect |
