# Backend Test Suite Speedup Review

DATE: 2026-06-08
TIME: (local)

## Goal

Reduce total wall-clock time for `make ci` (and `make test-backend`) by
making the backend pytest suite faster, without weakening isolation
guarantees or the `*_test` database safety-net in
`backend/tests/conftest.py`.

## Baseline (local, M-series Mac, single worker)

Measured `cd backend && DATABASE_URL=...test uv run pytest ...`:

| Step                                         | Wall   |
| -------------------------------------------- | ------ |
| `uv sync --locked` (warm)                    |  0.02s |
| `ruff format --check .`                      |  0.03s |
| `ruff check .`                               |  0.03s |
| `ty check`                                   |  0.22s |
| `alembic upgrade head` (already migrated)    |  0.39s |
| `pytest` **with** coverage (`--cov=features`)| 51.4s  |
| `pytest --no-cov`                            | 45.5s  |

- 684 tests collected, 682 pass / 2 skip.
- Sum of per-test `call` duration: **29.6s**. Wall is **45s** → roughly
  **15s** is fixture setup/teardown (mostly `TRUNCATE … RESTART
  IDENTITY CASCADE`).
- Coverage overhead: ~6s (~13%) on top of 45s.
- No single test is slow — slowest is **0.42s**
  (`test_large_response_compressed_when_accept_encoding_gzip`); the next
  24 are all ≤ 0.42s. The pain is the **long tail of ~660 small tests**.
- 38 test files truncate; 44 `TRUNCATE` occurrences in `tests/`.
- 107 DeprecationWarnings (almost all
  `HTTP_422_UNPROCESSABLE_ENTITY` → `..._CONTENT`). Not a speed
  issue but adds noise to durations runs.

`pytest` is **~88% of CI-backend wall time** locally. On GitHub Actions
the absolute numbers will be larger (slower CPU, cold caches), but the
proportions hold — pytest is the lever.

## High-leverage changes (recommended)

### 1. Run pytest in parallel with `pytest-xdist`  (biggest single win)

Today the suite is single-process. CPU user time is **~70s** for a 45s
wall, meaning we're already partly I/O-bound on Postgres round-trips —
but `top` shows one Python and one Postgres backend, so we're leaving
3-7 cores idle on dev laptops and 1-3 cores idle on GH `ubuntu-latest`
(2 vCPU on free tier, 4 vCPU on the larger runners).

Estimated speedup: **2–3× on a 4-core runner**, gated by Postgres
contention.

Concrete steps:

1. Add `pytest-xdist` to backend dev deps:
   `cd backend && uv add --dev pytest-xdist`.
2. Make the test DB **worker-scoped** instead of one shared DB. The
   conftest can read `PYTEST_XDIST_WORKER` (e.g. `gw0`, `gw1`) and
   route each worker to a dedicated database like
   `ph_navigator_v2_test_gw0`. In CI, create N databases up front
   (`make db-create-test` already does one — generalize it to a loop
   keyed off `PYTEST_XDIST_WORKERS`). Locally, create on demand.
