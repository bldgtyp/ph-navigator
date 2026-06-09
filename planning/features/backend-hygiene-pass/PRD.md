---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Active
AUTHOR: Claude (Opus 4.7)
SCOPE: Behavior contract for the backend hygiene pass.
RELATED: `README.md`, `STATUS.md`,
  `planning/code-reviews/2026-06-07/backend-data-structure-review.md`
---

# PRD — Backend Hygiene Pass

## Problem

The 2026-06-07 data-structure review found the V2 backend ready to
deploy. Layer discipline, timezone-aware timestamps, FK integrity, the
uniform error envelope, Pydantic v2 hygiene, the psycopg pool and gzip
middleware are all in place. What is **not** in place is a small set of
consistency, observability, and module-size items that are cheap to fix
now and visibly painful to fix once:

- API URL shapes get published and downstream tools depend on them.
- The data model grows further and `document.py` doubles again.
- The audit-FK behavior diverges further between tables.

The product goal of this hygiene pass is to keep the qualities the
review praised from slipping as the codebase grows, without adding
behavior or changing any user-facing contract.

## Goals

1. **Audit-FK consistency.** Every `created_by` / `updated_by` /
   `deleted_by` FK uses `ON DELETE SET NULL`, matching the explicit
   choice already made on `projects.deleted_by`.
2. **Missing-index fix.** `project_jobs.result_asset_id` has a
   supporting index so "which job produced this asset?" and FK cascade
   lookups do not seq-scan `project_jobs`.
3. **Module-size discipline.** No backend feature module flagged in the
   review remains over the 600-line soft limit. Splits are
   organisation-only with zero behavior change.
4. **REST action-URL consistency.** Exactly one action-URL style is
   used across `projects/` and `assets/` routes. The choice is
   documented in `backend/README.md`.
5. **Docstring coverage on transactional services.** Every public
   service function that manages a transaction, raises `api_error`, or
   maintains a cross-table invariant has a docstring describing what
   invariant it maintains and which transaction it runs in.
6. **`user_table_views` deletability is a recorded decision**, not
   latent ambiguity in the schema.
7. **Soft-delete dialect unified.** `users.is_active` is migrated to
   `deleted_at timestamptz`, matching every other soft-deleted table.

## Non-goals

- No new product behavior, no new tables, no API additions.
- No changes to `../ph-navigator/` (V1).
- No frontend changes — every phase here is backend-only.
- No pagination work. Carried as a watch item under Materials Catalog.
- No `project_version_drafts` audit-column work. Flagged for "if/when
  concurrent draft editing becomes a real feature".
- No speculative splits of modules not in the review's prioritised list
  (`evaluator.py`, `type_conversion.py`, `tables/rooms.py`).

## User-visible contract

None. This is a backend-internal pass. Every endpoint that exists today
returns the same response with the same shape. The only externally
visible change is:

- A small set of route URLs **may** be renamed under Phase 3 to unify
  the action-URL style. The renames happen before deploy, so no client
  outside this repo can be depending on them yet. Frontend callers
  inside this repo are updated in the same commit.

## Behavioral contract per concern

### Audit FKs (Phase 1)

After this phase: deleting a `users` row would `SET NULL` every
`created_by` / `updated_by` / `deleted_by` reference on `projects`,
`project_assets`, `project_jobs`, and any other table carrying those
columns. Today users are never hard-deleted, so the new behavior is
observable only via `pg_constraint` introspection. The contract is the
policy, not a runtime change.

### `project_jobs.result_asset_id` index (Phase 1)

After this phase: there is a btree index on
`project_jobs(result_asset_id)`. No new query — the index supports
FK-cascade lookups and any future "job that produced asset X" query.

### `empty_project_document` extraction (Phase 2)

After this phase: the function moves from
`backend/features/projects/service.py:90` to
`backend/features/project_document/templates.py`. `projects/service.py`
imports it. Return type, arguments, and observable behavior are
unchanged. `projects/service.py` drops ~140 lines.

### REST action-URL style (Phase 3)

After this phase: every action route in `projects/routes.py` and
`assets/routes.py` uses the same style. The chosen style is documented
in a one-line note in `backend/README.md` (or, if that file does not
exist, in the route-registration block in `backend/main.py`). Frontend
TanStack Query call sites inside this repo are updated in the same
commit.

The chosen style is **Phase 3's first deliverable** and is captured in
`decisions.md` when Phase 3 starts — do not pick it here. The review
called out the choice as a coin-flip; pick one and move on.

### Service docstrings (Phase 4)

After this phase: docstrings exist on, at minimum:

