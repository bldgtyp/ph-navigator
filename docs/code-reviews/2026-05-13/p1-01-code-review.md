---
DATE: 2026-05-13
TIME: 12:30 EDT
STATUS: Code review of P1-01 deliverable
SCOPE: Backend project-document workflow split + table-registry boundary.
       Reviews un-committed changes representing the P1-01 phase
       implementation against the planning docs, PRD, code-review
       synthesis, and context technical requirements.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md (P1-01 row)
  - docs/plans/2026-05-13/phase-1-full-buildout-plan.md (P1-01 scope)
  - docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md
  - context/PRD.md
  - context/CODING_STANDARDS.md
  - context/technical-requirements/api.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
---

# Code Review — P1-01 Code-Review P0 Architecture Close-Out

## Scope Check

P1-01's stated scope from the roadmap:

> Resolve the project-document/table boundary issues that would otherwise
> be copied into later table work.
>
> Includes: Split project-document workflow responsibilities; introduce
> the table-registry boundary; make unsupported table behavior
> registry-owned; preserve current public routes and behavior.

This maps to the code-review synthesis P0.1 (split `project_document`
workflow responsibilities) and P0.2 (table registry). Explicitly
**not** in P1-01 scope (per the phase-1-full-buildout-plan):

- P0.3 / P1-02: Document/draft summary API + frontend header decoupling
- P0.4 / P1-03: Read-safe-mode
- P0.5 / P1-08-P1-11: Shared table draft broadcast extraction
- P1.1 / P1-08: Real shared DataTable extraction

This review evaluates only against the P1-01 scope.

## Diff Summary

| File | Status | Lines |
|---|---|---|
| `backend/features/project_document/service.py` | Modified | 525 → 37 (compatibility facade) |
| `backend/features/project_document/models.py` | Modified | Stripped Rooms-specific models; renamed `RoomsSliceSource` → `TableSliceSource` |
| `backend/features/project_document/routes.py` | Modified | Generic-table routes now registry-driven; response_model still single type |
| `backend/features/project_document/store.py` | New (97 lines) | Saved/draft load + table read helpers |
| `backend/features/project_document/drafts.py` | New (208 lines) | replace_table_slice, save, save-as, discard |
| `backend/features/project_document/versions.py` | New (49 lines) | Version metadata patch |
| `backend/features/project_document/diff.py` | New (93 lines) | Project diff over registered tables |
| `backend/features/project_document/downloads.py` | New (20 lines) | Project + table JSON download bodies |
| `backend/features/project_document/validation.py` | New (41 lines) | document_etag, validate_document, JsonValue |
| `backend/features/project_document/audit.py` | New (32 lines) | log_document_action helper |
| `backend/features/project_document/tables/__init__.py` | New (9 lines) | Public surface |
| `backend/features/project_document/tables/contracts.py` | New (37 lines) | `TableContract` dataclass |
| `backend/features/project_document/tables/registry.py` | New (30 lines) | Registry lookup + iteration |
| `backend/features/project_document/tables/rooms.py` | New (103 lines) | Rooms contract |
| `backend/features/mcp/server.py` | Modified | MCP `get_table` now uses registry contract |
| `backend/tests/test_project_document.py` | Modified | +22 lines: unsupported-table test |
| `backend/tests/test_mcp.py` | Modified | +11 lines: MCP unsupported-table test |
| `context/technical-requirements/api.md` | Modified | Documents registry-owned generic routes |
| `context/technical-requirements/data-model.md` | Modified | Documents registered table contracts |
| `docs/plans/01_IMPLEMENTATION-ROADMAP.md` | Modified | P1-01 status + lessons entry |

Net: -604 / +149 in changed files plus ~720 lines in new files. Module
sizes after the split are well within the project's 300-line soft limit
(drafts.py at 208 is the largest).

## Verdict

**Approve with minor amendments.** The P1-01 deliverable meets its
stated completion gate:

- ✅ Existing Rooms, draft, save/version, download, and MCP-read
  behavior preserved (46 backend tests passing per ledger).
- ✅ Adding the next table is a registration task — register a
  `TableContract` in `tables/registry.py`, not a route/service fork.
- ✅ No user-visible behavior changes beyond clearer 404 error envelope
  for unknown table names (now includes `supported_tables`).
