---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Independent infra cleanup; not part of the 9-plan
        AirTable-parity series. Can land any time after Plan 09.
SCOPE: Stop sharing one Postgres database between `pytest` and the
       human-driven dev workflow. Today every backend test fixture
       `TRUNCATE ... users RESTART IDENTITY CASCADE`s the same DB the
       developer is logged into, so a single `make test` silently
       deletes the seeded dev user, every project, and every saved
       view. Move tests onto a dedicated `ph_navigator_v2_test`
       database so test truncation can never touch dev data again.
PARENT-STORY: n/a (developer-experience / infra)
PRECEDING-PLANS: none
RELATED:
  - backend/tests/conftest.py
  - backend/tests/test_*.py (every fixture that calls TRUNCATE)
  - backend/config.py (Settings.database_url)
  - backend/database.py (pool init)
  - docker-compose.yml (single Postgres service)
  - Makefile (`test`, `test-backend`, `seed-dev-user`, `db-reset`)
  - context/ENVIRONMENT.md
---

# Plan 10 — Separate test database

## 1. Why this plan exists

The backend test suite shares one Postgres database with local dev.
Every test fixture truncates `users`, `sessions`, `projects`,
`project_versions`, `project_status_items`, `user_table_views`, etc.
with `RESTART IDENTITY CASCADE`. As soon as `make test` runs once,
the dev user disappears, every project the developer created is gone,
and every persisted table view is wiped. The current workaround is to
re-run `make seed-dev-user` after every test run and to rebuild any
demo project by hand.

This is a foot-gun that has bitten this codebase at least three times
already. The right fix is to never let test code touch the dev
database in the first place.

## 2. Binding constraints

1. **Two named databases, one Postgres instance.** Reuse the existing
   container (`phn-v2-postgres`). Add a second database
   `ph_navigator_v2_test` alongside `ph_navigator_v2`. Both belong to
   the same `phn` role. No separate container, no second port.

2. **Tests must use the test DB unconditionally.** Pytest must not
   require the developer to remember to set an env var. Either
   `backend/tests/conftest.py` overrides `DATABASE_URL` before
   `Settings` is imported, or `pytest` is run with the env var
   already set (a `pyproject.toml` `[tool.pytest.ini_options]` entry,
   or a wrapper in the Makefile).

3. **The override must beat the in-process settings cache and the
   psycopg connection pool.** `database.py` lazily caches a pool in
   a module-level singleton. If a test imports `config.settings`
   before the override is set, it gets the dev URL forever. Two
   workable patterns:
   - Set `DATABASE_URL` in the pytest environment *before*
     `pydantic-settings` instantiates `Settings` (env var wins).
   - Or: read `database_url` lazily in `database.get_pool()` from a
     fresh `Settings()` so the test fixture can rewrite env and
     re-init the pool. The first option is simpler and is the
     recommended path.

4. **Migrations must run against the test DB before the first test.**
   Either a session-scoped pytest fixture runs
   `alembic upgrade head` once, or the Makefile target runs it
   ahead of `pytest`. Match the existing `migrate` recipe so there's
   one source of truth.

5. **`make seed-dev-user` must continue to touch only the dev DB.**
   Today the seed script reads `settings.database_url`. After this
   plan, the dev URL stays the default; only the test process gets
   the override. Verify by running `make test && make seed-dev-user`
   and confirming the dev user survives.

6. **`make db-reset` semantics need to clarify which DB.** The
   current recipe `docker compose down -v && up -d db` blows away
   the volume — both DBs go with it. That's acceptable; add a note
   in the help text. A future refinement could add
   `make db-reset-dev` / `make db-reset-test` recipes that
   `DROP DATABASE ... ; CREATE DATABASE ...` one at a time, but it's
   out of scope here.

7. **CI / hosted environments are unaffected.** The override only
   activates when `pytest` runs. Render / Render-style deploys set
   `DATABASE_URL` explicitly and never invoke `pytest` against the
   production DB.

## 3. Acceptance criteria

1. `make test-backend` truncates only rows in
   `ph_navigator_v2_test`. The dev database
   (`ph_navigator_v2`) is untouched.
2. After `make seed-dev-user && make test-backend`, signing in at
   `http://localhost:5173` as `ed@example.com` / `password` still
   works — the seeded user is still present.
3. After the same sequence, any project the developer created in the
   dev DB is still listed in `GET /api/v1/projects`.
