---
DATE: 2026-06-07
TIME: afternoon ET
STATUS: REVIEW — pre-deploy data-structure review of the V2 backend.
        Scope is DB schema + backend layering (routes, services,
        repositories, schemas). No code changes. The backend is in
        good shape — clean layer discipline, sound primary-key/timezone
        choices, consistent error envelope, gzip + pooling already in
        place. Findings are small consistency, observability, and
        module-size items that are cheap to fix now and annoying to
        fix later.
AUTHOR: Claude (Opus 4.7) — synthesizing two parallel Explore sub-agents
        (one on DB/migrations, one on feature module structure) plus
        spot checks on `database.py`, `main.py`, and module sizing.
REVIEWED: `backend/alembic/versions/**` (19 migrations, 0001 → 0019),
          `backend/features/{auth,projects,catalogs/materials,assets,
          project_document,mcp,envelope,shared}/**`, `backend/database.py`,
          `backend/config.py`, `backend/main.py`, `backend/tests/**`
          (file structure only). Cross-referenced against
          `context/CODING_STANDARDS.md`.
SCOPE: Data-structure & backend-only review. Frontend out of scope.
       Performance findings from 2026-06-04 (gzip, virtualization,
       pagination) are NOT re-litigated here — gzip is now wired in
       `main.py:62`; pagination remains an open item carried below.
---

# Backend Data-Structure Review

## TL;DR

The backend is in good shape for first deploy. Layer discipline is
strict (routes → service → repo, no leakage found), Pydantic v2 usage
is clean, error envelopes are uniform, timestamps are timezone-aware
everywhere, and the psycopg pool + gzip middleware are wired correctly.

The real findings are **module-size creep** in three places, a couple
of **soft-delete / audit-FK consistency cracks** that are trivial now
and a nuisance later, and a **handful of missing indexes** that won't
hurt at current scale but are 15-minute fixes.

Nothing here blocks deploy. Items marked **Now** are <1h and worth
folding into the pre-deploy pass; items marked **Soon** are next-sprint
hygiene; items marked **Watch** are flags to revisit when scale or
features force the issue.

### Severity table

| # | Finding | Severity | Effort | When |
|---|---|---|---|---|
| 1 | `project_document/document.py` is 1,358 lines — well past the 600-line soft limit | Medium | M | Soon |
| 2 | `mcp/tools.py` is 1,046 lines, `assets/service.py` 714, `mcp/server.py` 713, `projects/service.py` 697 | Medium | M | Soon |
| 3 | Two soft-delete dialects: `users.is_active` (bool) vs `deleted_at` (timestamptz) everywhere else | Low | M | Soon |
| 4 | Audit FKs (`created_by`, `deleted_by` on `project_assets`, `project_jobs`) have no explicit `ON DELETE` — defaults to RESTRICT, inconsistent with `projects.deleted_by` which is `SET NULL` | Low | S | Now |
| 5 | `project_jobs.result_asset_id` FK has no index | Low | S | Now |
| 6 | List endpoints return unbounded result sets (carried over from 2026-06-04) | Low (now) / Med (later) | M | Watch |
| 7 | Docstring coverage uneven — present on simple helpers, missing on the complex `authenticate()`, `create_project()`, `delete_project()` | Low | S | Now |
| 8 | REST action-URL style mixes Google `:verb` (`/{id}:delete`, `:bulk-delete`) and slash-verb (`/{id}/attach`, `/{id}/complete-upload`) | Trivial | S | Now |
| 9 | `project_version_drafts` has `last_patched_at` but no `created_at` and no `updated_by` — multi-user draft conflicts are invisible | Low | S | Watch |
| 10 | `user_table_views` lacks a filtered index and has no soft-delete column — needs a decision, not necessarily a change | Trivial | S | Soon |

---

## 1. Module-size creep — the biggest real finding

Both schema and module structure are clean enough that the loudest
signal in this review is **three or four modules that have outgrown
single-responsibility**. The 600-line soft limit in
`context/CODING_STANDARDS.md` exists exactly to keep this from happening
quietly; right now it has been crossed by:

```
1358 features/project_document/document.py
1046 features/mcp/tools.py
 714 features/assets/service.py
 713 features/mcp/server.py
 697 features/projects/service.py
 567 features/project_document/formula/evaluator.py
 548 features/project_document/mutations/type_conversion.py
 542 features/project_document/tables/rooms.py
 527 features/project_document/formula/parser.py
```

