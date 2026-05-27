---
DATE: 2026-05-12
TIME: 20:45 EDT
STATUS: Review of TB-04b (MCP Read-Only Tracer) uncommitted changes.
AUTHOR: Claude (code-review)
SCOPE: Code review of the uncommitted working-tree changes against
       the TB-04b scope as outlined in
       planning/ROADMAP.html. Not a completeness
       audit against the final app or the full NEW-LLM-API-1 surface.
RELATED: planning/ROADMAP.html (TB-04b row),
         context/technical-requirements/llm-mcp-schema.md §10.3,
         context/user-stories/50-settings-ops-llm.md
         (US-Settings AC #9, C-1, NEW-LLM-API-1),
         context/technical-requirements/api.md (shared access-check).
FILES REVIEWED:
  backend/config.py (modified)
  backend/main.py (modified)
  backend/pyproject.toml (modified)
  backend/alembic/versions/20260512_0006_mcp_tokens.py (new)
  backend/features/mcp/__init__.py (new)
  backend/features/mcp/models.py (new)
  backend/features/mcp/repository.py (new)
  backend/features/mcp/service.py (new)
  backend/features/mcp/routes.py (new)
  backend/features/mcp/server.py (new)
  backend/scripts/mcp_stdio.py (new)
  backend/scripts/smoke_mcp_read.py (new)
  backend/tests/test_mcp.py (new)
---

# TB-04b Code Review

Overall: the slice cleanly delivers the TB-04b tracer — token admin
REST, FastMCP scaffold, Streamable HTTP at `/mcp`, stdio entry point,
and project-scoped bearer auth. Below are the issues worth surfacing
before TB-05.

## Architectural / security

1. **Env-token fallback runs in the HTTP code path** —
   `features/mcp/server.py:163-178` checks `PHN_MCP_TOKEN` after
   `get_access_token()` returns `None`. In stdio this is correct; in
   HTTP it's defense-in-depth-fragile: if FastMCP auth ever fails open
   or is reconfigured (e.g. `required_scopes` removed), an
   unauthenticated HTTP request would silently bind to whatever token
   the server process happens to have in its env. Gate this fallback
   by transport (or by an explicit "stdio mode" flag) so the
   HTTP-served binary cannot ever authenticate from env. The risk is
   small today because `AuthSettings(required_scopes=["project:read"])`
   makes the verifier load-bearing, but the seam is the kind of thing
   future-you will trip over.

2. **`mcp_issuer_url` / `mcp_resource_server_url` default to
   `http://localhost:8000`** — `backend/config.py:51-53`. There is no
   staging override in `.env.example`, render docs, or
   `01_IMPLEMENTATION-ROADMAP.md`. Once `/mcp` is reachable on staging
   (per Decision Queue row for TB-04b, transport landed) the
   resource-server metadata returned to clients will misadvertise as
   localhost unless these are wired through environment variables.
   Add to env templates and staging config before any non-local MCP
   client points at the deployment.

3. **Tool I/O has no automated coverage** — `tests/test_mcp.py`
   exercises only the REST token admin path and two service helpers
   (`project_access_for_token`, `require_token_scope`). The TB-04b row
   explicitly calls for *"read-only enforcement (write attempt is
   rejected, not silently no-op); MCP and REST share the access-check
   dependency; targeted tool I/O contract tests."* The five read tools
   and the `replace_table` rejection path are covered only by the
   manual `smoke_mcp_read.py` plus a one-off browser cross-check. At
   minimum add an in-process MCP-client test (or direct tool-function
   tests) covering: `list_projects` shape, `get_document` envelope
   shape with and without a draft, and `replace_table` returning a
   structured `mcp_scope_insufficient` for a read-only token.

## Divergence from planning docs

4. **`replace_table` signature is incomplete vs. PRD §10.3** —
   implementation takes `(project_id, version_id, table_name, ctx)`
   and rejects with `mcp_write_deferred` / `mcp_scope_insufficient`.
   The PRD signature is `replace_table(project_id, version_id,
   table_name, rows, draft_etag | base_version_etag)`. Stubbing it
   without the `rows` / etag args is fine as a TB-04b stub, but the
   current stub will mask any future regression that drops those
   params — when TB-17 lands the write path the signature change is
   a breaking client contract. Either accept-and-ignore `rows` /
   `draft_etag` now, or add a code comment marking the stub as
   parameter-incomplete.

