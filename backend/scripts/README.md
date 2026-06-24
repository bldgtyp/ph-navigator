# `backend/scripts/` — one-shot utilities

CLI tools that don't belong in the request/response surface. Examples
(added as needed):

- seed loaders that populate dev data
- one-time data migrations distinct from Alembic schema migrations
- adapters for importing from external sources

Run any script with `cd backend && uv run python scripts/<name>.py`.

For repeatable local browser/UI inspection, prefer the Make wrapper:

```bash
make seed-agent-browser
```

It creates or repairs the `codex@example.com` login plus the `AGENT-BROWSER`
project with a dirty draft, then prints both a clean-profile sign-in route and
the direct `localhost:5173` project route.