### 1a. `project_document/document.py` (1,358 lines) — split first

This is the canonical V1 document model. Splitting by concern is
straightforward and high-payoff: model classes, factory/template
construction, and any validation helpers should each move to their
own file under `project_document/`. The current single file is the
hardest module in the codebase to review at a glance, and it sits at
the center of the data model — every change to a table type touches it.

Suggested split (concept only — names should match what's actually in
the file):
- `project_document/models.py` — the `ProjectDocumentV1`, `*Envelope`,
  `*FieldDefs` types.
- `project_document/templates.py` — empty-document construction (the
  `empty_*` helpers also used from `projects/service.py:90-227`).
- `project_document/validation.py` — any cross-table validators.

### 1b. `mcp/tools.py` (1,046 lines) — split by tool family

Likely already organised internally as a flat list of tool defs.
Group by domain (project tools, asset tools, document tools, envelope
tools) into a `mcp/tools/` package with one file per family, re-export
through `mcp/tools/__init__.py`. No behavior change; pure organisation.

### 1c. `projects/service.py` (697 lines)

The Explore agent flagged this. The 137-line `empty_project_document`
(lines ~90–227) is a separate concern from project CRUD/lifecycle.
Pull it into `projects/document.py` (or, better, co-locate with item
1a above in `project_document/templates.py`). After extraction this
file should fall well under 500 lines.

### 1d. `assets/service.py` (714 lines) and `mcp/server.py` (713)

Both are at the threshold rather than well over it. Worth a 15-minute
look at each next time you're in them — if there's an obvious seam
(e.g. upload/intent vs. download/serve in `assets/service.py`), split;
otherwise leave alone and revisit when the next feature pushes past
800.

**Effort**: 1a is ~2h, 1b is ~1h, 1c is ~30m. Doing them all is half a
day of mechanical refactoring with zero behavior change. Doing them
**now**, before the project model grows further, is much cheaper than
doing them later.

---

## 2. Schema findings (DB / migrations)

### 2.1 Two soft-delete dialects — pick one

`users` (migration 0002) uses a boolean `is_active`. Every other
soft-deleted table (`projects`, `project_assets`, `project_versions`,
catalogs) uses nullable `deleted_at timestamptz`. The repository code
has to learn both patterns, and queries that join across them have to
remember which clause applies where.

For a single-user-table app this is more annoyance than risk. The
migration is cheap (rename + backfill: `deleted_at = CASE WHEN
is_active THEN NULL ELSE now() END`), and after it every "list
non-deleted X" query in the codebase uses the same `WHERE deleted_at
IS NULL` clause.

**Recommendation**: Schedule a single migration `00XX_users_deleted_at.py`
post-deploy. Not blocking.

### 2.2 Audit-FK `ON DELETE` clauses are inconsistent

Migration 0013 explicitly sets `projects.deleted_by` to `ON DELETE SET
NULL`. Migration 0011 (`project_assets`, `project_jobs`) declares
`created_by`/`deleted_by` FKs with **no** `ondelete` — so they fall
through to RESTRICT. Same column name, different behavior on user
deletion across tables.

```python
# 20260512_0003_projects.py — explicit
op.create_foreign_key("fk_projects_deleted_by", "projects", "users",
    ["deleted_by"], ["id"], ondelete="SET NULL")

