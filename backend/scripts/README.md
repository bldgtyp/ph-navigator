# `backend/scripts/` — one-shot utilities

CLI tools that don't belong in the request/response surface. Examples
(added as needed):

- seed loaders that populate dev data
- one-time data migrations distinct from Alembic schema migrations
- adapters for importing from external sources

Run any script with `cd backend && uv run python scripts/<name>.py`.

For repeatable local browser/UI inspection, use the self-healing Make wrapper:

```bash
make agent-browser-ready
```

It starts or reuses the strict local backend/frontend services, validates their
application-specific health markers and Vite's same-origin `/api` proxy, then
creates or reuses a task-isolated login and `AGENT-BROWSER-*` project with a
dirty draft. `CODEX_THREAD_ID` provides automatic isolation;
`PHN_AGENT_BROWSER_ID` is the explicit override for other runtimes. The command
prints the credentials, a clean-profile sign-in route, and the direct
`localhost:5173` project route. Use `make agent-browser-check` for a read-only
readiness check. If a browser tab has already shown a network error, discard it
and open the printed sign-in route in a fresh tab.

For frontend performance sweeps, seed the non-destructive stress fixture:

```bash
make seed-perf-stress
```

It creates or repairs the `codex@example.com` login plus the `PERF-STRESS`
project, then prints the `PERF_PROJECT_ID` needed by `make e2e-perf`.

For the production frontend performance fixture, run the guarded script from
the production API environment only:

```bash
cd backend
uv run python -m scripts.seed_perf_stress_fixture \
  --confirm-production \
  --email codex@testing.com \
  --table-rows 250 \
  --equipment-rows 250
```

The production path refuses non-production app environments, prompts for the
testing-account password if `--password` is omitted, resets the same
`PERF-STRESS` project in place, seeds Climate/Envelope/Apertures data, and does
not print the password.

For project-document schema bump checks:

```bash
cd backend && uv run python scripts/check_project_document_upgrade.py --fixtures --strict
cd backend && uv run python scripts/check_project_document_upgrade.py --fixtures --fielddef-drift --strict
cd backend && uv run python scripts/check_project_document_upgrade.py --db --strict
cd backend && uv run python scripts/check_project_document_upgrade.py --db --fielddef-drift --strict
```