5. **Tool return types are inconsistent** — `McpProjectEnvelope` and
   `McpDocumentEnvelope` are Pydantic-validated, but `list_projects`,
   `list_versions`, `list_status_items`, `get_table` all return
   `dict[str, object]`. PRD §10.3 explicitly says *"Tools return
   Pydantic-validated structured results."* Wrapping the others in
   dedicated Pydantic envelopes is cheap and would catch shape drift
   early.

6. **`get_table` is not in PRD §10.3** — canonical is `query_table`
   (typed query object). `get_table` (just fetch one table) is a
   reasonable read-side primitive for TB-04b but is undocumented in
   the schema spec, so add it to `llm-mcp-schema.md` or replace it
   with the no-filter form of `query_table` once that lands. Don't
   let it accumulate as an unreviewed surface.

7. **Read-safe-mode is missing in `get_document`** —
   `validate_document(version["body"])` will raise an unhandled
   validation error if the saved body fails schema. PRD §10.5
   mandates the read-safe-mode fallback
   `{schema_version, schema_version_unsupported: true, body: <raw>}`
   from day 1. The roadmap assigns that to TB-06, but the MCP surface
   should participate when TB-06 lands; flag this as a known gap
   rather than discovering it the first time a real older body is
   read through MCP.

8. **Structured errors are smuggled as JSON-inside-`ToolError`-string**
   — `server.py:216-231` does
   `ToolError(json.dumps(envelope.model_dump(...)))`. The PRD's
   "common error envelope with at least `code`, `message`,
   `request_id`, `recoverability`" is met by the envelope itself, but
   the client has to JSON-parse the error message string to recover
   it, which is fragile. If FastMCP supports returning a tool result
   with `isError: true` carrying structured content, prefer that.
   Otherwise document the wire shape in `llm-mcp-schema.md` so callers
   know to JSON-decode `error.message`.

## Smaller issues

9. **`McpTokenIssueRequest.expires_at` accepts past datetimes** — no
   `> now` validator. An editor can issue a token that authenticates
   as `None` immediately. Add a `@field_validator("expires_at")` that
   rejects past values.

10. **Duplicate token DB lookup per MCP request** —
    `PhNavigatorTokenVerifier.verify_token` does
    `authenticate_plaintext_token` (read + `UPDATE last_used_at`)
    inside a write transaction, and then `current_token` re-fetches
    by id via `get_active_token_by_id`. Reasonable for now, but you
    could thread the verified token through the FastMCP context to
    avoid the second DB round trip per tool call.

11. **`last_used_at` is bumped before scope rejection** —
    `authenticate_plaintext_token` writes `touch_token` before the
    tool's scope check fires. So rejected calls count as "uses" in
    the listing. Probably fine (it does indicate the token tried),
    but worth either documenting or moving the touch into the
    per-tool path.

12. **`require_editor_user(access)` in service.py is redundant** in
    `issue_token` / `list_project_tokens` / `revoke_project_token`
    because the routes already gate on
    `require_project_edit_access`. Either remove for clarity, or keep
    as a defense-in-depth check and add a comment saying so.

13. **CORS `expose_headers=["Mcp-Session-Id", "X-Request-ID"]`** in
    `main.py:45` — since `/mcp` is a mounted sub-app, the outer CORS
    middleware likely doesn't apply to its responses. With
    `stateless_http=True` you also aren't emitting `Mcp-Session-Id`.
    The header is harmless but signals intent that isn't actually
    wired. Either remove it or document that browser MCP clients
    aren't a supported path in V2 MVP.

14. **`user_action_log` rows for `mcp_token_issue` /
    `mcp_token_revoke` stash `project_id` in `details` JSON** —
    because the table has no `project_id` column. The US-Settings
    §C-1 spec lists `project_id UUID REFERENCES projects(id)` as a
    real column. That's a pre-existing schema gap (TB-01 era), not a
    TB-04b regression, but the MCP audit rows now make the gap
    visible. Worth a follow-up to add the column and backfill from
    `details`.

## What looks right

- Token model: SHA-256 of high-entropy `phn_mcp_` +
  `secrets.token_urlsafe(32)`, hash+prefix stored, plaintext shown
  once.
