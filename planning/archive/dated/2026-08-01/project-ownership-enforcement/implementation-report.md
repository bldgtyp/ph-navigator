---
DATE: 2026-08-01
TIME: 09:44 EDT
STATUS: Complete — route sweep verified
AUTHOR: Codex with Ed May
SCOPE: Phase 3 inventory and verification of every project-reachable access path.
RELATED: ./PRD.md, ./STATUS.md, ./phases/phase-03-sweep.md,
  backend/features/projects/access.py,
  backend/tests/test_project_access_ownership.py
---

# Project-ownership enforcement implementation report

## Route verdicts

The planning packet's “18 modules” count was off by one. There are 17
registered project feature modules; `backend/features/projects/access.py` is
the eighteenth seam-reference unit when the shared chokepoint itself is
included. Current OpenAPI exposes 98 `{project_id}` operations plus five
Grasshopper `{bt_number}` project operations, for 103 project-reachable HTTP
operations rather than the packet's stale count of 96.

| Module | Verdict | Evidence / qualification |
| --- | --- | --- |
| `projects` | On-seam | Detail GET/PATCH use `ProjectViewAccess` / `ProjectEditAccess`. Delete, restore, and hard-delete deliberately stay on the stricter owner-only service guard. |
| `project_status` | On-seam | All status-item reads and writes use the shared view/edit dependencies. |
| `sidebar_views` | On-seam | Project-scoped view-state reads and writes use the shared dependencies. |
| `aperture_drift` | On-seam | Drift reporting uses `ProjectViewAccess`. |
| `project_climate_source` | On-seam | Project climate-source reads and writes use the shared dependencies. |
| `aperture_u_value` | On-seam | Project/version calculations and reports use the shared dependencies. |
| `mcp` | On-seam after Phase 3 fix | Token-management routes use `ProjectEditAccess`; bearer read/data tools call `project_access_for_token`, which re-enters `project_access_for_user` as the issuer. Destructive tools retain the stricter issuer/owner service guard. The sweep found and fixed metadata/list tools that previously checked token scope only. |
| `model_viewer` | On-seam | HBJSON list, signed download, model-data, subset, and mutation routes use the shared dependencies. |
| `gh_api` | On-seam | Signed-in requests call `project_access_for_user`; bearer requests call `project_access_for_token`. Anonymous viewer access is intentional and unchanged. |
| `envelope` | On-seam | All project/version assembly reads, exports, imports, and commands use the shared dependencies. |
| `project_location` | On-seam | Project location and sun-path reads/writes use the shared dependencies. |
| `table_views` | On-seam | Project table-view state uses the shared dependencies. |
| `project_document` | On-seam | Saved/draft document, table, diff, export, and mutation routes use the shared dependencies. |
| `heat_pumps` | On-seam | Project/version equipment routes use the shared dependencies. |
| `apertures` | On-seam | Aperture specification reporting uses `ProjectViewAccess`. |
| `assets` | On-seam | Asset CRUD, signed URL, download, bulk URL, and job routes use the shared dependencies. |
| `aperture_hbjson_export` | On-seam | Aperture HBJSON export uses `ProjectViewAccess`. |

No decorated route module accepting `project_id` was found without a shared
project-access dependency. Candidate service/repository/model files are called
only after route access is established or accept an already-built
`ProjectAccess`; they are not alternate HTTP entry points.

## Cross-user probes

`backend/tests/test_project_access_ownership.py` now checks a stranger against
the document body, aperture report, envelope, HBJSON model-data artifact,
asset signed-URL endpoint, and project status. All six return uniform
`404 project_not_found` before downstream data or object-store lookup.

The MCP regression issues a real token while user A owns the project, transfers
ownership to user B, then calls both the actual `get_project` and `get_document`
tool functions. Both re-enter `project_access_for_user` and return the
structured MCP error `project_not_found` with `recoverability: refresh`, proving
the bearer path cannot outlive the issuer's project access.

## Verification

```text
uv run pytest tests/test_project_access_ownership.py -q  # 13 passed
make smoke-mcp-local                                     # pass; inventory + list_projects
make agent-browser-ready                                # pass; :5173/:8000 + proxy + fixture
agent-browser.mjs /projects/<fixture>/apertures          # pass; redirected to builder, UI loaded
```

The browser loaded the task-owned `AGENT-BROWSER-8DBB335008F7` project with
the dirty-draft recovery dialog and app-wide Save Version controls visible.
The helper reported one initial session-check 401 before sign-in, which is the
documented authentication flow; the final authenticated route loaded normally.

## Production pre-deploy gate

No production connection was authorised or used during this implementation.
Before deployment, Ed must run and review:

```sql
SELECT owner_id, count(*)
FROM projects
WHERE deleted_at IS NULL
GROUP BY owner_id;
```

Any ownership reassignment remains an operator decision. The Admin-preset
bridge means the separate one-time `is_staff` update can be deferred without
locking current admins out.