4. The test suite still passes (no regression in
   `tests/test_table_views.py`, `tests/test_projects.py`, etc.).
5. Running the suite a second time without re-seeding still works
   — fixtures truncate the test DB, not the dev DB.
6. `psql ph_navigator_v2 -c "\dt"` after a test run shows non-zero
   rows in `users`, `projects`, `user_table_views` (whatever the dev
   was using).
7. `psql ph_navigator_v2_test -c "\dt"` after a test run shows empty
   tables (last test's truncation).

## 4. Target architecture

### 4.1 Create the test DB

One-time. Either:
- Add an `init.sql` to the Postgres container's
  `/docker-entrypoint-initdb.d/` so a fresh volume gets both DBs
  automatically.
- Or: a Make recipe `db-create-test` that runs
  `CREATE DATABASE ph_navigator_v2_test OWNER phn` once.

Recommended: both. The init script handles fresh-clone setup; the
Make recipe handles existing developers whose Postgres volume
already exists.

### 4.2 Pytest override

In `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
env = [
  "DATABASE_URL=postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test",
]
```

(Requires `pytest-env`, or use a `conftest.py` `os.environ` write
*before* `from config import settings`.)

Belt-and-braces: a session-scoped `autouse` fixture in
`backend/tests/conftest.py` asserts the URL ends in `_test`. If a
developer ever runs pytest with `DATABASE_URL` pointed at dev, the
suite refuses to start:

```python
@pytest.fixture(scope="session", autouse=True)
def _refuse_to_truncate_dev_db() -> None:
    from config import settings
    if not settings.database_url.endswith("/ph_navigator_v2_test"):
        raise RuntimeError(
            f"Refusing to run tests against {settings.database_url}. "
            "Tests TRUNCATE — they must run against the *_test database."
        )
```

This is the actual safety net. Even if a future contributor unwires
the override, the suite fails loud instead of silently nuking dev
data.

### 4.3 Migrations for the test DB

Add a Make target / pytest fixture that runs `alembic upgrade head`
against the test DB before the first test of each session. Idempotent;
fast (typically <200 ms after the first migration).

### 4.4 Makefile cleanup

- `test-backend` depends on a new `db-migrate-test` recipe that runs
  Alembic against the test URL.
- `db-reset` keeps current behavior (blow away the volume — both DBs
  go).
- `db-create-test` is idempotent: `CREATE DATABASE ... IF NOT EXISTS`
  via a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_database THEN
  NULL; END $$;` block.

## 5. Test plan

- Run `make seed-dev-user` → confirm `ed@example.com` in
  `ph_navigator_v2.users`.
- Create a project through the UI.
- Run `make test-backend` (full suite, including the new
  `test_table_views.py`).
- Re-query `ph_navigator_v2.users` — `ed@example.com` still present.
- Re-query `ph_navigator_v2.projects` — the project still present.
- Re-query `ph_navigator_v2_test.users` — empty (last truncate).
- Sign in via the UI without re-seeding — works.
- Bonus: temporarily comment out the override and run pytest →
  confirm the safety-net fixture raises with "Refusing to run tests
  against …".

## 6. Execution order

Single PR — there's no value in splitting:

1. Add `db-create-test` Make recipe; create the test DB.
2. Add the pytest override (`pyproject.toml` + safety-net fixture).
3. Run the suite. Confirm green.
4. Run `make seed-dev-user`. Create a test project. Run
   `make test-backend`. Verify the dev rows survive.
5. Update `context/ENVIRONMENT.md` to mention the two databases and
   document the safety net.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Developer's pre-existing Postgres volume doesn't have the test DB. | `make db-create-test` is idempotent; document it in setup. |
| Override gets removed/wrong path in a refactor. | Safety-net fixture refuses to run against any URL that doesn't end in `_test`. |
| CI URL accidentally ends in `_test` for the wrong reason. | The safety net is fine with that — CI never seeds dev data. |
| Test DB drift from dev DB schema. | Both run the same Alembic migrations. The migration step in `test-backend` is mandatory. |
| Hosted/production env (Render) misreads the override. | The override is in `backend/pyproject.toml` `[tool.pytest]` only — Render doesn't run pytest at boot. |

## 8. Effort estimate

~1 hour. Mostly Make + a fixture + a `pyproject.toml` snippet.

## 9. Commit plan

1. `chore(test-db): create separate ph_navigator_v2_test database`
2. `chore(test-db): point pytest at the test database with safety net`
3. `docs(env): document two-database dev setup`