- ✅ Public route URLs unchanged.
- ✅ Workflow modules now reviewable separately per the synthesis P0.1
  recommendation.
- ✅ Context docs updated to record the registry boundary.

The findings below are concerns to flag for follow-up slices, not
blockers for accepting P1-01.

## Architectural Alignment

### Strong matches with the synthesis

The split follows the conservative shape recommended in
`phase-1-code-review-synthesis.md` P0.1 almost exactly:

```text
backend/features/project_document/
  routes.py        ✅
  models.py        ✅ (Rooms-specific models removed)
  repository.py    ✅
  document.py      ✅ (pre-existing)
  store.py         ✅ NEW
  drafts.py        ✅ NEW
  versions.py      ✅ NEW
  diff.py          ✅ NEW
  downloads.py     ✅ NEW
  validation.py    ✅ NEW (synthesis didn't name this but it's a clean cut)
  audit.py         ✅ NEW (synthesis didn't name this but it's a clean cut)
  tables/
    __init__.py    ✅ NEW
    contracts.py   ✅ NEW (additional split beyond synthesis suggestion)
    registry.py    ✅ NEW
    rooms.py       ✅ NEW
```

The extra split into `contracts.py` (vs. keeping the dataclass in
`registry.py`) is a defensible micro-decision: the lessons entry
records that it broke a circular import between `registry.py` and
`rooms.py`. Good documentation of the why.

### Compatibility facade

