# `backend/scripts/` — one-shot utilities

CLI tools that don't belong in the request/response surface. Examples
(added as needed):

- seed loaders that populate dev data
- one-time data migrations distinct from Alembic schema migrations
- adapters for importing from external sources

Run any script with `cd backend && uv run python scripts/<name>.py`.
