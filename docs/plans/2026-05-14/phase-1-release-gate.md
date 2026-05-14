---
DATE: 2026-05-14
STATUS: P1-13 complete; HITL final acceptance approved by Ed on 2026-05-14.
SCOPE: Phase 1 hardening, requirements traceability, and release-gate evidence.
RELATED:
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md
  - docs/plans/2026-05-13/phase-1-full-buildout-plan.md
  - docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md
  - context/ENVIRONMENT.md
---

# Phase 1 Release Gate

## Current Decision

Phase 1 is locally and staging release-gate clean after P1-13 MCP
transport-security hardening. Ed approved P1-13 as complete on 2026-05-14.

## P1-13 Change

The active-token staging MCP read blocker was traced to FastMCP's
DNS-rebinding transport guard: unauthenticated requests stopped at auth with
`401`, while authenticated requests reached host validation and returned
`421 Invalid Host header`.

The backend now owns MCP transport-security config explicitly:

- `MCP_ENABLE_DNS_REBINDING_PROTECTION`
- `MCP_ALLOWED_HOSTS`
- `MCP_ALLOWED_ORIGINS`

Allowed hosts and wildcard-port variants are derived from `MCP_ISSUER_URL`,
`MCP_RESOURCE_SERVER_URL`, and Render's `RENDER_EXTERNAL_URL` /
`RENDER_EXTERNAL_HOSTNAME`; allowed origins are derived from the MCP URLs plus
`CORS_ORIGINS`. Local `localhost`/`127.0.0.1` hosts stay enabled for dev, and
deployed extras can be set explicitly.

## Local Verification

| Check | Result | Evidence |
|---|---|---|
| `make db-up` | Pass | Local Postgres container running. |
| `make migrate` | Pass | Alembic at head. |
| `cd backend && uv run pytest tests/test_mcp.py -q` | Pass | `6 passed`; includes deployed-host MCP allowlist coverage. |
| `make lint` | Pass | Backend `ruff check .`; frontend `eslint .`. |
| `make typecheck` | Pass | Backend `ty check`. |
| `git diff --check` | Pass | No whitespace errors. |
| `make test` | Pass | Backend `64 passed`; frontend `62 passed`. |
| `cd frontend && npm run format:check` | Pass | Prettier check passed. |
| `cd frontend && npm run build` | Pass | Vite build passed; existing chunk-size warning remains. |
| `make seed-dev-user` | Pass | Local `ed@example.com` reset after tests. |
| `make e2e` | Pass | Chromium `2 passed`: editor project/public shell and same-editor Rooms stale-tab freeze. |

## Staging Verification

Rerun across the P1-13 staging deploys on 2026-05-14:

| Check | Result | Evidence |
|---|---|---|
| API health | Pass | `https://ph-navigator-v2.onrender.com/api/v1/health` returned `200`; request id `44000b0d-3cb7-48b4-a811-613c69d0a572`. |
| Unauthenticated session | Pass | `/api/v1/auth/session` returned structured `401 not_authenticated`; request id `fb95c3e1-891d-4f2e-ac5f-97c4ce7a9667`. |
| CLI browser e2e | Pass | `cd frontend && E2E_BASE_URL=https://ph-navigator-v2-staging.onrender.com npm run test:e2e` returned Chromium `2 passed`. |
| Settings/token UI | Pass | Browser script signed in, created a project, patched metadata through Project Settings, issued an active MCP token, issued and revoked a second token, and confirmed public Viewer has no Project Settings button. |
| Second-deploy health/session | Pass | Health `200` request id `c2fc67a3-d51a-477e-b46a-71cefa097cd5`; unauthenticated session structured `401 not_authenticated` request id `0781f025-05c5-43ba-b53f-1054013d3645`. |
| Second-deploy active-token MCP read | Blocked, then fixed | Token issue succeeded with request id `aec1a039-10c1-43c4-8b81-35fe389f2d39`, but MCP read still returned `421`; Render logs showed `Invalid Host header: ph-navigator-v2.onrender.com`, so the follow-up derived MCP host allowlist entries from Render's built-in external URL/hostname env values. |
| Third-deploy health/session | Pass | Health `200` request id `0fcea900-b949-4e8e-b786-24fbbadc4e39`; unauthenticated session structured `401 not_authenticated` request id `f1f2dc25-2dbb-4678-b129-03e9e9a0423f`. |
| Third-deploy active-token MCP read | Pass | Login `200` request id `ac1ca526-0d3f-4c48-8fb6-38f8f0e372c5`; project create `201` request id `9862e168-e091-4951-afc0-4fd20a3d8738`; token issue `201` request id `67f9460a-effa-4c8b-9406-c9edf47d127e`; MCP smoke passed `list_projects`, `get_project`, `list_versions`, `list_status_items`, `get_document`, and `get_table` against project `544faa6d-ff90-409b-897b-7a87c7198a62`; test token revoked with request id `95eae472-a5eb-4b63-b7ba-15df717c9aba`. |