`service.py` is reduced to a 37-line re-export shim. Per the synthesis
recommendation ("Behavior-preserving backend refactor with a
compatibility facade for existing imports"), this is exactly the right
move. Existing imports in `routes.py` and `features/mcp/server.py`
continue to work via `from features.project_document.service import …`.

**Follow-up:** the facade should be removed (or marked deprecated) once
all consumers import from the focused modules directly. There's no
internal consumer that needs the facade today; the routes file imports
through it but could go direct. Not a blocker — keep as a thin shim for
one or two slices and then collapse.

### Table contract surface

`TableContract` (in `tables/contracts.py`) exposes the right hooks per
the synthesis P0.2 acceptance bullets:

| Synthesis requirement | Implementation |
|---|---|
| Request model for replace/patch | `replace_request_model: type[BaseModel]` |
| Response model or serializer | `build_response: Callable[..., BaseModel]` |
| Option/reference validation hook | Folded into `apply_replace` via doc-level `validate_document` |
| Apply function | `apply_replace: Callable[ProjectDocumentV1, BaseModel] → ProjectDocumentV1` |
| Diff/download row extraction | `extract_rows`, `extract_diff_value` |

Frozen dataclass with `Callable` fields is a clean choice — no method
dispatch, no inheritance, no need for ABCs.

## Findings

Findings are tagged by severity. None are P1-01 acceptance blockers.

### F-01 (P2, forward-compat) — `RegisteredTableResponse = RoomsSliceResponse` will break on the second registered table

**Location:** `backend/features/project_document/tables/__init__.py:7`

```python
RegisteredTableResponse = RoomsSliceResponse
```

This alias is the FastAPI `response_model` for all three generic table
routes (`get_saved_table`, `get_draft_table`, `put_draft_table`).

**Implications:**

- The generated OpenAPI schema currently advertises the generic table
  endpoints as returning `RoomsSliceResponse`. That contradicts the
  architectural claim "table routes are generic."
- When a Windows or ERV table contract is added, the response shape
  will not satisfy `RoomsSliceResponse` validation, so FastAPI will
  500 on the response.
- Switching this to `RoomsSliceResponse | WindowsSliceResponse | …`
  works at runtime but invalidates frontend type narrowing (clients
  must use a discriminator).

**Why not a P0:** P1-01 explicitly preserves current behavior, and
Rooms is the only registered table. P1-12 (`OpenAPI and project/table
schema baseline or explicit deferral`) is the natural slice to address
this, since it owns the schema/OpenAPI surface.

**Suggested follow-up:** when Phase 2 registers the second table,
either:
1. Use `response_model=None` and trust per-contract response builders
   (FastAPI will still serialize from the returned Pydantic model).
2. Make `RegisteredTableResponse` a discriminated union with `source`
   or `table_name` as the discriminator.
3. Drop typed `response_model` for these routes and document the
   per-table response in OpenAPI through a custom route description.

Worth deciding deliberately rather than copying the current alias
pattern.

### F-02 (P2, coupling carryover) — `body_size_bytes` still imported from `features/projects/service`

**Location:** `backend/features/project_document/drafts.py:20`

```python
from features.projects.service import body_size_bytes, version_public
```

The synthesis P2 cleanup #1 explicitly flagged this:

> Move `body_size_bytes()` out of `features/projects/service.py` into
> a document-owned helper.

This is a P2 cleanup the synthesis labeled as "real but should not
block the Phase 1 close-out refactor." P1-01 didn't pull it forward.

**Why this is worth noting now:** during P1-01 the document feature
was actively split. The natural moment to move `body_size_bytes` and
`version_public` into `features/project_document/validation.py` or a
new `mapping.py` was during this slice. Doing it later requires
revisiting drafts.py imports.

**Suggested follow-up:** fold this into P1-02 (which is already
touching document chrome) or a small batched cleanup PR.

### F-03 (Low) — Diff row matcher assumes `id`-keyed lists

**Location:** `backend/features/project_document/diff.py:75-93`

```python
def rows_by_id(rows: Iterable[Any]) -> dict[str, Any] | None:
    keyed: dict[str, Any] = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            return None
        keyed[row["id"]] = row
    return keyed
```

This is a Rooms-shaped assumption: tables whose rows don't use a string
`id` field fall back to whole-list comparison (`{path or "$"}`). With
only Rooms registered, behavior is identical to the pre-split diff.

**Concerns:**
- The diff helpers (`diff_paths`, `diff_list_paths`, `rows_by_id`)
  live in `diff.py`, not in the per-contract `TableContract`. A table
  whose rows use `window_id` instead of `id` (or where row identity is
  composite) would get a degraded "whole list changed" diff.
- The `TableContract` does not currently expose a `row_key` accessor.

**Why not a P0:** the contract today exposes `extract_diff_value`,
which already returns `object`. Tables that need custom diffing can
override what they return there. So the diff path is extensible.

**Suggested follow-up:** when the second table lands, either (a) add
`row_key_fn: Callable[[dict], str] | None` to `TableContract` so the
diff module can use the contract's notion of identity, or (b) push the
list-diff into the contract itself (`diff_against: Callable[[Body,
Body], TableDiffSummary]`).

### F-04 (Low) — `iter_table_contracts()` order is insertion-order

**Location:** `backend/features/project_document/tables/registry.py:30`

```python
_TABLES: dict[str, TableContract] = {rooms_contract.name: rooms_contract}
```

`dict.values()` returns insertion order. With one table this is
trivially stable. As tables are added, the diff response's `tables: list`
order will reflect declaration order in registry.py.

**Concerns:**
- API consumers may expect alphabetical ordering, schema-version
  ordering, or some other stable canonical ordering.
- Test assertions that compare full diff responses may be order-
  sensitive.

**Suggested follow-up:** add a single line to `iter_table_contracts`
that returns `sorted(_TABLES.values(), key=lambda c: c.name)`, or
document the ordering convention.

### F-05 (Low) — No unit tests for `get_table_contract` / `iter_table_contracts`

The new modules `tables/contracts.py`, `tables/registry.py`,
`validation.py`, `audit.py`, `store.py`, `drafts.py`, `versions.py`,
`diff.py`, and `downloads.py` are tested indirectly via existing REST
tests plus the new `test_unsupported_table_names_fail_through_registry`
and the MCP `get_table` missing-table assertion.

That's adequate coverage for the slice's behavior contract: route-level
404 with `supported_tables: ["rooms"]` is asserted from both REST and
MCP entry points.

**Concerns:**
- The registry's 404 error envelope (`error_code:
  document_table_not_found`, `details.supported_tables`) is now a
  public contract. A direct unit test would protect it from silent
  drift.
- `iter_table_contracts()` order matters for diff (see F-04) but is
  untested.

**Why not a P0:** the synthesis acceptance check for P0.2 is "the
generic table routes do not import Rooms models directly" and
"adding the next table requires registering a table handler." Both
are satisfied. No unit test gap blocks acceptance.

**Suggested follow-up:** add 2-3 focused tests when registering the
second table contract (Windows would be a natural moment).

### F-06 (Informational) — `apply_rooms_replace` re-validates the whole document on every write

**Location:** `backend/features/project_document/tables/rooms.py:58-66`

```python
def apply_rooms_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    rooms_payload = cast(RoomsSliceReplaceRequest, payload)
    options = dict(body.single_select_options)
    room_options = rooms_payload.single_select_options.by_option_key()
    for key in ROOM_OPTION_KEYS:
        options[key] = room_options[key]
    next_tables = body.tables.model_copy(update={"rooms": rooms_payload.rooms})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))