# 20260526_0011_project_assets_and_jobs.py — implicit RESTRICT
sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
sa.ForeignKeyConstraint(["deleted_by"], ["users.id"]),
```

In practice users are never hard-deleted today, so neither path fires.
But "audit columns should never block a user-delete" is the policy I'd
expect; making it explicit and uniform with `ON DELETE SET NULL`
everywhere documents that intent and matches the existing `projects`
behavior.

**Recommendation** (`Now`, ~30 min): one migration to add explicit
`ON DELETE SET NULL` on every audit FK (`created_by`, `updated_by`,
`deleted_by`) that doesn't already have one. Mechanical and reversible.

### 2.3 Missing index on `project_jobs.result_asset_id`

```python
# 20260526_0011_project_assets_and_jobs.py
sa.Column("result_asset_id", sa.Text()),
sa.ForeignKeyConstraint(["result_asset_id"], ["project_assets.id"]),
```

FK declared, no supporting index. Any "which job produced this asset?"
or `ON DELETE` lookup will seq-scan `project_jobs`. Negligible today,
predictable cliff later. Add as part of the same housekeeping migration
as 2.2.

### 2.4 `user_table_views` — decide whether rows are ever deleted

`user_table_views` (migration 0010) has no `deleted_at`. Either:
- It is **append-or-update only** (reset rather than delete) — then
  the schema is correct and no change needed; just add a one-line
  comment to the migration documenting this.
- It will eventually be deletable — then add `deleted_at` now (cheap)
  rather than after rows accumulate.

This is a five-minute design decision, not real work; capture it
explicitly before deploy so it isn't carried as latent ambiguity.

### 2.5 `project_version_drafts` audit trail — flag, don't fix

`project_version_drafts` (migration 0005) tracks `last_patched_at` but
not `created_at` and not `updated_by`. The PK is `(version_id, user_id)`
so "who created" is implicit, but if concurrent multi-user editing ever
becomes a feature, you'll want an explicit `updated_by` and a created
timestamp to debug conflicts. Not worth changing now; worth noting in
the feature PRD for whenever drafts grow up.

### What the schema gets right (don't change)

These are all good calls worth keeping:

- **UUID PKs everywhere except catalog records and job IDs.** Catalog
  records use `rec` + 14-char base62, deliberately matching the
  AirTable seed format — a thoughtful concession to the data source.
- **All timestamps are `DateTime(timezone=True)` defaulting to
  `now()`.** No mixed naive/aware columns. Rare in young schemas.
- **CHECK constraints, not Postgres `ENUM`, for closed value sets**
  (`cert_programs <@ ARRAY['phi','phius']`, `kind IN
  ('working','submitted','closed','snapshot')`, asset kinds, etc.).
  Easier to evolve than `ALTER TYPE`; Pydantic is the source of truth.
- **Deferred FK to break circular deps** in catalog
  `current_version_id` FKs (migrations 0007, 0009) — shows schema
  maturity.
- **Filtered partial indexes** are used where it matters:
  `ix_project_status_items_project_order` with `WHERE deleted_at IS
  NULL`, `uq_users_email_lower` on `lower(email)` with `WHERE deleted_at
  IS NULL` (sessions), `ix_project_assets_project_kind` with `WHERE
  deleted_at IS NULL AND upload_status = 'uploaded'`. This is good.
- **Destructive flatten migrations (0015–0017) explicitly raise
  `NotImplementedError` on downgrade.** Prevents accidental rollback
  of pre-deploy schema work. Exactly right.
- **Bounded `CHECK`s** on `project_jobs.progress` (0–100) and
  `user_table_views.view_state_size_bytes` (≤ 65536). Invariants live
  in the DB, not just app code.

---

## 3. Layering & module structure findings

### 3.1 Layer discipline is genuinely good

Spot-checked `auth`, `projects`, `catalogs/materials`, and `assets`:
routes never call repositories directly, services never raise
`HTTPException` (they raise `api_error(...)` from
`features/shared/errors.py`), and repositories don't import FastAPI.
This is the single most valuable structural property to keep, and it
is intact. Worth saying out loud because it's easy to lose once one
feature breaks the rule.

### 3.2 Docstring coverage is uneven

Per `context/CODING_STANDARDS.md` the bar is "docstring the *why* when
non-obvious". Coverage in practice:

- `auth/service.py`: `set_session_cookie`/`clear_session_cookie` have
  good docstrings; `authenticate()` (the 86-line function that manages
  three transaction scopes, conflict handling, and audit logging) has
  none.
- `projects/service.py`: no docstrings on `create_project`,
  `delete_project`, `restore_project`.
- `catalogs/materials/service.py`: no docstrings on public functions.
- `database.py`: every public function has a clear, useful docstring.
  Model this everywhere.

These are the public surface of each feature. A one-paragraph "what
invariants this function maintains and which transaction it runs in"
on each is ~20 minutes of work that pays back on every code review.
Do **now**.

### 3.3 REST action-URL style is split

Two styles coexist:

```python
# projects/routes.py — Google/AIP style
@router.post(":bulk-delete", ...)
@router.post("/{project_id}:delete", ...)
@router.post("/{project_id}:restore", ...)

