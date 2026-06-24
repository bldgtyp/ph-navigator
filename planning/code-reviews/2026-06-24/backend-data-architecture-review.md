---
DATE: 2026-06-24
TIME: 17:40 EDT
STATUS: Active — findings ready for triage. No code changed by this review; a
        batch of context-doc staleness fixes was applied in the same pass (see
        §8).
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Backend data structure, shape, and patterns — DB access / connection
       pool, the JSONB document model & schema-migration story, the relational
       schema & migrations, cross-feature structural/naming consistency, and
       observability/performance readiness for the move off local dev to a
       remote DB + object store. Out of scope: frontend, viewer, CSS (covered
       by 2026-06-14 / 2026-06-16 reviews).
RELATED: context/DATA_STORAGE.md, context/TECH_STACK.md, context/PRD.md,
         context/LOGGING.md, context/CODING_STANDARDS.md,
         context/technical-requirements/data-model.md,
         context/technical-requirements/save-versioning.md,
         context/technical-requirements/llm-mcp-schema.md,
         context/ENVIRONMENT.md
METHOD: 5 parallel exploration agents (one per slice) reading the real backend
        code + migrations, cross-checked against the context contracts and
        reconciled here. ~47K LOC backend, 43 Alembic migrations,
        schema_version 12.
---

# Backend Data-Architecture Review — 2026-06-24

## 0. How to read this

Findings are tagged **[P0]** (do before remote deploy / before real saved
data exists), **[P1]** (do soon — clear/obvious refactor), **[P2]**
(opportunistic / watch-item). Every finding carries a `file:line` breadcrumb.
§8 is a standalone documentation-staleness register. §9 lists what is good and
should not be "refactored" away.

> **Executable follow-through (2026-06-24).** These findings are sequenced into
> phased, executable work at
> `planning/refactor/backend-data-architecture-cleanup/` (README → PRD →
> decisions → PLAN → phases/). This review is the source-of-findings; that
> folder is the source-of-execution. The refactor leans on the current
> no-backwards-compat window (no users / no DB / no deploy) to make clean-cut
> shape changes now rather than build migration machinery.

This was deliberately a *data-architecture* review, not a bug hunt. The
top-line answer: **the architecture is sound and unusually disciplined; the
big initial bet (JSONB document + thin relational) is still the right one.**
The work to do is (a) a small set of pre-deploy operational hardening items,
(b) settling the document schema-migration story before any real data is saved,
and (c) routine consistency cleanups.

---

## 1. Executive summary

| Question you asked | Answer |
|---|---|
| Is the **JSONB-blob + some-relational** shape still right now that features are fleshed out? | **Yes — keep it.** Bodies are small (~50 KB dev seed; low-hundreds-of-KB for large real projects, ≪ the 5 MB "revisit" threshold). The friction that has appeared is **Python CPU/validation cost on a whole-document basis**, *not* a storage mismatch. Extracting tables to relational would add a second source of truth and break the immutable-version / diff / export guarantees while *not* fixing the actual cost. Keep-with-additions (§2). |
| Are we **consistent** in formatting / naming / structure? | **Strongly, yes.** 4-layer feature discipline is high, error handling is uniform (`shared.errors.api_error` everywhere, zero raw `HTTPException`), routes are uniformly `/api/v1/` kebab-case, SQL is uniformly parameterized with zero injection. Inconsistencies found are small and enumerable (§6). |
| Are we following **best-practice / well-known patterns**? | Mostly yes — raw-SQL-repository + Pydantic boundary is executed faithfully and the high-stakes save/version/draft flows have correct transaction boundaries (`FOR UPDATE` + ETag). The exceptions are operational, not structural: connection-pool lifecycle/sizing, and the not-yet-built document schema-migration discipline (§3, §4). |
| Any **clear/obvious refactors** worth doing? | Yes, a handful — all low-risk: split 5 oversized modules, move 3 SQL-in-service leaks into repositories, unify the two document-write architectures, add a body-size guard, memoize whole-document formula recompute. None are rewrites. (§6, §10) |
| Can we add cheap **observability** to catch perf issues on remote? | Yes, and you're closer than expected — request-latency logging, structlog JSON, and request-id propagation already exist. The gaps are a real `/ready` DB probe, pool-saturation stats, JSONB hot-path timing, and slow-query logging (§5). |