```

`model_copy()` in Pydantic v2 doesn't fire validators by default, so
re-validating via `model_validate(model_dump(...))` is the correct way
to enforce the document-level invariants (duplicate option ids, missing
option refs, duplicate room numbers). This is preserved from the
pre-split behavior.

**Note:** the synthesis P2 cleanup #10 already calls this out: "Revisit
O(whole-document) validation only when document size or profiling
proves it is a real cost." No action needed in P1-01.

### F-07 (Informational) — Public information disclosure via 404 `supported_tables`

**Location:** Registry 404 detail at `tables/registry.py:21`

```python
{"table_name": table_name, "supported_tables": sorted(_TABLES)}
```

For the unauthenticated public viewer hitting `GET
/document/tables/{name}`, the 404 response body advertises the full
registered table list (`["rooms"]` today). This is **not** a security
concern:

- The set of project-document tables is public knowledge by design
  (data model is documented in the PRD/API docs).
- The endpoint already requires a valid `project_id` and `version_id`
  to reach the table-name check.
- Returning the supported list is a UX feature for clients that hit a
  typo.

No action needed; flagging because the disclosure is now centralized.

### F-08 (Informational) — MCP `replace_table` write stub still hard-codes scope check before rejecting

**Location:** `backend/features/mcp/server.py:143-167`

```python
@mcp.tool()
def replace_table(...) -> dict[str, object]:
    """Reject write attempts until TB-17 ships MCP draft writes."""
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    _parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    require_token_scope_or_error(token, parsed_project_id, "project:write", ctx)
    raise_mcp_error("mcp_write_deferred", ...)
