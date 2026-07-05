# Phase 01 — GH Router Foundation (backend)

```
DATE:    2026-07-05
TIME:    13:30
STATUS:  ✅ Complete (implemented 2026-07-05; feature/gh-data-api)
AUTHOR:  Claude (with Ed)
SCOPE:   bt_number unique index; new `features/gh_api/` feature; access
         dependency (anon + optional bearer); version resolution; response
         envelope; resolver/metadata route; rate limiting.
RELATED: ../PRD.md §3–§5, ../PLAN.md, ../research.md §3.3, §5
```

## Goal

A registered, tested `/api/v1/gh/projects/{bt_number}` router that resolves
bt_number → project → version and returns the common envelope, with the
three-tier access dependency. No data payloads yet beyond the resolver
route — Phases 2–3 plug their handlers into this foundation.

## Preconditions / read first

- `backend/.instructions.md` → `context/CODING_STANDARDS.md` (feature layers
  `routes`/`models`/`service`/`repository`; strict typing `ty`; raw
  parameterized SQL, no ORM).
- `../PRD.md` §4.1 (envelope), §5 (access posture).
- Run from `backend/` with `uv` only.

## Requirements

### R1 — bt_number partial unique index (Alembic)

- New migration: unique index on `projects.bt_number` for non-deleted rows
  (partial: `WHERE <soft-delete column> IS NULL` — verify the exact column
  name in `alembic/versions/20260624_0001_baseline.py`; the projects table
  has `deleted_*` columns).
- Before creating the index, the migration must fail loudly (or the plan
  must document a pre-check) if duplicates exist. Production DB is
  essentially empty (2026-07), so this is expected to be a no-op.
- Check whether project-create/update normalizes bt_number (trim). If not,
  add trim-on-write in the existing projects service — do NOT change case
  behavior (bt_numbers are numeric-ish strings like "2524").
- The existing `GET /api/v1/projects/check-bt-number` availability check
  (`features/projects/routes.py:82`) stays the app-level guard; the index is
  the invariant.

### R2 — feature skeleton `backend/features/gh_api/`

- `routes.py` (GET-only router, prefix `/api/v1/gh/projects/{bt_number}`),
  `models.py` (envelope + route response models), `service.py`,
  `repository.py`. Register in `backend/main.py` alongside the other
  routers (mounted ~lines 80–104).
- Repository needs `get_project_by_bt_number(conn, bt_number)` — raw
  parameterized SQL against `projects`, excluding soft-deleted rows.
  Model on `features/projects/repository.py` (project row SELECTs at
  lines 17–72).

### R3 — access dependency (the one new auth mechanism)

Resolution order, scoped to this router only:

1. Session cookie (existing `current_user_from_request`,
   `features/auth/service.py:197`) → normal `ProjectAccess`.
2. Else `Authorization: Bearer phn_mcp_...` →
   `authenticate_plaintext_token` (`features/mcp/service.py:122`) +
   `project_access_for_token` (`service.py:149`). MUST enforce
   `token.project_id == resolved project id` (403 on mismatch — mirror
   `require_token_scope`, `service.py:140`) and `project:read` scope.
   Invalid/expired/revoked token → 401 (do NOT silently fall through to
   anonymous — a client that sent a token wants to know it's bad).
3. Else anonymous viewer (same posture as
   `require_project_view_access`, `features/projects/access.py:116`).

- Decision D1 (PRD §3): all three tiers may read every GH route. Do NOT
  touch `features/access/capabilities.py` sets — the GH router authorizes
  locally. Add a code comment noting the future per-project privacy flag
  hangs off this dependency.
- Never log tokens (see `context/LOGGING.md`).

### R4 — version resolution helper

- `?version=<uuid>` → must be a **saved** version belonging to this project
  (404 otherwise). Omitted → `projects.active_version_id`. Project with no
  saved versions → 404 with actionable detail ("project has no saved
  versions — save the project in PH-Navigator first").
- Never read drafts (D3).
- Reuse `list_versions_for_project` (`features/projects/repository.py:258`)
  and the version-row fetch used by the document routes.

### R5 — envelope + resolver route

- Envelope (PRD §4.1): `schema_version: Literal[1]`, `project {bt_number,
  project_id, name}`, `version_id`, `last_modified` (version save timestamp,
  UTC ISO-8601 `Z`, byte-stable per version — this is the Rhino
  change-detection contract).
- `GET /api/v1/gh/projects/{bt_number}` → envelope + `versions: [...]`
  (id, saved_at, plus label/notes if the versions table has them — check the
  row shape from `list_versions_for_project`). Newest first.

### R6 — rate limiting

- **V2 currently has NO rate limiter** (verified 2026-07-05: no slowapi, no
  limiter middleware). Add a minimal per-IP limiter applied to the GH
  router only. Recommendation: `slowapi` (V1 precedent) or a small
  in-process token bucket; either way the limit is a `Settings` field (no
  `.env` overlays), default ~30/minute per IP, disabled in tests.
- Keep it deliberately minimal — single Render instance, in-process state
  is fine. Do not build distributed rate limiting.

## Out of scope

Data payload routes (Phases 2–3); per-project privacy flag; MCP changes;
frontend changes.

## Testing

- Migration: duplicate-bt_number insert fails; soft-deleted duplicate does
  not block.
- Resolver route: 200 envelope shape (exact keys); unknown bt_number → 404;
  version list ordering.
- Version helper: default = active; pinned = that version; foreign/unknown
  version id → 404; draft-only project → 404.
- Auth matrix: anon 200; valid bearer (right project) 200; valid bearer
  wrong project 403; malformed/expired/revoked bearer 401; session cookie
  200. Token issuance for tests via `features/mcp/service.py::issue_token`.
- Rate limiter: over-limit → 429 (and disabled-flag path for the rest of
  the suite).
- `ty` clean; follow existing test layout under `backend/tests/`.

## Acceptance gate

`make ci` green; `curl` smoke of the resolver route against the local dev
stack (anonymous + bearer). Closeout gate per repo CLAUDE.md (simplify,
docs-pass, `make format`, `make ci`).

## Risks / notes for the implementing agent

- The single-active-session rule and seeded-data ownership: local smoke as
  `codex@example.com` won't own the seed project — anonymous GET is the
  primary path anyway.
- bt_number appears in logs freely (it is not a secret); tokens never.
- Keep handler bodies thin — resolution + envelope live in `service.py` so
  Phases 2–3 reuse them as dependencies.