# assets/routes.py — slash-verb style
@router.post("/{asset_id}/complete-upload", ...)
@router.post("/{asset_id}/attach")
@router.post("/{asset_id}/detach")
```

Both work. Pick one and add a one-line note in `backend/README.md` or
the route-registration block in `main.py`. Cheap now (rename a few
routes — they're not in any external spec yet); much more annoying
once the API is published. Do **now**.

### 3.4 What else is right

- **`api_error(status_code, error_code, message, details)`** as the
  one error-raising helper, returning a uniform `ErrorEnvelope`. Every
  feature uses it.
- **Pydantic separation**: `*Request` / `*Response` / `*Public` are
  distinct types. DB rows never reach the HTTP layer raw.
- **`Annotated[…, Depends(...)]` DI aliases** (`CurrentUser`,
  `AssetServiceDep`, `ProjectViewAccess`, `ProjectEditAccess`) — make
  route signatures readable and centralise auth/authz wiring.
- **Per-feature test layout** under `backend/tests/` mirrors `features/`.
  66 test files, no monolithic suite.
- **`database.py` is 80 lines** and does exactly one thing: pool +
  `connection()` / `transaction()` context managers. Double-checked
  locking on pool init, rollback-on-exception. This is the right
  shape and the right size.
- **`main.py` already has `GZipMiddleware`** (`main.py:62`,
  `minimum_size=1000`) — the largest finding from the 2026-06-04
  perf review has landed.

---

## 4. Carry-over from 2026-06-04 still worth holding open

- **List endpoints return entire tables** (materials, frame types,
  glazing types, etc.). At a few dozen projects with a few hundred
  catalog entries each, this is fine; if any catalog grows past a few
  thousand rows we'll want server-side pagination + filtering, not
  client-side. Track in the Materials Catalog PRD; don't pre-build.
- **Auth pipeline still does multiple SQL round-trips per request**
  (session `SELECT FOR UPDATE` + user fetch + touch `UPDATE`). The
  prior review estimated 3–8 ms per call. Acceptable; revisit if
  request rates climb or if you ever care about lock contention under
  burst load.

---

## 5. Recommended "do now" punch list

Single pre-deploy hygiene pass, ~2–3 hours total:

1. **One migration**: explicit `ON DELETE SET NULL` on all audit FKs
   (`created_by`, `updated_by`, `deleted_by`) that don't have one;
   add the missing `ix_project_jobs_result_asset` index. (~30 min)
2. **Extract `empty_project_document`** from `projects/service.py` into
   `project_document/templates.py` (or `projects/document.py` if you
   prefer feature-local). (~30 min)
3. **Pick a REST action style** and rename the inconsistent routes.
   Document the choice in `backend/README.md`. (~30 min)
4. **Add docstrings** to the eight or so public service functions that
   manage transactions or invariants — particularly `authenticate()`,
   `create_project()`, `delete_project()`, `restore_project()`, asset
   upload/intent functions. (~45 min)
5. **Decide and document**: is `user_table_views` deletable? Add
   `deleted_at` or add a one-line comment to migration 0010 saying it
   never is. (~5 min)

## 6. "Do next" punch list (next sprint, not blocking deploy)

1. **Split `project_document/document.py`** (1,358 lines) into models /
   templates / validation. (~2 h)
2. **Group `mcp/tools.py`** into a `mcp/tools/` package by tool
   family. (~1 h)
3. **Unify soft-delete** by migrating `users.is_active` → `deleted_at`.
   (~1–2 h)

## 7. "Watch" list (revisit when triggered)

- Pagination on catalog list endpoints — trigger: any catalog over
  1,000 rows, or a noticeably slow list page.
- Auth pipeline round-trips — trigger: real measured contention, not
  speculative.
- `project_version_drafts` audit columns — trigger: when multi-user
  concurrent draft editing becomes a real feature, not before.
- `assets/service.py` and `mcp/server.py` at ~714 lines — trigger:
  next time you're in either, look for a seam; otherwise leave alone.

---

## Closing read

This is a healthy small-app backend. The valuable things that are
hard to retrofit — layer discipline, timezone-aware timestamps, FK
integrity, error envelope uniformity, Pydantic v2 hygiene, pool
construction, gzip — are already in place. The findings here are
about keeping that quality from quietly slipping as the data model
grows, and about a half-day of mechanical cleanup that's much cheaper
now than after deploy locks in API URL shapes and downstream tools
start depending on the current module layout.