3. Apply migrations once per worker DB at session start (the existing
   `alembic upgrade head` step plus a per-worker fixture that runs
   migrations against its own URL the first time it's used).
4. Keep the existing `_refuse_to_truncate_dev_db` safety net — extend
   the suffix check to `endswith("_test")` **or** matches
   `_test_gw\d+$` so the guard still fires on misconfiguration.
5. Update `make test-backend` / `make ci-backend` to pass `-n auto` (or
   a pinned worker count) via pytest CLI or `addopts`.

Risk: tests that read process-global state (singletons, in-memory
caches) might leak. Spot-check candidates: the MCP fixtures, the assets
service tests using `moto`, and the formula evaluator corpus tests.
Mitigate by running the full suite with `-n auto` and triaging any
flakes one file at a time.

### 2. Replace per-test `TRUNCATE` with a transactional rollback fixture

`clean_document_tables` runs a 7-table
`TRUNCATE … RESTART IDENTITY CASCADE` **before and after** each test.
That's two round-trips per test plus catalog locks. With ~150 tests
using the fixture (rough share of the 38 files), that's ~300 truncates;
on local Postgres each is ~30–50ms → **9–15s** of pure plumbing.

Two paths, in order of payoff vs. risk:

**(a) SAVEPOINT-per-test (preferred).** Open one connection in a
session-scoped fixture, `BEGIN`, then in `clean_document_tables` do
`SAVEPOINT t` on entry and `ROLLBACK TO SAVEPOINT t` on exit. At
session end, `ROLLBACK`. App code must use the *same* connection —
this requires the `database.transaction()` helper to be patched (during
tests only) to hand out the open test connection rather than checking
out from the pool. That patch is the only real engineering cost; once
in place, isolation is effectively free.

**(b) `DELETE FROM` instead of `TRUNCATE`.** For small tables, `DELETE`
without `RESTART IDENTITY` skips the catalog lock and is faster under
contention (matters once xdist is on). Lower payoff than (a), but a
much smaller change — worth it as a stop-gap if the SAVEPOINT refactor
is deferred.

Risk for (a): tests that intentionally observe cross-transaction
behavior (e.g. anything that asserts a row is visible from a fresh
connection) would need to opt out. The current suite is mostly request
→ response → re-read against the same in-process app, so most tests
should be safe. Triage by running the suite under the new fixture and
fixing the holdouts (likely a handful).

### 3. Drop coverage from `make ci` / move it to a dedicated job

`--cov=features --cov-report=term-missing` is wired into
`backend/pyproject.toml` `addopts`, so **every** `pytest` run pays for
coverage instrumentation. That's the ~6s gap between 45s and 51s
locally, and a larger gap on slower runners.

Options, cheapest first:

1. Remove `--cov` from `addopts` and add a `make coverage` recipe that
   re-runs pytest with coverage on demand. Update CI: don't gate the
   PR on coverage; run it nightly or on `main` only.
2. Keep coverage in CI but split it into its own GH Actions job that
   runs in parallel with the lint/typecheck job, so it doesn't extend
   PR latency.
3. If we want fast coverage *and* the suite is on Python ≥ 3.12, switch
   to `coverage`'s `sys.monitoring` backend (`COVERAGE_CORE=sysmon`).
   We're pinned to 3.11 today, so this is a future option.

### 4. Cache `uv` and reduce CI cold-start

CI already uses `astral-sh/setup-uv@v5` with `enable-cache: true`, so
this is largely solved — but `uv sync --locked` and `uv python install
3.11` are still re-checked every run. Two small wins:

1. Pin a `cache-dependency-glob` on `backend/uv.lock` so the cache key
   invalidates only when the lockfile changes (avoids spurious misses).
2. Skip `uv python install 3.11` when uv reports the version is already
   present (it's idempotent today but spends a second checking).

These are seconds, not tens of seconds. Do them after the pytest work.

## Lower-leverage cleanups (worth doing once we're in the file)

- **Fix the 107 deprecation warnings.** `HTTP_422_UNPROCESSABLE_ENTITY`
  → `HTTP_422_UNPROCESSABLE_CONTENT` across
  `features/project_document/mutations/`. Doesn't change test time
  meaningfully but makes `--durations` output legible and stops
  drowning real warnings.
- **Disable the pytest cache in CI** (`-p no:cacheprovider`). We saw a
  modest startup save locally and CI has no warm cache to reuse anyway.
- **Collapse the two catalog-truncate copies.** `test_catalogs.py` and
  `test_catalogs_materials_duplicate.py` both define identical
  `_TRUNCATE` SQL and `_clean` fixtures (lines 16–31 each). Move to
  `conftest.py` so future refactors (e.g. swapping for SAVEPOINT) hit
  one site.
- **Audit `pytest-cov` exclusions.** `--cov=features` already scopes
  to the app package, but instrumentation still walks every imported
  module. Confirm no test imports from `research/` or other large
  out-of-scope packages.

## Suggested sequencing

1. **Quick wins, today (≈ 30 min, ~5–10s savings):** remove `--cov`
   from `addopts`, add `make coverage`, fix the 422 deprecation
   warnings, dedup the catalog truncate fixtures.
2. **Medium, 1 session (~2× speedup):** add `pytest-xdist`, add
   per-worker test DBs, update `make ci-backend` and `.github/workflows
   /ci.yml` to provision N databases and pass `-n auto`. Stop here if
   the resulting wall time is acceptable.
3. **Larger, 1–2 sessions (further ~2× on the DB-bound tail):**
   replace `clean_document_tables` (and the catalog `_clean` fixtures)
   with a SAVEPOINT-per-test transactional fixture wired through
   `database.transaction()`.

Order matters: do (1) and (2) before (3), so the SAVEPOINT work is
measured against a parallel baseline rather than the current
single-worker one. If xdist alone gets us under ~20s wall, (3) may not
be worth the refactor cost.

## Out of scope

- Frontend test/build speed (Vitest + Vite build) — separate review.
- Reorganizing `tests/` directory structure.
- Switching the test runner away from pytest.
