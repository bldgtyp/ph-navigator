---
DATE: 2026-09-08
TIME: 22:01 EDT
STATUS: In review (verified locally 2026-09-09)
AUTHOR: Codex for Claude
SCOPE: Web implementation and verification handoff
RELATED: README.md, PRD.md, ph-navigator-sketchup shared-material-library phase 04
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/90
---

# Status

Verification outside the build sandbox (Claude, 2026-09-09, local Docker Postgres):
`tests/test_desktop.py` 27 passed (the inactive-user case now deactivates through `deleted_at`,
which is what `is_active` derives from); `tests/test_mcp.py` passed alongside it; the full
backend suite 1,938 passed, 7 skipped, with two `test_error_logging.py` cases failing only
under the parallel runner and passing alone (log capture order, unrelated to this change);
`ruff check`, `ruff format --check` and `ty check` clean. Ready for review; deployment and the
migration on staging and production are Ed's decision.


Implemented, uncommitted on `feature/desktop-catalog-read`: scope validation,
reversible migration, desktop routes/dependency, approval label/copy, backend
and frontend tests, canonical API/token docs. The consumer is **PH-Navigator
for SketchUp**, shared-material-library phase 04 ([README.md](README.md)).

Verification (2026-09-08):

- `make format`: passed using the existing environment and a temporary uv cache.
- Backend Ruff format/lint, Ty, and boundary checker: passed.
- Frontend Prettier, ESLint (18 existing warnings, no errors), structural guards,
  and TypeScript/Vite production build: passed. Vite reports large-chunk warnings.
- `pnpm test`: **287 files / 2,546 tests passed**, including project and catalog
  device approval cases.
- Alembic upgrade/downgrade SQL generation for `20260801_0013` ↔ `20260909_0014`:
  passed. This is not a live migration round trip.
- `make ci`: blocked at Docker access (`permission denied` on the Docker socket).
- `uv run pytest -n 4`: blocked before collection; sandbox denies TCP connections
  to PostgreSQL on localhost:5433 (`Operation not permitted`). The conftest
  bootstraps a dedicated test DB, so all backend tests remain unexecuted here,
  including `tests/test_desktop.py` and its migration round trip.
- Required simplify reviews: no material findings. Docs-pass updated the API,
  token/approval contracts, and this packet. `graphify update .`: passed.

Commands used `UV_CACHE_DIR=/tmp/phn-desktop-uv-cache UV_NO_SYNC=1` for Python
tools because the sandbox blocks the global uv cache. No dependencies or global
configuration were changed. Full command evidence is in the requested handoff
artifact `report.md`.

Next for Claude: review the diff, run the database-backed gates outside this
sandbox, and review the consumer integration. No commit, push, or deployment
was requested. Do not archive this packet until the repository completion
criteria are met.
