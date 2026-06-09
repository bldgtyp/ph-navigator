# Backend — PH-Navigator V2

FastAPI service for versioned project documents. Currently a scaffold —
real route surface lands during feature work (see `context/USER_STORIES.md`
and the relevant `context/user-stories/*.md` file).

## Run

```bash
cd backend
uv sync                            # first time / when uv.lock changes
uv run uvicorn main:app --reload   # dev server on :8000
uv run ty check                    # static types
uv run ruff check .                # lint
uv run pytest                      # tests
```

Or from the repo root: `make backend`, `make typecheck`, `make test-backend`.

## Layout

- `main.py` — FastAPI app + middleware
- `config.py` — Pydantic Settings (the only `os.getenv` surface)
- `database.py` — raw psycopg connection pool helpers
- `alembic/` — Alembic migrations (manual revisions; no ORM autogenerate)
- `features/` — per-feature modules (added during build)
- `scripts/` — one-shot utilities
- `tests/` — pytest suite

## Action URLs

Non-CRUD actions use the slash-verb style:
`POST /resource/{id}/verb-phrase` (e.g. `POST /projects/{project_id}/delete`,
`POST /projects/bulk-delete`, `POST /assets/{asset_id}/complete-upload`).
Do not use the Google `:verb` style — every route under `features/` was
unified on slash-verb in the 2026-06-09 hygiene pass.

See `context/ENVIRONMENT.md` for the full env contract and
`context/CODING_STANDARDS.md` for the backend layer, typing, module-size,
documentation, and quality-gate standard.
