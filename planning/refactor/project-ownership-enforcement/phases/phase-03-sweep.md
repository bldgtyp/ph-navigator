---
DATE: 2026-08-01
TIME: 08:25 EDT
STATUS: Planned
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Phase 3 — verify the seam actually covers the whole project surface.
RELATED: ../PRD.md, ../decisions.md, ./phase-02-enforce.md
---

# Phase 3 — Sweep

Phase 2 assumes every project-scoped route goes through the seam. This phase
tests that assumption instead of trusting it. It is the phase most likely to
find something, and the one most likely to get skipped.

## 3.1 Enumerate the surface

18 modules currently reference the seam:

```text
projects  project_status  sidebar_views  aperture_drift  project_climate_source
aperture_u_value  mcp  model_viewer  gh_api  envelope  project_location
table_views  project_document  heat_pumps  apertures  assets
aperture_hbjson_export
```

For each module, produce a one-line verdict in an implementation report:
**on-seam** (uses `ProjectViewAccess` / `ProjectEditAccess` /
`require_project_*_access`) or **off-seam** (takes `project_id` and does its own
auth). Any off-seam route that accepts a `project_id` is a finding.

Useful starting query — routes that take a project id but never mention the
seam:

```bash
grep -rln "project_id" backend/features --include='*.py' \
  | grep -v __pycache__ \
  | xargs grep -Ln "ProjectViewAccess|ProjectEditAccess|require_project_.*_access"
```

Treat the result as a candidate list, not an answer — read each hit.

## 3.2 Cross-user probe across a representative sample

Extend the Phase 1 file with stranger-gets-404 cases against one endpoint from
each of at least six different modules — pick read-heavy ones that would leak
the most:

- `project_document` (the document body — the largest leak)
- `apertures` (table data)
- `envelope` (assembly data)
- `model_viewer` (`/model_data` artifact + signed URLs)
- `assets` (signed object-store URLs — leak crosses into R2)
- `project_status`

`assets` and `model_viewer` deserve particular attention: if they mint signed
URLs, a 404 at the route is the only thing standing between a stranger and a
direct object-store URL that outlives the request.

## 3.3 MCP

```bash
make smoke-mcp-local
```

Then the targeted case: issue a token as user A, call `get_project` /
`get_document` against user B's project, expect refusal. This is PRD criterion 5
and it exercises `project_access_for_user`, not the FastAPI dependency.

## 3.4 Local app regression

```bash
make agent-browser-ready
```

Sign in as `codex@example.com` and confirm the seeded `AGENT-BROWSER` fixture
project still loads end to end. Per
`memory/project_dev_seed_project_owner.md` the main dev seed project is owned by
`ed@example.com` while `codex@example.com` owns none — so **the agent fixture is
exactly the kind of thing this refactor can break**. If `codex` can no longer
open a project it could open before, decide whether the fixture needs to grant
ownership or an admin grant. Do not "fix" it by weakening the seam.

## 3.5 Production owner distribution — Ed's call

Before this deploys:

```sql
SELECT owner_id, count(*) FROM projects WHERE deleted_at IS NULL GROUP BY owner_id;
```

If production projects are owned by an account that is not the person who now
works on them, enforcement locks someone out on deploy. Surface the result to
Ed; any re-assignment is his decision, not an agent's.

## Exit criteria

- Per-module verdict table written; every off-seam finding either fixed or
  explicitly justified.
- Six-module stranger probe green.
- MCP cross-user case green.
- `make agent-browser-ready` + a manual project load succeed.
- Production owner distribution reported to Ed.