**The single most important thing:** the document schema-migration story
(§4) must be settled *before* the first real project is saved on the remote
DB. Versions are immutable by design, so the current "reseed + bump,
no/partial body-migration" approach (which works only because there are no
users) cannot be applied retroactively to saved data.

---

## 2. The headline question — is the data shape still right?

**Verdict: keep the single Pydantic-validated JSONB document per version as the
system of record. Do not extract tables to relational storage. Do not add GIN
indexes / generated columns / sidecar search tables yet. Add a size guard and
two cheap hot-path fixes instead.**

### 2.1 Why the blob is still the right *storage* choice

- **Size is a non-issue.** A fully-assembled dev-seed body is ~50 KB; even a
  large real project (dozens of assemblies, hundreds of rooms/equipment rows)
  lands in the low-hundreds-of-KB — an order of magnitude under the doc's own
  ~5 MB revisit trigger (`data-model.md` §6.4). Postgres JSONB at this size is
  free.
- **The load-bearing requirements fall out of the blob for free:**
  immutability-by-version, linear `parent_version_id` history, whole-document
  diff, clean JSON export, and predictable whole-document MCP/LLM reads. A
  relational entity tree (V1's model) would have to *reconstruct* all of these.
  Certification (locked, immutable revisions) is the reason V2 exists and the
  blob serves it directly (`PRD.md` §2).
- **It is genuinely thin-relational beside the blob, not shadowed.** The
  migration review confirms **no relational table shadows a document table**.
  The relational layer is exactly what the contract says it should be:
  identity, project metadata, catalogs, asset registry, climate datasets,
  jobs, UI views, audit. The split is holding.

### 2.2 Why the *cost model* is straining — but in Python, not Postgres

The document is no longer "a blob of project data." It now also carries, in the
same body: the **schema of the data** (`field_defs` — an AirTable-style
per-table registry), **computed/derived values** (a full formula AST +
parser/evaluator/resolver, inverse-link overlays, rollups), and **option
vocabularies** (`single_select_options`). That accretion is real and it shows
up as `O(whole-document)` Python work on per-row / per-table operations:

- Every draft read validates the document **twice** — version body + draft body
  (`store.py:208` `load_current_document_parts`), each running the full
  ~330-line cross-table validator (`document.py:402`
  `validate_document_references`, which builds the entire formula graph).
- Every single-row write re-validates the whole document. The heat-pumps path
  is worst: `validate_document(body.model_copy(...).model_dump(mode="json"))`
  — a full model→dict→model round-trip plus full cross-table validation,
  *after* its own `_validate_slice` already ran (`heat_pumps/service.py:202`).
- Every table-slice read calls `evaluate_table_formulas` →
  `evaluate_document_formulas(body)` (`evaluator.py:483`), which builds the
  **entire-document** eval state (snapshot row-ids + inverse links over *all*
  tables) and then discards everything except the one requested table. Reading
  a formula-free Pumps table still pays a full-document sweep. N tables on a
  screen = N full-document sweeps.

This is the precise sense in which the new features "fight the blob" — and the
fix is **in-process caching + a size cap**, not relational extraction. You would
still pay the Pydantic-validation and Python-iteration cost after extracting
tables; you'd just also have a second source of truth and a broken diff/export
story.

### 2.3 The "keep-with-additions" list

1. **[P0]** Add a hard body-size guard (§3, finding DOC-1).
2. **[P1]** Memoize whole-document formula/inverse computation per request
   (§3, finding DOC-2).
3. **[P1]** Drop the heat-pumps double-validate round-trip (§3, finding DOC-3).
4. **[P2]** Add "whole-document recompute on per-table reads" and
   "per-save serialization count" as watch-items alongside the existing 5 MB
   threshold in `data-model.md` §6.4.

Reaffirm the §6.4 deferral of GIN/generated-columns/sidecars — they remain
unjustified and none exist today (confirmed: the only document-table index is a
btree on `project_versions(project_id, created_at)`).

---

## 3. JSONB document model — findings

| # | Sev | Finding | Breadcrumb |
|---|---|---|---|
| DOC-1 | **P0** | **No size guard on the document body anywhere.** `body_size_bytes` is computed/persisted for ops-visibility only; nothing rejects an oversized body, even though imports, assets, and `view_state` (≤64 KiB) all have caps. An MCP agent or a runaway formula/options write can grow the body without limit; with whole-document revalidation on every op, growth degrades *every* read/write super-linearly. Add `MAX_BODY_BYTES` → 413 at the draft/save/save-as write boundaries (and the heat-pump/aperture/envelope paths that bypass `replace_table_slice`). The size helper already exists. | `validation.py:28`, `drafts.py:286,333` |
| DOC-2 | **P1** | **Per-table reads do whole-document formula+inverse work even with zero formulas.** `evaluate_table_formulas` recomputes `evaluate_document_formulas(body)` (snapshot ids + inverse links + every table context) on each call, then `build_inverse_table_view` re-walks all contracts again. Memoize per request (e.g. cache keyed on `id(body)`, or thread a computed-state object through the slice builders). No schema change. | `evaluator.py:483,486`; callers `rooms.py:353`, `pumps.py:187` |
| DOC-3 | **P1** | **Heat-pumps write path double-validates via a redundant model→json→model round-trip**, and `_validate_slice` overlaps the document-level heat-pump checks the full validator already runs. Validate the already-typed `body.model_copy(update=...)` without re-serializing; drop the overlap. | `heat_pumps/service.py:202,216`; doc-level checks `document.py:613-664` |
| DOC-4 | **P1** | **Two parallel single-row write architectures.** Heat-pumps keeps a bespoke `apply_patch` / `JsonPatchOp` / `_apply_patch_to_body` service (own delete-cascade + dry-run preview) while all other equipment tables go through the generic `replace_table_slice`. Heat-pumps is the only table registering four `TableContract`s *and* re-implementing ETag handling, draft creation, and validation. New invariants (e.g. DOC-1's size guard) must be added in 3–4 places. Fold heat-pump add/replace/delete into the registered-contract `apply_replace` surface, or document why it is deliberately separate. | `heat_pumps/service.py:115` vs `drafts.py:94` |
| DOC-5 | **P1** | **Schema migration is in-place but incomplete and silent past one version.** `schema_version` is pinned `Literal[12]`; the two `mode="before"` migrators unconditionally stamp `schema_version = 12` on *any* dict and only transform the v11→v12 aperture shape. A v8 body is relabeled "12" with no v8→v11 transform, fails per-field validation, and drops to the read-safe envelope. The `schema_version` integer therefore stops being trustworthy. Gate each migrator on the *source* version and chain them; only set 12 once transforms have actually run. (See §4 for the full migration-story problem this is one symptom of.) | `document.py:291,350,371`; fallback `store.py:249` |
| DOC-6 | **P2** | **`document_etag` and `body_size_bytes` each fully re-serialize the body**, so a single save runs 2–3 whole-document serializations. Compute the canonical JSON once per request and derive both. | `validation.py:18-29` |
| DOC-7 | **P2** | **Diff loads two whole bodies and deep-compares every table in Python.** Fine at current sizes; the canary for the §6.4 5 MB trigger. No action now. | `diff.py:39-46,60` |

**Good here (do not undo):** storage-boundary discipline (only copied catalog
values + asset *ids*, no live joins / durable URLs); concurrency is *genuinely
correct* — `FOR UPDATE` locks inside one transaction + `If-Match` /
`If-Match-Version` ETags on draft patch and Save, with browser and MCP sharing
the same `(version_id, user_id)` draft through the same ETags (no race window
found); the read-safe envelope is the right failure mode (degrade to read-only
+ raw download, never 500); and the registered-contract abstraction keeps
generic routes table-agnostic for 16 of 17 tables.

---

## 4. The document schema-migration story (cross-cutting — needs a decision)

This is the most important architectural item and it spans the document model
*and* the migrations. Right now there are **three partially-overlapping
migration mechanisms**, two of which actually run and one of which is the
documented-but-unbuilt intent:

1. **Read-time `mode="before"` shims** (`document.py:291-400`) — relabel
   `schema_version` and transform v11→v12 apertures during validation. In-place,
   does not mutate the row. (DOC-5: incomplete past one step.)
2. **Deploy-time Alembic body-rewrite migrations** (`0027`–`0031`) — load every
   `project_versions` and `project_version_drafts` row into Python, mutate the
   JSONB (unit conversions, field add/remove, schema bumps v5→6→7), recompute
   ETags, `UPDATE` back. Full-table read+rewrite of the largest column inside
   the deploy's `migrate` step; no batching; ETag/size helper logic
   copy-pasted verbatim across all five files (can't import the app's canonical
   function, by the frozen-migration rule).
3. **The documented intent** (`llm-mcp-schema.md` §10.5) — a forward-only pure-
   function shim chain (`upgrade_v1_to_v2`, …), golden-file corpus CI, a
   production-corpus drill before every bump, lazy migration on Save, never
   mutate the row. Marked **post-MVP and not built.**

**Why it's urgent:** versions are immutable. Today's "clean cut / reseed / dev
DBs rebuild" approach is valid *only because there are no users and no saved
data*. The moment a real project version is saved on the remote DB, you can no
longer reseed it — you must be able to read it forever (`llm-mcp-schema.md`
§10.5 "the hard guarantee"). The PRD already flags this as a top risk
(`PRD.md` §15 "Schema migration discipline"; §16 success criteria explicitly
defer forward-upgrade shims to "post-MVP schema-evolution hardening").

**Recommendation (decide, then write down):** pick the single canonical
mechanism before first real save. The two viable shapes:

- **(A) Read-time forward-only shim chain** (the §10.5 design): bodies migrate
  lazily on read, land at `CURRENT` only on Save, original rows untouched.
  Best fit for the immutable-version model; requires the golden-file corpus and
  the chained-by-source-version fix from DOC-5. This is the recommended target.
- **(B) Deploy-time Alembic body rewrite** (what `0027`–`0031` already do):
  simpler to reason about but mutates "immutable" saved bodies in place on every
  schema change, needs batching as bodies grow, and duplicates the ETag/size
  logic. Acceptable as a stopgap; not a good permanent answer for an
  immutable-revision product.

Either way: (1) **collapse to one mechanism**, (2) build the golden-file
fixture corpus + roundtrip-idempotency CI gate the docs already specify, and
(3) reconcile `llm-mcp-schema.md` §10.5 + `save-versioning.md` §8.3 +
`data-model.md` §6.6.1 to describe what actually ships. Until then, treat
"bump schema_version" as a gated operation, not a routine one.

> This is a good candidate to graduate into
> `planning/refactor/document-schema-migration/` per `planning/.instructions.md`
> rule #3, since it spans multiple features.

---

## 5. Observability & performance readiness (the remote-deploy ask)

**You are in better shape than `LOGGING.md` implies.** Already done and
production-ready: the structlog JSON pipeline (redaction processor, 4 KiB
field-size cap, `environment`/`git_sha`/`app_version`/`instance_id` bound on
every line), `request_id` propagation via middleware (accepts/validates
`X-Request-ID`, echoes it, carries it in error envelopes), and — the headline
correction — **per-request latency logging already exists**:
`log.info("http.request", status, duration_ms, request_bytes, response_bytes)`
with `perf_counter` timing and health/openapi sampling
(`shared/middleware.py`). 4xx→warning / 5xx→error logging is wired. This is the
single most valuable piece of perf observability and it's in place.

**What's missing — ranked by value/effort:**

| Recommendation | Value | Effort | When |
|---|---|---|---|
| **OBS-1** Make `/health` a cheap-static liveness probe + add `/ready` that pings the DB (`SELECT 1`) and logs `pool.get_stats()`; set `healthCheckPath` in `render.yaml`. `database.py` already has an **unused** `check_connection()` to wire in. | High | Low | **P0 / pre-deploy** |
| **OBS-2** Time + size the document JSONB read/write hot path (`bytes`, `db_ms`) at the `project_document/store.py` boundary. This is the app's hottest path and the most likely first remote-DB surprise (large blob over a network hop). | High | Low–Med | **P0 / pre-deploy** |
| **OBS-3** Slow-query logging: env-gated `slow_query_ms` threshold; wrap cursor `.execute` in `database.py`'s `connection()`/`transaction()` and `log.warning("db.slow_query", duration_ms, op=…)` over threshold (no statement text/params — PII rule). | High | Med | **P0 / pre-deploy** |
| **OBS-4** Time R2/boto3 calls (`r2.op`, `duration_ms`, `bytes`) in `assets/storage_r2.py` — presign is local-fast, but get/put/head/copy are real Cloudflare round-trips. | Med–High | Low | P1 |
| **OBS-5** Set explicit `psycopg_pool` `min_size`/`max_size`/`timeout`/`check=` (see POOL-1 below) and surface `pool.get_stats()` on `/ready` — `requests_waiting`/`requests_wait_ms` is the cheapest early-warning for pool saturation once the DB is remote. | Med–High | Low | **P0 (sizing)** / P1 (panel) |
| **OBS-6** Enable Postgres `pg_stat_statements` + `log_min_duration_statement` on the Render DB (operator action, no code) — server-side truth app timing can't see (lock waits, plan regressions). | High | Low | **P0 / pre-deploy** |
| **OBS-7** Bind `user_id` into contextvars once auth resolves (`LOGGING.md` item #2, not yet wired). | Med | Low | P1 |
| **OBS-8** Sentry (backend + browser) and a log-drain for >7-day retention. | Med | Med | Later — when the user base grows past direct contact (matches the `LOGGING.md` non-goal). |

**Sketch — OBS-1 (`/ready`):** keep static `/health` for Render's health check
(so a transient DB blip doesn't kill the instance); add `/ready` in
`features/system/routes.py` that calls the existing `check_connection()`, times
it, and logs `pool.get_stats()`. ~30 min.

**Sketch — OBS-2 (hot path):** wrap `get_saved_document` / save / `patch_version`
in `store.py` with `perf_counter` + `len(json.dumps(body))`; emit one
coarse-grained `project_document.loaded` / `.saved` line per document op (this
is the allowed shape under `LOGGING.md`'s "no per-row hot-path logging"). `bytes`
flags growth (ties to DOC-1); `db_ms` separates DB round-trip from
validation/serialization, which the middleware's `duration_ms` currently
conflates.

---

## 6. DB access, connection pool, repository & feature consistency

### 6.1 Connection pool (the operational risk for remote)

| # | Sev | Finding | Breadcrumb |
|---|---|---|---|
| POOL-1 | **P0** | **Pool is fixed at 4 connections and cannot grow.** No `min_size`/`max_size` passed → psycopg_pool defaults pin it at exactly 4 with no growth and **no `check=` callback**, so a server-killed connection (idle timeout, DB restart) is handed out stale and the request errors. FastAPI runs sync routes in a ~40-thread pool, so >4 concurrent DB-touching requests serialize on checkout. On a remote DB with real latency this is the most likely first production stall. Set explicit `min_size`/`max_size`/`timeout` (as `Settings` fields) + `check=ConnectionPool.check_connection`. | `database.py:38-43` |
| POOL-2 | **P0** | **No FastAPI lifespan management of the pool.** Built lazily on first `get_pool()` with deprecated `open=True`, never `close_pool()`d on shutdown. Causes first-request warm-up latency and no graceful drain on SIGTERM (matters for Render redeploys). Open the pool in `lifespan` startup (`get_pool(); pool.wait()`), `close_pool()` on shutdown, drop `open=True`. | `database.py:38-43`, `main.py:45-49` |

These two dovetail with OBS-5: explicit sizing + `/ready` pool-stats is the
whole pre-deploy pool story.

### 6.2 Repository / service layer

| # | Sev | Finding | Breadcrumb |
|---|---|---|---|
| REPO-1 | **P1** | **Raw SQL inside service classes that own a repository** (flagged independently by two reviewers — high confidence). `conn.execute(SELECT …)` runs directly in service methods even though both features have a `repository.py`. Move into named repo functions. | `assets/service.py:583,604`, `projects/service.py:570` |
| REPO-2 | **P1** | **`assets` feature uses `schemas.py` where every other feature uses `models.py`** (the only such feature) **and** its repository returns Pydantic models while every other repo returns `dict` and validates in the service. Pick the prevailing convention (repo→dict, service validates) and rename `assets/schemas.py` → `models.py`. | `assets/schemas.py`, `assets/repository.py:69,85,102` |
| REPO-3 | **P2** | **Asset-reference GC pulls every version *and* draft body** (the large JSONB) into Python, then validates each in a loop, to extract asset ids. Fine as an admin/GC path; if it ever lands on a hot path, use a JSONB extraction in SQL. | `assets/service.py:583-595` |
| REPO-4 | **Nit** | Connection acquired in a route helper (`_active_version_id`); minor — move to the service layer. Repo create-verb split: `create_session` vs the majority `insert_*`. Catalog SQL lives in `_shared.py`/`import_export/service.py` rather than a `repository.py` (repository-equivalent but the boundary name isn't honest). | `heat_pumps/routes.py:116`, `auth/repository.py`, `catalogs/_shared.py:154` |

### 6.3 Module size — split recommendations (P1, low-risk)

Six files sit at 843–900 lines, approaching the 1000-line hard limit with no
written exception (`CODING_STANDARDS.md`):

- `project_document/document.py` (900) → split the ~330-line cross-table
  validator into `document_validation.py`; keep models + migration validators.
- `assets/service.py` (875) → split by workflow (`uploads`/`downloads`/`jobs`/
  `sweep`); the sweep split also resolves REPO-1's GC SQL.
- `project_document/formula/evaluator.py` (870) → split the single-cell
  evaluator from the document-graph evaluator (shared primitives).
- `mcp/tools.py` (801) → split by domain (`tools_projects`/`tools_documents`/
  `tools_assets`/`tools_envelope`) mirroring REST features; precedent already
  exists (`tools_custom_fields.py`).
- `project_document/tables/heat_pumps.py` (843) → split models from
  registry/apply/option machinery (lower priority; large because it's 4 tables).
- `mcp/server.py` (863) → **leave it** — it's ~40 declarative `@tool`
  registrations, the case the standard explicitly exempts.

### 6.4 Naming / structure — what's already consistent (don't churn)

Error handling is uniform (`api_error` → one `ErrorEnvelope`, zero raw
`HTTPException`; domain modules raise typed exceptions translated at one
boundary per feature). Routes are uniformly `/api/v1/` kebab-case. Function
naming is consistent (`get_`/`list_`/`create_`/`update_`/`delete_`/`apply_` in
services; `get_`/`list_`/`insert_`/`update_`/`soft_*` in repos). Model naming
is disciplined (`*Request`/`*Response` + `Public`/`Summary`/`Detail`/`Row`/
`Envelope`). The three catalogs are structurally identical (only the
deliberate `_name.py`/`options_service.py` additions for glazing/frame option
lists differ). "Thin" features (`system`, `schemas`, `aperture_u_value`,
`apertures_mcp`, `aperture_hbjson_export`) correctly omit layers they don't
need.

---

## 7. Relational schema & migrations

**Verdict: the thin-relational + JSONB split is holding; PK strategy, FK
`ON DELETE` semantics, and soft-delete are deliberate and well-executed.**
Findings are hygiene + two real correctness gaps + doc drift.

| # | Sev | Finding | Breadcrumb |
|---|---|---|---|
| REL-1 | **P1** | **`project_location.epw_asset_id` is declared a cross-store pointer but has no FK** (it's `TEXT`, unconstrained), yet `data-model.md` §6.1 and `DATA_STORAGE.md` §6 both list it as `REFERENCES project_assets(id)`. A `project_assets` row can be hard-deleted out from under it, and anonymous asset resolution gates on it (`_asset_is_referenced` / `project_location.epw_asset_id`). Add `FK … ON DELETE SET NULL`, or document it as a deliberately-unenforced id like `project_climate_source.ref`. | `0023_project_location.py` |
| REL-2 | **P1** | **Document-body data migrations run inside Alembic** (`0027`–`0031`) — see §4. Riskiest migrations in the set (touch user document data, full-table JSONB rewrite, no batching, copy-pasted ETag/size logic). Decide the migration mechanism (§4); if Alembic body-rewrite stays, add a frozen `_doc_migration_helpers.py` under `versions/` and a chunking note for when bodies grow. | `0027`–`0031` |
| REL-3 | **P2** | **`project_climate_source.ref` can dangle silently.** Polymorphic by `kind` so it correctly has no FK, but a `climate_dataset` re-seed (changes location ids) or EPW purge orphans `phius`/`phi`/`weather` refs with no integrity sweep (assets have one). Confirm the resolve path returns "source unavailable" not 500; note the re-seed hazard in `DATA_STORAGE.md`. | `0026`, `0034` |
| REL-4 | **P2** | **Two migrations import live app code** (`0038`/`0041` import `_option_seeds`) while their siblings `0039`/`0042` inline the SQL with the comment "migrations are frozen and cannot import app code." Inline the seed literals, or formally bless `_option_seeds.py` as a frozen append-only module. | `0038`, `0041` |
| REL-5 | **P2** | **No Alembic `naming_convention`** (`env.py` has `target_metadata = None`), so inline FK/unique constraints get Postgres-default names that `0008`/`0020` then had to hardcode to alter — the single most repeated hygiene smell. Either always pass explicit `name=` (most migrations already do) or set a `naming_convention` once. Also unify constraint prefixes (`ck_` vs bare `_allowed`; `ix_`/`ux_`/`uq_`/`idx_`). | `alembic/env.py`, `0008`, `0020` |
| REL-6 | **P2** | **`idx_user_table_views_project_lookup` looks unused** — the repo only ever queries by the full PK `(user_id, project_id, table_key)`. Dead index = write overhead. Confirm no "reset all users' views for a table" admin path is planned, then drop. | `0010` |

**Missing-index candidates** (justified once volume appears — not urgent
pre-scale): `ix_user_action_log_user_created (user_id, created_at)` (the audit
table is "queryable by SQL" for support but only `created_at` is indexed);
`project_climate_source (project_id, kind)` (low — small cardinality);
`project_versions(parent_version_id)` (history-walk + the FK's own
`ON DELETE SET NULL` seq-scan; add if version trees grow).

**Verified NOT bugs:** `uq_users_email_lower` spanning soft-deleted rows is the
deliberate conflict target for `upsert_user`'s "resurrect soft-deleted user"
pattern (`auth/repository.py`). `bt_number` global UNIQUE (no partial filter)
is intentional — numbers never reused.

**Good here (do not undo):** PK strategy is intentional per row purpose (UUID
for identity, `rec…` AirTable-shaped for portable catalog rows, `asset_…`/
`job_…` TEXT for object-registry rows, `BIGSERIAL` only for append-only audit);
FK `ON DELETE` was actively hardened (`0020` relaxed audit FKs to `SET NULL`,
`owner_id` is `RESTRICT`); soft-delete is uniform with correctly-scoped partial
indexes; CHECK-vs-`catalog_field_options`-table enum policy is coherent;
case-insensitivity via functional indexes (`lower(email)`,
`lower(btrim(label))`); every JSONB escape-hatch column is justified and none is
creeping toward "should be real columns"; migrations are hand-written
(`target_metadata = None`, no autogenerate) and honest about irreversibility
(`0015`–`0017` raise `NotImplementedError` on downgrade rather than faking it).

---

## 8. Documentation staleness register

The context docs are generally excellent and recently maintained, but the
fast-moving document model has outrun several of them. Items marked **[FIXED]**
were corrected in this same pass; **[PENDING]** need a follow-up (some require
content I did not want to invent).

- **[FIXED] `data-model.md` §6.6.1 / `DATA_STORAGE.md` §3** — said schema_version
  "7–8 range" / documented through v8. Code is `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 12`
  (`document.py:208`). Added v9–v12 pointer to the `document.py` docstring as
  the authority.
- **[FIXED] `llm-mcp-schema.md` §10.5** — said "the current
  `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` is `3`." Updated to 12 and noted
  that an in-place migrate-on-read path now exists (so the "no v2/v3 reader,
  pre-deploy posture" framing is no longer literally true). Full reconciliation
  of the three migration mechanisms is **[PENDING]** on the §4 decision.
- **[FIXED] `data-model.md` §6.1** — `users` still showed `is_active` (replaced
  by `deleted_at` in `0021`); `project_location` showed `site_address` (renamed
  `street_address` + `postal_code` added in `0036`) and typed `epw_asset_id` as
  `UUID REFERENCES project_assets(id)` (actually `TEXT`, unconstrained).
  Corrected.
- **[FIXED] `data-model.md` §6.1** — still listed the dropped catalog
  `*_versions` tables (removed in flatten migrations `0015`/`0016`/`0017`).
  Corrected; `catalog_audit_log` reference flagged inline.
- **[FIXED] `TECH_STACK.md`** — directory sketch showed `backend/db/connection.py`
  (actual: `backend/database.py`, no `db/` package) and a "repositories return
  Pydantic" example that contradicts the prevailing convention (repos return
  `dict`, services validate). Annotated.
- **[FIXED] `LOGGING.md`** — described the `http.request` access line and
  request-latency logging as future/aspirational; it is already implemented
  (and logs `request_bytes`/`response_bytes` too). Moved to past tense; noted
  `user_id` binding is still TODO and that no DB-query timing exists yet.
- **[PENDING] `data-model.md` §6.6.3** — field-type table lists 6 types; code's
  `CustomFieldType` (`custom_fields.py:82`) has 8 (adds `color`,
  `linked_record`). Left pending: needs a careful edit to the closed-set table +
  the "future types out of scope" note.
- **[PENDING] `DATA_STORAGE.md` §5.3** — the per-project climate-source `kind`
  table still lists `epw` and `ashrae` as separate kinds; `0034` merged them
  into `weather`. (The `data-model.md` §6.1 column comment is already correct.)
- **[PENDING] `save-versioning.md` §8.3** — "no v2/v3 reader (pre-deploy
  posture)" contradicts the in-place `mode="before"` migration path that now
  exists. Reconcile as part of the §4 decision.
- **[PENDING] `data-model.md` §6.4** — accurate and should stay (no query infra
  exists; deferral intact). Suggest adding "whole-document recompute on
  per-table reads" and "per-save serialization count" as watch-items beside the
  5 MB threshold.
- **[PENDING] `CODING_STANDARDS.md`** — (a) says `models.py` is mandatory but
  `assets/` ships `schemas.py`; (b) the "feature-shape check" and "boundary
  check" (route modules don't import `database`; repos don't import FastAPI) are
  still aspirational and would now catch REPO-1/REPO-2 — worth implementing; (c)
  bless the domain-exception→boundary-translation pattern that `mcp`/`climate`/
  `catalog import_export` use consistently.
- **[PENDING] `TECH_STACK.md` / `DATA_STORAGE.md`** — pool sizing/lifecycle is
  undocumented; write it down once POOL-1/POOL-2 are decided.
- **[PENDING] `ENVIRONMENT.md` / `render.yaml`** — no `healthCheckPath`; document
  once OBS-1 lands.

---

## 9. What is good (so a future refactor doesn't break it)

- **Raw-SQL discipline is textbook.** Zero injection anywhere; all dynamic SQL
  uses `psycopg.sql` composition with allowlist guards; `dict_row` set once at
  the pool. Transaction correctness is the strongest part of the codebase
  (single-transaction multi-statement writes with `FOR UPDATE` + ETag gating;
  per-row `SAVEPOINT`/`ROLLBACK TO`/`RELEASE` for catalog-import partial
  failure). No N+1 loops.
- **Concurrency model is correct** end-to-end on the server side (§3).
- **The registered-table contract** genuinely keeps generic routes
  table-agnostic for 16/17 tables, with module-load drift guards.
- **Error handling, routing, naming, and the catalog tri-structure** are
  consistent to a degree most codebases never reach (§6.4).
- **Migrations are hand-written, deliberate, and honest** about irreversibility
  (§7).
- **Observability foundations** (structlog JSON, redaction, request-id,
  request-latency) are already production-grade (§5).

---

## 10. Recommended action sequence

**Before remote deploy / before first real saved data (P0):**

1. POOL-1 + POOL-2 — explicit pool sizing + lifespan open/close + `check=`.
2. OBS-1 — `/ready` DB probe + `healthCheckPath`; OBS-6 — Postgres
   `pg_stat_statements` + `log_min_duration_statement` (operator).
3. DOC-1 — body-size guard (413).
4. §4 — **decide** the document schema-migration mechanism and write it down;
   stand up the golden-file corpus before bumping schema_version again.
5. OBS-2 + OBS-3 — JSONB hot-path timing + slow-query logging.

**Soon — clear/obvious refactors (P1):**

6. REPO-1/REPO-2 — move SQL-in-service into repositories; rename
   `assets/schemas.py`; unify repo return convention.
7. DOC-2 + DOC-3 — memoize whole-document recompute; drop heat-pumps
   double-validate.
8. DOC-4 — unify heat-pumps onto the registered-contract write surface.
9. §6.3 — split the 5 oversized modules.
10. REL-1 — `epw_asset_id` FK (or document the looseness).

**Opportunistic / watch (P2):** OBS-4/OBS-5/OBS-7, REPO-3/REPO-4,
REL-3/REL-4/REL-5/REL-6, DOC-6/DOC-7, missing-index candidates, and the
remaining §8 [PENDING] doc fixes.

Accepted cross-cutting items (notably §4) should graduate into
`planning/refactor/<slug>/` per `planning/.instructions.md` rule #3.