- `auth/service.py::authenticate`
- `projects/service.py::create_project`
- `projects/service.py::update_project_metadata`
- `projects/service.py::delete_project`
- `projects/service.py::bulk_delete_projects`
- `projects/service.py::restore_project`
- `projects/service.py::hard_delete_project`
- `catalogs/materials/service.py` — every public function
- `assets/service.py` — every public function that opens a transaction
  or coordinates R2 plus DB

Each docstring follows the pattern documented in `database.py`: one
short paragraph naming the invariant maintained and the transaction
scope (or stating "no transaction; pure transform" when applicable).

### `user_table_views` decision (Phase 5)

After this phase: either migration 0010 has a one-line comment stating
"rows are never deleted; views are reset rather than removed", or a new
migration adds `deleted_at timestamptz` plus a filtered index. The
decision is recorded in `decisions.md`.

### `document.py` split (Phase 6)

After this phase: `backend/features/project_document/document.py` is
gone (or is a small re-export shim) and its contents live in:

- `project_document/models.py` — row, envelope, and `ProjectDocumentV1`
  Pydantic types (existing `models.py` is consolidated with these).
- `project_document/templates.py` — empty-document construction
  helpers, including the function extracted in Phase 2.
- `project_document/validation.py` — `_require_record_id_seeded`,
  `_validate_unique_ids`, `_validate_contiguous_orders`, and any other
  cross-table validators (existing `validation.py` absorbs these).

Every import elsewhere in the codebase resolves to the new locations.
No symbol is renamed; this is a pure file move.

### `mcp/tools.py` split (Phase 7)

After this phase: `backend/features/mcp/tools.py` is replaced by a
`mcp/tools/` package with one module per domain (`projects.py`,
`documents.py`, `assets.py`, `envelope.py`, `custom_fields.py`, etc.).
`mcp/tools/__init__.py` re-exports the public surface used by
`mcp/server.py`. No tool definition changes name or signature.

### Soft-delete unification (Phase 8)

After this phase: `users.is_active` is dropped. `users.deleted_at
timestamptz` replaces it, populated by
`CASE WHEN is_active THEN NULL ELSE now() END`. `auth/repository.py` and
every other reader of the column is updated. The unique index
`uq_users_email_lower` already filters on `deleted_at IS NULL` in
sessions — confirm it still does. Public auth behavior (login,
session, "user disabled" error) is preserved.

## Verification

- **Phase 1**: `alembic upgrade head` then `alembic downgrade -1` round
  trips cleanly on a fresh DB. A `psql` introspection confirms the new
  `ON DELETE SET NULL` clauses and the new index.
- **Phase 2**: `make test` passes. Imports of `empty_project_document`
  resolve. `wc -l backend/features/projects/service.py` is < 560.
- **Phase 3**: `make test` passes. Frontend lints/tests pass against
  the renamed URLs. The note exists in `backend/README.md`.
- **Phase 4**: `ruff` / `ty` clean. Reviewers can read the listed
  functions and immediately learn the invariant and the transaction.
- **Phase 5**: Either the migration comment exists or the new migration
  applies and reverses cleanly.
- **Phase 6**: `wc -l backend/features/project_document/*.py` shows no
  file over 600 lines. `make ci` passes. All previously passing
  `project_document` tests still pass without modification.
- **Phase 7**: `wc -l backend/features/mcp/tools/*.py` shows no file
  over 600 lines. MCP server integration tests pass.
- **Phase 8**: `is_active` is gone from the schema. `auth` tests pass.
  Sign-in flows work end-to-end (verify via Playwright MCP against
  `codex@example.com`).

The closeout gate (`make format` + `make ci`) gates every phase.

## Risks and mitigations

- **Risk**: a file split rewrites imports across the codebase and
  something silently catches the wrong symbol. **Mitigation**: do the
  split as one commit per file move; rely on `ty` + `ruff` + `make ci`
  to catch unresolved references. Avoid renames in the same commit.
- **Risk**: route renames break the frontend mid-deploy.
  **Mitigation**: Phase 3 updates frontend call sites in the same
  commit. No client outside this repo depends on these URLs yet (this
  is the explicit pre-deploy window the review identified).
- **Risk**: the `users.is_active` → `deleted_at` migration runs before
  every reader is updated. **Mitigation**: Phase 8 lands the reader
  changes and the migration in one PR, in the order
  reader-changes-with-fallback → migration → reader-cleanup; or, more
  simply, drop the column in the same migration after backfilling and
  ensure all callers go through `auth/repository.py`'s helper, which is
  what Phase 8 verifies.