## Requirements Matrix

| Area | Phase 1 status | Evidence / owner |
|---|---|---|
| TB-06 staging evidence | Complete for Phase 1 gate | P1-13 staging verification above. |
| Project-document boundaries | Complete | P1-01 ledger. |
| Table-neutral header/version chrome | Complete | P1-02 ledger. |
| Read-safe recovery | Complete for MVP contract | P1-03 ledger; raw JSON recovery, typed editing fails closed. |
| BLDGTYP design system | Complete for Phase 1 surfaces | P1-04 ledger. |
| Dashboard/project shell | Complete for Phase 1 | P1-05 ledger; pin/reorder deferred. |
| Status | Complete for Phase 1 | P1-06 ledger. |
| Project Settings and MCP token admin | Complete for UI/admin | P1-07 ledger. |
| Active-token MCP read transport | Complete | Third-deploy MCP smoke above. |
| Shared DataTable | Complete for Rooms path | P1-08 ledger. |
| Single-select option behavior | Complete for Rooms path | P1-09 ledger; polish deferred to TB-20. |
| Rooms MVP | Complete for Phase 1 | P1-10 ledger; visible filter/search deferred to TB-20. |
| Draft/version/concurrency UX | Complete for Phase 1 | P1-11 ledger; MCP edit leases deferred to TB-17. |
| Diff/download/schema/OpenAPI baseline | Complete | P1-12 ledger. |
| Action logging | Sufficient for Phase 1 touched flows | Auth/project/version/status/MCP token actions covered by existing tests and ledgers. |
| Later table/equipment/model/catalog scope | Deferred by design | TB-07+, TB-17, TB-18, TB-20, and later roadmap slices. |

## Staging Smoke Before HITL Acceptance

After deploy, run the full Phase 1 staging smoke:

1. Confirm `/api/v1/health` and unauthenticated `/api/v1/auth/session`
   return structured responses with request IDs.
2. Sign in as seeded editor from
   `https://ph-navigator-v2-staging.onrender.com`.
3. Create/open a project and verify dashboard, breadcrumbs, project shell, and
   Status.
4. Open Project Settings, edit metadata, issue an MCP token, revoke one token,
   and verify Viewer cannot open Settings.
5. Use a fresh active MCP token against `https://ph-navigator-v2.onrender.com/mcp/`
   and verify `list_projects`, `get_project`, `list_status_items`,
   `get_document`, and `get_table`.
6. Exercise Rooms table add/edit/sort/copy, Save, Save As, Discard, Lock, public
   Viewer read-only mode, Project JSON download, Rooms JSON download, and diff.
7. Confirm recovery mode still preserves raw Project JSON download for an
   unsupported saved body, or explicitly accept recovery-mode coverage as local
   evidence only for this gate.

## Remaining Post-MVP Owners

| Follow-up | Owner slice |
|---|---|
| MCP write tools and browser/MCP edit leases | TB-17 |
| Catalog build-out | TB-07+ |
| Windows / Envelope / Model | Later Phase 3+ slices |
| Equipment ERV/Fan/Pump/Thermal Bridge tables | TB-18 / Phase 6 |
| DataTable filter/search controls and mutation-hardening polish | TB-20 |
| Dashboard pin/reorder persistence | Later user-preference slice |
| Production recovery polish, schema shims, and golden schema corpus | Later schema hardening |
