---
DATE: 2026-06-24
TIME: 19:12 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 6 — pool + observability hardening for the remote-deploy transition.
RELATED: ../PLAN.md, planning/code-reviews/2026-06-24/backend-data-architecture-review.md
         (POOL-1/2, OBS-1..7, DOC-2), context/LOGGING.md
DEPENDS_ON: none. Runs independently of the data-shape phases.
---

# Phase 6 — Pre-Deploy Operational Hardening

## Goal

Make the backend safe and observable on a remote DB + object store. Secondary to
the data-shape cleanup per Ed's priorities, but the highest-value operational
work and independent of every other phase — can run any time. Cheap wins only;
no APM build-out (Sentry/drains stay deferred per `LOGGING.md`).

## Changes

### 6.1 Connection pool (POOL-1, POOL-2) — the real remote risk
`database.py:38-43`:
- Set explicit `min_size`/`max_size`/`timeout` as `Settings` fields (defaults
  e.g. min 2, max 10, timeout 10s — tune later).
- Pass `check=ConnectionPool.check_connection` so a server-killed connection is
  revalidated on checkout (idle timeout / DB restart safety).
- Drop the deprecated `open=True` from the constructor.
- Manage lifecycle in the FastAPI `lifespan` (`main.py:45`): open + `pool.wait()`
  at startup, `close_pool()` at shutdown (graceful Render redeploy drain).

### 6.2 `/health` + `/ready` (OBS-1, OBS-5)
- Keep `/health` (`features/system/routes.py`) a cheap static liveness stub —
  this is what Render's health check hits.
- Add `/ready`: call the existing-but-unused `check_connection()`
  (`database.py:76`), time it, and log `pool.get_stats()`
  (`requests_waiting`/`requests_wait_ms`/`connections_num` — the cheapest
  pool-saturation early-warning). `/ready` is for monitoring/manual use.
- Add `healthCheckPath: /api/v1/health` to `render.yaml`.

### 6.3 JSONB hot-path timing (OBS-2)
At the `project_document/store.py` boundary (load + save + patch), emit one
coarse `project_document.loaded` / `.saved` line per document op with `bytes`
(ties to the DOC-1 size guard) and `db_ms` (separates DB round-trip from
validation/serialization, which the middleware's `duration_ms` conflates). One
line per document op — within `LOGGING.md`'s "no per-row hot-path logging" rule.

### 6.4 Slow-query + R2 timing (OBS-3, OBS-4)
- Add a `slow_query_ms` `Settings` field; wrap cursor `.execute` in
  `database.py`'s `connection()`/`transaction()` and
  `log.warning("db.slow_query", duration_ms, op=…)` only over threshold — **no
  statement text/params** (PII rule).
- In `assets/storage_r2.py`, time `get/put/head/copy` + presign:
  `log.info("r2.op", op=…, duration_ms=…, bytes=…)`.

### 6.5 `user_id` contextvar binding (OBS-7)
Bind `user_id` into structlog contextvars once auth resolves the session
(`shared/middleware.py` + auth dependency) — `LOGGING.md` "Backend Request
Lifecycle" item 2, the one as-built gap.

### 6.6 Memoize whole-document recompute (DOC-2) — the one P1 perf item
`evaluator.py:483` `evaluate_document_formulas(body)` rebuilds the entire-document
eval state (snapshot ids + inverse links + every table context) on every
per-table read, then `build_inverse_table_view` re-walks it. Memoize per request
(cache keyed on `id(body)`, or thread a computed-state object through the slice
builders). No schema change. Ride-along because it touches the read path this
phase is already instrumenting.

### 6.7 Operator note (OBS-6) — no code
Document in `ENVIRONMENT.md`: enable `pg_stat_statements` and set
`log_min_duration_statement` (e.g. 500 ms) on the Render Postgres — server-side
truth (lock waits, plan regressions) app timing can't see, at zero code cost.

## Acceptance criteria
- Pool has explicit sizing + `check=` + lifespan open/close; no deprecation
  warning on startup.
- `/ready` exercises the DB and logs pool stats; `/health` static;
  `healthCheckPath` set in `render.yaml`.
- `project_document.loaded`/`.saved` lines carry `bytes` + `db_ms`; `db.slow_query`
  fires over threshold with no SQL text; `r2.op` lines present.
- `user_id` appears on in-request log lines once authenticated.
- Per-table reads recompute document state once per request (counter/spy test).
- `LOGGING.md`/`ENVIRONMENT.md`/`TECH_STACK.md` updated (pool sizing, health
  check, pg_stat_statements). `make ci` green.

## Implementation notes

- `Settings` now exposes `DATABASE_POOL_MIN_SIZE`,
  `DATABASE_POOL_MAX_SIZE`, `DATABASE_POOL_TIMEOUT_SECONDS`, and
  `SLOW_QUERY_MS`.
- `database.py` now constructs the pool with explicit sizing, `open=False`,
  and `check=ConnectionPool.check_connection`; `main.py` opens/waits during
  FastAPI lifespan startup and closes on shutdown. Direct test/script use still
  opens lazily through the existing `connection()` / `transaction()` helpers.
- `database.py` wraps checked-out `conn.execute(...)` calls and emits
  `db.slow_query` over threshold with `duration_ms` + `op`, no SQL text/params.
- `/api/v1/health` remains static; `/api/v1/ready` checks DB connectivity and
  logs pool stats. `render.yaml` now sets `healthCheckPath: /api/v1/health`.
- `project_document/store.py` and `project_document/repository.py` emit
  `project_document.loaded` / `project_document.saved` with `bytes` + `db_ms`.
- `assets/storage_r2.py` emits `r2.op` timing for presign/get/head/put/copy/
  delete/list/batch delete.
- Auth already bound `user_id` in session resolution; Phase 6 keeps that
  behavior under the request context middleware path.
- `formula/document_evaluator.py` and `inverse_view.py` now use request-local
  contextvar caches reset by `request_context_middleware`; tests pin one
  whole-document formula eval and one inverse table view build per request
  cache.
- `backend/.env.example`, `context/LOGGING.md`, `context/ENVIRONMENT.md`, and
  `context/TECH_STACK.md` document the new operational knobs and Render/Postgres
  observability note.

## Verification

Focused Phase 6 verification, 2026-06-24:

- `cd backend && uv run ruff check . --fix && uv run ruff format . && uv run ruff check . && uv run ty check`
- `cd backend && uv run pytest tests/test_system_routes.py tests/test_auth.py tests/test_mcp.py tests/test_project_document_formula_evaluator.py tests/test_project_document_inverse_view.py tests/test_project_document.py tests/test_assets_service.py tests/test_assets_orphan_sweeper.py tests/test_model_viewer_files.py` — 167 passed, 1 known asset 413 deprecation warning.

Closeout verification, 2026-06-24:

- `make format`
- `make ci` — backend 1100 passed, 2 skipped; frontend 1902 passed; frontend build passed. Existing warnings: React fast-refresh lint warnings, Vitest `act(...)` warnings, Recharts zero-size warnings, Vite large-chunk warning, and the known backend asset 413 deprecation warning.
- `graphify update .` — graph rebuilt: 13689 nodes, 36120 edges, 642 communities.

## Risks
- Low. Pool lifecycle is the only behavior change; covered by a startup/shutdown
  smoke. Keep slow-query/R2 timing off the happy path (one `perf_counter` diff).
