---
DATE: 2026-06-29
TIME: 21:55 EDT
STATUS: COMPLETE (2026-06-29) — endpoint + model + service + 9 tests landed; backend lane green
AUTHOR: Claude (Opus 4.8)
SCOPE: Add a batch draft-tables read that returns many tables from one
  whole-draft load. No change to per-table or write routes.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-00-preflight-and-spike.md
---

# Phase 01 — Backend batch draft-tables read

## Goal

`GET …/versions/{version_id}/draft/tables?names=…` returns one entry per
requested table, each **byte-identical** to `GET …/draft/tables/{table_name}`,
from a **single** `get_current_document_view` (one whole-draft load + validate)
instead of N. The existing per-table GET/PUT/POST routes are untouched — they
are still used by the write path and by un-seeded mounts.

`uv` only; raw SQL (none new here — reuses the document store); strict typing
(`ty`); Pydantic v2.

## Preferred Implementation Shape

1. **Model** — alongside the document response models:
   ```python
   class BatchDraftTablesResponse(BaseModel):
       model_config = ConfigDict(extra="forbid")
       tables: dict[str, RegisteredTableResponse]   # table_name -> per-table response
   ```
   `RegisteredTableResponse` is the existing union; each value already carries
   `project_id, version_id, source, version_etag, draft_etag` + the table
   payload, so it equals the single-route output.

2. **Service** — `backend/features/project_document/store.py`, add
   `get_draft_tables_batch(version_id: UUID, table_names: list[str], access:
   ProjectAccess) -> BatchDraftTablesResponse`:
   - `require_editor_user(access)` (matches the per-table draft read access).
   - De-dupe `table_names` (stable order); `get_table_contract(name)` for each
     (404s an unknown name — same as the per-table route).
   - **One** `document = get_current_document_view(version_id, access)`.
   - For each requested name: `responses[name] = contract.build_response(
     access.project_id, version_id, document.source, document.version_etag,
     document.draft_etag, document.body)`.
   - Return `BatchDraftTablesResponse(tables=responses)`.
   - **Match per-table 422 behavior:** `get_current_document_view` →
     `load_current_document_parts` already raises `422 invalid_project_document`
     on a draft that fails validation. Do not add a read-safe envelope path here
     — the per-table draft read does not have one.

3. **Route** — `backend/features/project_document/routes.py`, add
   `@router.get("/draft/tables", response_model=BatchDraftTablesResponse)`:
   ```python
   def get_draft_tables_batch_route(
       version_id: UUID,
       names: Annotated[list[str], Query(min_length=1, max_length=<bound from P0>)],
       access: ProjectEditAccess,
   ) -> BatchDraftTablesResponse:
       return get_draft_tables_batch(version_id, names, access)
   ```
   - **Declare it before** `@router.get("/draft/tables/{table_name}")`. The
     collection path (`/draft/tables`) and the item path
     (`/draft/tables/{table_name}`) are distinct, but declaring the collection
     first avoids ordering ambiguity.
   - Leave `GET …/document`, `GET …/draft` (summary), and all
     `…/draft/tables/{table_name}` GET/PUT/POST routes exactly as-is.

## Code Areas

- `backend/features/project_document/models.py` (or wherever the document
  response models live)
- `backend/features/project_document/store.py`
- `backend/features/project_document/routes.py`
- tests: `backend/features/project_document/` test module

## Tests / Acceptance

- **Equality with per-table:** for a draft with several populated tables, each
  `tables[name]` in the batch equals the body of `GET …/draft/tables/{name}` for
  the same draft (same rows, field defs, etags, source).
- **One load:** assert the batch performs a single document load/validate (via a
  service-level test or a load counter / `_log_loaded` assertion), vs N for the
  per-table calls.
- **Unknown name → 404** `document_table_not_found` (same as per-table route);
  nothing partial returned.
- **Invalid draft → 422** `invalid_project_document` (matches per-table read).
- **Duplicate names** collapse to one entry.
- **Non-editor access** rejected as the per-table draft read is.
- **`names` over the bound / empty → 422** (FastAPI validation).
- Gate: `make ci` backend lane green.

## Outcome (2026-06-29)

Implemented exactly as the preferred shape:

- **Model** — `BatchDraftTablesResponse { tables: dict[str,
  RegisteredTableResponse] }` in `backend/features/project_document/tables/batch.py`
  (placed in the `tables` package, not `models.py`, to keep the import direction
  one-way — `tables` already depends on `models`).
- **Service** — `get_draft_tables_batch(version_id, table_names, access)` in
  `store.py`: `dict.fromkeys` de-dupe → resolve all contracts (404 before any
  load) → **one** `get_current_document_view` → loop `build_response`. Re-exported
  through `service.py`.
- **Route** — `GET …/draft/tables?names=…` in `routes.py`, declared before
  `{table_name}`, `MAX_BATCH_TABLE_NAMES = 64`. Per-table GET/PUT/POST untouched.
- **Tests** — `tests/test_project_document_batch_draft_tables.py`, 9 tests:
  one-entry-per-name, **byte-equality with the per-table GET**, **one document
  load** (asserted via `structlog` `capture_logs` counting `project_document.loaded`),
  unknown→404, invalid draft→422, duplicate-collapse, empty-names→422,
  anonymous→401, envelope `extra="forbid"`.
- Lint/format/`ty`/tests all green; `simplify` applied (import placement +
  docstring); the per-table read and write paths are byte-unchanged.

## Rejected alternatives

- **Shape (a) whole-draft `GET /draft/document` → `ProjectDocumentV1`** — forces
  the client to slice raw document internals; risks drift from `build_response`.
  Shape (b) reuses the contract per table, eliminating drift.
- **Reusing the per-table handler in a loop server-side** — would re-load the
  whole draft per table (the exact waste being removed). Must call
  `get_current_document_view` once and loop `build_response`.