```

P1-01 did not touch the MCP write stub. It still checks
`project:write` scope and raises `mcp_write_deferred`. This is
correct per TB-04b's design (a read-only token should be rejected with
`mcp_scope_insufficient`, not `mcp_write_deferred`). Worth confirming
that this is still the desired ordering — both error codes are
informative, but the current order means a write-scoped token sees
`mcp_write_deferred` while a read-only token sees the scope error.

No action for P1-01.

## Divergences From Planning Docs

### None material

The implementation aligns with:

- `phase-1-code-review-synthesis.md` P0.1 + P0.2 recommendations.
- `phase-1-full-buildout-plan.md` P1-01 completion gates.
- `context/technical-requirements/data-model.md` §6.3 (registered
  table contracts under `backend/features/project_document/tables/`).
- `context/technical-requirements/api.md` §9.4 (generic route shapes,
  registry-owned table behavior, structured 404).
- `context/CODING_STANDARDS.md` (feature shape, layer responsibilities,
  module-size soft limits, strict typing, raw SQL in repository only).

The `data-model.md` text now says:

> Schema and route behavior for each table are defined under
> `backend/features/project_document/tables/` as a registered
> Pydantic-backed contract.

That accurately describes the new architecture (and corrects the prior
text's reference to `backend/features/project/document/tables/`, which
was a typo in the previous version of the doc).

### Worth confirming explicitly

- **Synthesis P0.3** (document/draft summary API + frontend `features/project_document`):
  intentionally deferred to P1-02. The roadmap and full-buildout plan
  both record this. ✅
- **Synthesis P0.4** (read-safe-mode envelope): intentionally deferred
  to P1-03. ✅
- **Synthesis P0.5** (shared table draft broadcast): intentionally
  deferred to P1-11. ✅
- **Synthesis P2 cleanup #1** (`body_size_bytes` move): deferred — see
  F-02 above for the timing concern.

## Security Review

No security regressions found.

- Access dependencies (`require_project_view_access`,
  `require_project_edit_access`) remain on all routes.
- Registry `get_table_contract` runs **after** FastAPI dependency
  resolution, so unauthenticated requests get 401 before the
  registry check.
- The transaction-level locked-version check in `replace_table_slice`
  still runs before payload application.
- ETag-based optimistic concurrency (`If-Match-Version`, `If-Match`)
  preserved in `replace_table_slice`.
- Audit logging (`log_document_action`) is preserved for save / save-as
  / patch-version; extraction into `audit.py` did not drop any audit
  rows.
- The 404 `supported_tables` disclosure is intentional (F-07).

The split did NOT introduce:

- New trust boundaries.
- New raw SQL paths (repository surface unchanged).
- New deserialization paths bypassing `validate_document`.
- MCP scope check changes.

## Performance Review

No regressions; no improvements.

- Whole-document `model_dump(mode="json")` + `model_validate` on every
  replace_table is preserved (F-06). Acceptable for Rooms-sized
  documents.
- `iter_table_contracts()` is O(n) over registered tables, currently
  n=1. Used in diff only.
- The registry uses a single module-level dict; lookup is O(1).
- Service.py compatibility facade adds one extra import hop but no
  runtime cost.

## Coding Standards Conformance

Cross-referenced against `context/CODING_STANDARDS.md`:

| Standard | Status |
|---|---|
| Feature shape: routes/models/service/repository present | ✅ (service.py kept as facade; specialized modules added) |
| Routes call services, not raw SQL | ✅ |
| Repository uses raw parameterized SQL only | ✅ (untouched) |
| Pydantic v2 (ConfigDict, model_validate, model_dump) | ✅ |
| Strict typing on new public functions | ✅ (NoReturn used correctly on raise_project_version_not_found) |
| 300-line soft limit | ✅ (largest new module: drafts.py @ 208) |
| Workflow split (not arbitrary helper buckets) | ✅ (sessions/documents/versions/audit pattern) |
| Docstrings explain why | ✅ (module docstrings concise; behavior docs in `replace_table` stub re. TB-17) |
| Repository imports no FastAPI | ✅ (untouched) |
| Pre-flight: `ruff check`, `ty check`, `pytest` | ✅ (recorded in roadmap evidence: 46 tests passing) |

## Test Coverage

The new `test_unsupported_table_names_fail_through_registry` test
covers all four affected REST surfaces in one test:

```python
saved = client.get(...document/tables/windows)        # ProjectViewAccess
draft = client.get(...draft/tables/windows)           # ProjectEditAccess
write = client.put(...draft/tables/windows)           # ProjectEditAccess
download = client.get(...download/tables/windows)     # ProjectViewAccess
```

All four assert `status_code == 404`, `error_code ==
"document_table_not_found"`, `details.supported_tables == ["rooms"]`.

The new MCP test also covers `get_table` with an unknown table name and
asserts the structured-error code matches the REST contract.

**Coverage gaps (per F-05):** no direct unit tests for the registry
helpers themselves. Acceptable for now; flag for the second-table
slice.

## Recommendations

1. **Accept P1-01 as complete.** All stated completion gates are met
   and the code matches the synthesis P0.1/P0.2 recommendations.

2. **Track F-01 in P1-12** (OpenAPI/schema baseline). The
   `RegisteredTableResponse` alias is fine while only Rooms is
   registered, but P1-12 should decide the response-model strategy
   before TB-08 (Windows pick from catalog) introduces a second
   table.

3. **Address F-02 opportunistically** in P1-02. Moving
   `body_size_bytes` / `version_public` into the document feature
   would close the synthesis P2 #1 cleanup at the same time the
   header feature is being decoupled.

4. **Defer F-03 / F-04** to the second-table slice. Both are
   contract-design refinements that have no observable cost while
   Rooms is the only registered table.

5. **Add the registry unit tests (F-05)** when the second contract is
   registered. Keep them focused: lookup hit, lookup miss, ordering.

6. **Plan to remove the `service.py` compatibility facade** after
   one or two more document-feature slices, by switching internal
   callers to direct module imports. The facade's purpose is
   migration, not long-term API.

## Final

The P1-01 slice cleanly resolves the highest-impact P0 architectural
debt called out in the synthesis: the project-document service is no
longer a god-module, and the generic table routes are now actually
generic via a registry. The split preserves all observable behavior
and adds clearer error semantics for unknown table names. The minor
follow-ups above are appropriate to schedule into later slices rather
than retrofit into P1-01.

The roadmap can move to P1-02 with confidence that the next editable
project-document table will be a contract registration rather than a
route/service fork.
