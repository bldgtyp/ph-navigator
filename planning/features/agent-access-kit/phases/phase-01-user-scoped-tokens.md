---
DATE: 2026-08-01
TIME: 08:41 EDT
STATUS: Ready — ownership dependency implemented and verified
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Backend — add the user-scoped agent-token principal to the MCP surface.
RELATED: ../PRD.md §2, ../decisions.md §D-1/D-2/D-6,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/PRD.md,
  backend/features/mcp/, context/mcp.md
---

# Phase 01 — User-scoped agent tokens

## Goal

An MCP bearer token issued to a *user* authorizes every project that user can
access, with per-call access checks through the same seam as the browser
(`project_access_for_user`). Project-scoped tokens are untouched.

## Tasks

1. **Storage**: decide extend-`mcp_tokens`-with-nullable-`project_id` vs. new
   table. Migration + repository. Keep hash/prefix/scopes/issuer/expiry/
   revocation semantics identical to project tokens.
2. **Authentication path**: `authenticate_plaintext_token` (and the server's
   per-call re-check) resolves either principal type; a user token binds the
   calling principal to the user, then each project-scoped tool call runs the
   ownership-enforcement access check for the requested `project_id`.
3. **Tool semantics under a user token**:
   - `list_projects` returns all accessible projects (id, name, active
     version) — this is the agent's resolution fallback.
   - Every other project tool takes `project_id` as today; scope strings
     (`project:read`/`project:write`/`asset:*`) apply across projects.
4. **Issuance surface (non-interactive part only)**: account-level REST —
   `GET/POST /api/v1/agent-tokens`, `POST /api/v1/agent-tokens/{id}/revoke`.
   Web-UI "My agent tokens" list/revoke page. (Interactive device flow is
   Phase 02.)
5. **Tests**: user token reads/writes own project; **404 `project_not_found`**
   on another user's project (rides ownership-enforcement fixtures — see
   "Cross-user error contract" below); revoked token fails closed mid-session;
   project-token regression suite unchanged.
6. **Docs**: `context/mcp.md` — principal types, scope matrix note,
   `list_projects` semantics, the cross-user error contract, token-issuance
   section.

## Cross-user error contract (aligned 2026-08-01)

A user token pointed at a project its user cannot reach returns
**`404 project_not_found` with `recoverability: "refresh"`** — *not* 403 /
`forbidden`.

This follows `planning/archive/dated/2026-08-01/project-ownership-enforcement/decisions.md`
§D-2: a 403 confirms to a stranger that a project with that ID exists, which is
exactly what they should not learn. The same rule already governs
`_ensure_project_owner` and the browser surface, so MCP and REST stay on one
contract rather than two.

It also needs no new code: `backend/features/mcp/tools_shared.py:29` **already**
maps `project_not_found → "refresh"`. And `refresh` is the right instruction
for an agent — its recovery action is to re-resolve via `list_projects`, which
is precisely the resolution fallback defined in task 3. An agent that typo'd an
id and an agent pointed at someone else's project get the same answer and the
same correct next move, which is the point.

Practical consequence for the `.phn.json` marker flow: a stale or wrong project
id in a folder marker surfaces as `project_not_found`, indistinguishable from a
permissions problem. The skill's guidance should therefore be "re-resolve via
`list_projects`", never "you lack permission" — the agent cannot tell, and
should not guess.

## Expiry (decided — §D-11)

365-day default expiry, revocable. Issuance surfaces default to 365 days;
no shorter-lived ceremony required.

## Done when

Local stack: a user token minted for `codex@example.com` lists its projects,
round-trips a draft write on one, and is rejected on `ed@example.com`'s
seed project with `project_not_found` / `recoverability: "refresh"`.

Note `codex@example.com` owns no projects on the dev seed
(`ed@example.com` owns the seed project), so this is the natural test pair —
but it also means the `AGENT-BROWSER` fixture must grant codex something to
list, or `list_projects` returns empty and the round-trip has nowhere to run.
Coordinate with ownership-enforcement Phase 3 §3.4, which checks the same
fixture.
