# Phase 1 — Draft commit / discard

DATE: 2026-06-30
STATUS: Proposed.
GOAL: Let an MCP agent persist or drop a draft. After this phase the
      already-working envelope / aperture / custom-field writes stop dead-ending
      in the draft.

## Build

1. **`save_draft` MCP tool** (`features/mcp/tools_documents.py` + register in
   `server.py`). Wrap `features.project_document.service.save_draft`.
   - Args: `project_id, version_id, if_match: str | None`. `if_match` =
     version_body_etag taken at draft open.
   - Pattern: `current_token` → `project_access_or_error(..., "project:write")`
     → `try: save_draft(version_id, access, if_match=if_match, request=None)`
     → `except HTTPException: raise_http_exception_as_mcp_error(...)`.
   - Recoverability map: `version_locked`, `version_etag_mismatch`,
     `draft_etag_mismatch`, `project_version_not_found`, `no_draft_to_save`
     (confirm the real code) → `refresh`; else `fatal`.
   - **Token re-check on commit (§8.5):** rely on `current_token` re-resolving
     the active token by id (fails closed on revocation). Add a test that a
     revoked token's `save_draft` returns the structured auth error.
2. **`discard_draft` MCP tool.** Wrap `service.discard_draft(version_id,
   access)`. `project:write`. Discard with no draft = benign result, not error.
3. **Docstrings as discoverability.** Each tool's docstring (MCP-visible
   description) states: writes land in a draft; `save_draft` commits to the
   active version; locked version → use `save_draft_as` (Phase 3); `discard_draft`
   drops unsaved work.

## Docs closeout (non-optional, same PR)

- **Create `context/mcp.md`** (skeleton is fine, fill as tools land): purpose,
  the draft→save lifecycle, the scope matrix, the structured-error envelope +
  recoverability, the `ToolError`-JSON-in-message caveat, token-issuance
  pointer, and the live tool inventory grouped by area. Add `save_draft` /
  `discard_draft` here now.
- **Add a CLAUDE.md dispatch-table row:** "writing/reviewing **MCP tools**" →
  read `context/mcp.md` → `context/technical-requirements/llm-mcp-schema.md`,
  essentials "thin wrapper over REST service layer; project-scoped bearer
  tokens; writes go to a draft then `save_draft`".

## Tests

`backend/tests/test_mcp.py` (or a new `test_mcp_drafts.py`):
- save commits the draft and clears it (saved version reflects the edit);
- save against a locked version → `version_locked`;
- stale `if_match` save → `version_etag_mismatch`, draft preserved;
- discard drops the draft; discard with no draft is a clean no-op;
- revoked token on `save_draft` fails closed.

## Done when

Tools registered + green tests + `context/mcp.md` and the CLAUDE.md row exist
and describe the lifecycle. `make ci` green.
