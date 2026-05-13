---
DATE: 2026-05-12
STATUS: CANONICAL TECHNICAL REQUIREMENTS — extracted from context/PRD.md to keep startup context small.
RELATED: context/PRD.md §12–§14, context/TECH_STACK.md, context/ENVIRONMENT.md
---

# PH-Navigator V2 — Stack / Auth / Migration Requirements

This file preserves implementation-level requirements that were formerly
embedded in `context/PRD.md`. Load it on demand when touching this surface;
do not make it part of default startup context.

## 12. Stack & deployment

| Layer | Choice |
|---|---|
| Backend language | Python 3.11+ |
| Backend framework | FastAPI |
| DB access | Raw parameterized SQL via `psycopg` v3 repositories; no ORM entity layer |
| DB / migrations | Postgres 16 + Alembic manual migrations |
| Validation | Pydantic v2 |
| Object storage | Cloudflare R2 |
| Frontend build | **Vite** (V1's CRA / `react-scripts` is dead-end) |
| Frontend framework | TypeScript, React 19 |
| Frontend UI kit | **shadcn/ui + Tailwind** (catalog POC outcome — drop V1's MUI) |
| Frontend table | TanStack Table + shadcn-table |
| Frontend state | **Zustand** for client/UI state (drop nested-context pattern) |
| Frontend data | TanStack Query for server state |
| 3D viewer | **`three` + `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`** |
| JSON-Patch | `fast-json-patch` (frontend) + `jsonpatch` (backend) |
| Units conversion (frontend only) | Quantity-specific TS helpers under `frontend/src/lib/units/`; V1 unit/dimension files are research templates (§11.5.3) |
| Auth | Session auth (cookies) for editors; public read access on normal project URLs |
| Hosting | Render.com (backend service, managed Postgres, frontend static site) |
| Local dev | Docker Compose (Postgres + backend + frontend dev server) |
| MCP transport | Streamable HTTP at `/mcp` + stdio via `PHN_MCP_TOKEN`; legacy SSE deferred until a concrete client needs it |
| Testing | pytest (backend), Playwright (E2E), Vitest (frontend unit) |

### 12.1 Persistence pattern — raw SQL + Pydantic

**Decision confirmed 2026-05-11:** V2 uses a Raw+DC-inspired
persistence pattern adapted to PHN's Pydantic-heavy backend:
repository modules issue raw parameterized SQL through `psycopg` v3,
then map rows into Pydantic models or simple scalars at the data-access
boundary. There is no SQLAlchemy ORM entity layer and no SQLAlchemy
Core query-composition layer in application code.

Why this fits PHN-V2:
- The authoritative project model is already a Pydantic-validated JSON
  document, not a graph of mutable ORM entities.
- Raw SQL keeps JSONB, locking, ETag, and migration boundaries explicit.
- Pydantic remains the typed contract for API payloads, project
  documents, table slices, catalog rows, repository returns, and MCP
  results.
- Plain SQL is easier for LLM-assisted maintenance than a specialized
  ORM abstraction, provided every query is parameterized and tested.

Hard rules:
- Repository functions own SQL strings and accept primitive IDs or typed
  request objects.
- All SQL with user input is parameterized. No f-string or concatenated
  SQL with user-controlled values.
- Repository functions return Pydantic models, typed row DTOs, or
  scalars. Raw driver rows do not leak into services/routes.
- Services own workflow invariants and transaction boundaries for
  multi-step operations such as draft patch, Save, Save As, catalog
  refresh, and asset attach.
- Alembic remains the schema-migration tool, but migrations are manual.
  There is no ORM metadata target and no autogenerate from models.

V2 explicitly drops from V1's stack: CRA / `react-scripts`, MUI / MUI-X
DataGrid, AG Grid, react-flip-toolkit, html2canvas / html2pdf / jspdf
(replaced by server-side PDF if/when needed). These were V1
accumulations; standardizing the V2 stack keeps the surface coherent.

### 12.2 Folder / repo layout

V2 lives in a brand-new sibling folder to V1 — fresh start, no shared
code:

```
00_PH_Tools/
├── ph-navigator/             ← V1 (existing, unchanged, kept running)
└── ph-navigator-v2/          ← V2 (new) — this PRD's scope
    ├── backend/
    │   ├── features/
    │   │   ├── project/
    │   │   │   ├── document/      Pydantic models per schema_version
    │   │   │   │   ├── v1.py
    │   │   │   │   └── migrations/
    │   │   │   ├── routes.py
    │   │   │   ├── service.py
    │   │   │   ├── draft.py
    │   │   │   └── diff.py
    │   │   ├── catalog/
    │   │   ├── mcp/
    │   │   └── auth/
    │   ├── alembic/
    │   ├── tests/
    │   │   └── document_schema/fixtures/    golden-file corpus (§10.5)
    │   └── pyproject.toml
    ├── frontend/
    │   ├── src/
    │   │   ├── features/
    │   │   │   ├── project_workspace/
    │   │   │   ├── catalog_manager/
    │   │   │   ├── viewer_3d/                 R3F viewer
    │   │   │   └── public_view/
    │   │   ├── components/                    shadcn primitives
    │   │   ├── stores/                        Zustand
    │   │   └── lib/
    │   ├── package.json
    │   └── vite.config.ts
    ├── context/                                LLM-targeted docs (§10.4)
    ├── docs/
    │   ├── features/
    │   └── plans/
    ├── docker-compose.yml
    ├── README.md
    └── CLAUDE.md
```

**Repo question:** separate Git repo (`bldgtyp/ph-navigator-v2`) or
sibling folder under one repo? Lean: **separate Git repo.** Reasons:
clean commit history, independent CI, independent deploy pipeline,
clean cutover (archive V1 repo when sunset), no risk of V1 changes
contaminating V2 history. Cost: two repos during the parallel period;
minor.

V2 develops in isolation. Cutover happens project-by-project as Ed
manually imports each (§14). V1 stays running until the last
AirTable-bound project is migrated.

## 13. Auth

- **Editor login** — email + password. Server-side sessions stored in
  Postgres (`sessions` table, §6.1). HTTP-only, Secure cookies
  referencing the session row. `SESSION_COOKIE_SAMESITE` defaults to
  `lax`; split-origin staging deployments use `none`.
- **Password hashing** — Argon2id is the planned default, with memory,
  time, and parallelism parameters exposed in backend Settings and
  tested in the auth scaffold. If Argon2id causes installation friction
  during Phase 0, bcrypt with cost >= 12 is the only accepted fallback.
- **Browser request protection** — all mutating browser requests require
  an allowed `Origin` header. Allowed origins are the exact production
  frontend origin plus local dev origins; no wildcard credentialed CORS.
  SameSite cookies are defense-in-depth, not the whole CSRF policy.
- **CORS** — deny by default. Credentialed requests are allowed only
  from configured frontend origins. Public read endpoints are still
  ordinary API routes; CORS does not use `*` with credentials.
- **Session lifetime** — 60-minute sliding expiration. Every
  authenticated request resets the expiry. Idle 60 min → session
  invalidated; client receives 401 on next request. Dirty editor tabs may
  send a lightweight keepalive while unsaved local state exists.
- **Single active session per user.** Signing in creates a new
  session and invalidates any existing sessions for the same user
  (most-recent-wins). The superseded session's row is marked
  `invalidated_at` and tagged with reason
  `superseded_by_new_login`. A partial unique index on
  `sessions(user_id) WHERE invalidated_at IS NULL` enforces the rule in
  the database. The displaced device sees 401 on next request.
- **Mid-edit session expiry** — frontend retains the in-memory
  document, opens a sign-in-again modal in place, retries the
  failed request on success. Server-side draft (§8.3) holds
  everything synced before idle, so data loss is bounded by the
  draft debounce window (~500ms).
- **Password reset** — admin-only via CLI / admin script; no
  self-serve forgot-password flow in v1. Two-person internal scope.
- **Account creation** — admin-only. No public sign-up.
- **Viewer access** — no token, no session required.
  Project URLs (`/projects/{id}/...`) resolve for any visitor; the
  backend's `require_project_access(mode='view')` dependency
  passes trivially. Writes return 401. See §4 for the full access
  model.
- **MCP auth** — project-scoped bearer tokens stored in
  `mcp_tokens` (§6.1). Issued by logged-in editors from Project
  Settings, shown once, stored hashed, revocable, and audit-logged.
  v1 tokens can carry `project:read`, `project:write`, `asset:read`,
  and `asset:write` scopes. Write-capable tokens also include
  `project:read`; write-only project tokens are rejected. Public browser
  read access does not create anonymous MCP access.

No anonymous editor auth. No per-table or per-version permissions
in v1.

### 13.0a TB-01 implementation snapshot (2026-05-12)

The first auth slice implemented the server-side editor session
boundary and empty-dashboard guard with these concrete names and
settings:

- Migration: `backend/alembic/versions/20260512_0002_auth_sessions.py`.
- Tables: `users`, `sessions`, `user_action_log`.
- DB helpers: `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `uq_users_email_lower`, and partial unique index
  `uq_sessions_one_active_per_user` on
  `sessions(user_id) WHERE invalidated_at IS NULL`.
- Cookie: `phn_session`; `HttpOnly`, `Path=/`;
  `SESSION_COOKIE_SAMESITE=lax` by default; `Secure` is disabled only
  for `development`, `test`, and `local`.
- Settings: `SESSION_LIFETIME_MINUTES=60`,
  `PASSWORD_ARGON2_TIME_COST=3`,
  `PASSWORD_ARGON2_MEMORY_COST=65536`,
  `PASSWORD_ARGON2_PARALLELISM=4`.
- Local seed: `make seed-dev-user` creates `ed@example.com` /
  `password`; `backend/scripts/seed_user.py` refuses non-local
  environments.
- Login race handling: password verification happens before the write
  transaction; login then locks the user row while invalidating old
  sessions and creating the new one. Unknown-email attempts verify a
  fixed valid dummy Argon2 hash so they do not short-circuit.
- Request protection: `X-Request-ID` is accepted/generated and returned
  on responses/errors; mutating browser requests under `/api/` require
  an allowed `Origin`.

Implementation lessons / deferred owners:

- The frontend guard is intentionally route-level for TB-01. The
  in-place session-expiry/device-collision modal is still required
  before editable project state ships.
- `FERNET_SECRET_KEY` is future at-rest field encryption only. Sessions
  are opaque DB row pointers; there is no signed session payload cookie.
- `client_ip` currently comes from `request.client.host`; TB-02 staging
  must decide trusted proxy-header parsing for Render.
- JSON application logs are not wired yet; TB-02 owns staging/ops
  logging with `request_id` and available user/project/version context.
- `/auth/session` still locks/touches the session row on every
  authenticated request. TB-06 should revisit this under same-editor
  multi-tab traffic.
- `require_project_access(project_id, mode)` lands with the first
  project-scoped routes in TB-02.

### 13.1 Phase 0 security / ops baseline

The scaffold baseline is split between the implemented TB-00/TB-01
surface and the next ops/project slices.

- `/api/v1/health` for liveness and `/api/v1/version` for build/API
  metadata.
- A request-id middleware. `X-Request-ID` is accepted from the frontend
  when present, otherwise generated by the backend. Every response and
  structured error includes the request id.
- A single backend structured-error module shared by REST and MCP error
  wrappers, starting with the minimal §10.3 envelope.
- Auth/session migrations covering Argon2id hashes, UUIDv4 sessions, and
  the single-active-session partial unique index.

Still owed:

- JSON application logs with `request_id`, `user_id`, `project_id`, and
  `version_id` when available. Owner: TB-02 staging/ops wiring.
- Idempotency-key handling with the §9.5 scope, TTL, and replay
  semantics. Owner: the first idempotent mutating project/draft write
  slice, currently TB-04/TB-05.

## 14. Migration from V1

V2 has no AirTable connection and no automatic migration from V1.
Approach:

1. **V1 keeps running** in production for any project still actively
   using AirTable connectivity.
2. **Per-project manual migration:** for each V1 project Ed wants to
   move to V2, build a one-shot import script that reads the V1
   relational tree and writes a V2 project document. Run, verify, mark
   the V1 project archived.
3. **No compatibility layer** between V1 and V2 routes. They share auth
   (same `users` table) but nothing else.
4. **Eventual sunset of V1** once all live projects are on V2. Schedule
   TBD; not in scope for V2 v1.

### 14.1 Import script — sketch

`ph-navigator-v2/backend/scripts/import_from_v1.py <v1_project_id> [--dry-run]`:

- Read V1 `Project`, `Assembly`, `Layer`, `Segment`, `Material`,
  `Aperture`, `ApertureElement`, `Frame`, `Glazing`,
  `ProjectManufacturerFilter`.
- Construct a V2 `ProjectDocumentV1`. For each Material/Frame/Glazing
  reference, copy values into the document and stamp `catalog_origin`
  pointing at the V1-derived catalog (or new V2 catalog after Ed seeds
  it).
- Write a new V2 project + initial "Imported from V1" version.
- Photos and datasheets — keep V1 object-storage URLs as-is (R2 bucket
  shared between V1 and V2).
- **Steel-stud HBJSON delta (per Q-ENV-4 / §10.4 glossary).** Any
  V1 project that has steel-stud assemblies with HBJSON exports done
  under V1's exporter (`backend/features/assembly/services/
  to_hbe_material_steel_stud.py`, V1 ref §13.5) carries
  surface-film resistances (`R_SE=0.17, R_SI=0.68 hr·ft²·°F/BTU`)
  baked into the AISI S250-21 cavity-equivalent conductivity. V2's
  exporter drops those constants and uses `R_SE=0, R_SI=0` (matching
  V1's live R-value calc and Honeybee's convention) so films enter
  the calc **once**, at the construction boundary, when downstream
  consumers add them. **Expected delta after re-import:** V2 HBJSON
  exports of the same steel-stud assembly will have slightly
  different per-cavity equivalent conductivities than V1 exports.
  After re-export + downstream `u_factor` re-computation, the V2
  result is the correct one. The import script logs a one-line
  warning per steel-stud assembly migrated so the team can spot-check.
