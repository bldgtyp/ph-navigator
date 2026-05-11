# Backend — PH-Navigator V2

FastAPI service for versioned project documents. Currently a scaffold —
real route surface lands during feature work (see `docs/plans/user-stories.md`).

## Run

```bash
cd backend
uv sync                            # first time / when uv.lock changes
uv run uvicorn main:app --reload   # dev server on :8000
uv run pytest                      # tests
```

Or from the repo root: `make backend`, `make test-backend`.

## Layout

- `main.py` — FastAPI app + middleware
- `config.py` — Pydantic Settings (the only `os.getenv` surface)
- `database.py` — raw psycopg connection pool helpers
- `alembic/` — Alembic migrations (manual revisions; no ORM autogenerate)
- `features/` — per-feature modules (added during build)
- `scripts/` — one-shot utilities
- `tests/` — pytest suite

See `context/environment-setup.md` for the full env contract.