- DB CHECK constraint on `scopes` matches the Pydantic `McpScope`
  literal.
- Partial unique index intent satisfied via `uq_mcp_tokens_token_hash`
  + active-only `ix_mcp_tokens_project_active`.
- Revocation paths: REST `revoke` endpoint sets `revoked_at`,
  `token_is_active` enforces it, and `current_token`'s second lookup
  re-checks active state — matches the *"a request already past auth
  may complete atomically, but any follow-up commit step must re-check
  token state"* rule in US-Settings AC #9.
- Audit events written for issue + revoke per US-Settings AC #9.
- Reuses `ProjectAccess` and `require_project_access` semantics — the
  spec's "MCP and REST share the access-check dependency" is realized
  via `project_access_for_token`.
- Lifespan correctly drives `phn_mcp.session_manager.run()` (the
  lesson-log notes this was load-bearing).
- Transport decision: Streamable HTTP at `/mcp` + stdio via
  `PHN_MCP_TOKEN`, legacy SSE deferred — matches the Decision Queue
  row.
- Read-only token write attempt returns structured
  `mcp_scope_insufficient` rather than silent no-op — matches the
  lesson-log entry and TB-04b read-only enforcement requirement (just
  under-tested).

## Recommended next moves before TB-05

1. Add automated tool tests (point 3) — most leverage per minute.
2. Gate the env-token fallback to stdio (point 1).
3. Wire `mcp_issuer_url` / `mcp_resource_server_url` into env
   templates and staging (point 2).
4. Reject past `expires_at` (point 9).
5. Document the JSON-in-string error wire shape, or replace with
   structured tool-result errors (point 8).

Items 4–7, 11–14 are appropriate to track as follow-ups rather than
blocking TB-05.

## Disposition After Follow-Up Pass

Date: 2026-05-12 21:10 EDT

Addressed now:

- **#1 env-token fallback:** HTTP MCP no longer falls back to
  `PHN_MCP_TOKEN`; only the stdio entrypoint builds the server with
  env-token auth enabled.
- **#2 MCP URLs:** added local defaults to `backend/.env.example` and
  Render staging values to `context/ENVIRONMENT.md`.
- **#3 tool I/O coverage:** added in-process MCP client coverage for
  `list_projects`, `get_document` without a draft, `get_document` with
  a draft, `get_table`, read-token metadata shape, and read-only
  `replace_table` structured rejection.
- **#4 write stub signature:** `replace_table` now accepts the planned
  `rows`, `draft_etag`, and `base_version_etag` arguments but still
  rejects writes until TB-17.
- **#5 return envelopes:** read tools now return Pydantic envelope
  models rather than ad hoc dicts.
- **#6 `get_table` doc drift:** documented `get_table` as a TB-04b
  read primitive in `llm-mcp-schema.md`, while preserving
  `query_table` as the future typed filtered contract.
- **#8 error wire shape:** documented the current FastMCP `ToolError`
  JSON-in-string envelope in `llm-mcp-schema.md`.
- **#9 past expiry:** token issue now rejects past `expires_at`.
- **Post-review simplify pass:** shared the current document-view
  loader with REST Rooms reads, centralized `require_editor_user`,
  reused existing project/version/status response models in MCP
  envelopes, moved token verification DB work off the async event loop,
  normalized token expiry timestamps to UTC, throttled `last_used_at`
  writes, and rejected write-only MCP tokens until TB-17 defines write
  scope semantics.
- **Incidental general fix:** `RequestValidationError` details are now
  JSON-encoded before returning the shared REST validation envelope.

Deferred:

- **#7 read-safe-mode:** keep with TB-06/schema fallback work so REST,
  MCP, and frontend read-safe behavior land together.
- **#10 duplicate token lookup:** `last_used_at` write amplification was
  reduced; keep the extra active-token lookup for now because MCP tools
  still need the full token row and issuing user.
- **#11 `last_used_at` before scope rejection:** keep; a rejected call
  still represents token use.
- **#12 defense-in-depth `require_editor_user`:** keep the service
  guard even though routes already gate editor access.
- **#13 browser MCP CORS/header intent:** defer until a real browser
  MCP client exists; current MVP client path is server/stdio.
- **#14 `user_action_log.project_id`:** pre-existing audit-schema gap;
  schedule as a separate schema cleanup if SQL support queries need it.
