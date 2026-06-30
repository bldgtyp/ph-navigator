# Phase 3 — Lifecycle & read parity (round-out)

DATE: 2026-06-30
STATUS: Complete on branch `codex/mcp-write-loop`.
        P1 — valuable but not required for the core write loop (Phases 1–2).
        Each item is a thin wrapper over an existing REST service.

## Build

1. **`save_draft_as` / `create_version`** — wrap `service.save_draft_as`
   (`POST /draft/save-as`). Args: `project_id, version_id, name, kind?`. This is
   the **locked-version escape hatch** (the recoverability `refresh` answer to a
   `version_locked` save) and the "save as a new version" primitive
   (`create_version` in the old spec). `project:write`.
2. **`update_project`** — wrap `service.patch_version` (`PATCH ""` →
   `ProjectDetail`). Current shipped REST parity fields are `locked` and
   `make_active`; the older name/rename language is not implemented in the
   backend and remains a Phase 4 docs-truth reconciliation item. `project:write`.
3. **`diff_versions`** — wrap `service.get_project_diff` (`GET /diff`). Read
   tool; the cert-round-diff use case Ed named. `project:read`. *If this bloats
   the feature, move it to the read backlog with `query_table`.*

## Docs closeout (same PR)

- Add all three to `context/mcp.md` with their scopes and the lifecycle role of
  `save_draft_as` (the locked-version path).
- These names appear in the stale `llm-mcp-schema.md` §10.3 list
  (`create_version`, `update_project`, `diff_versions`) — Phase 4 reconciles
  that list; here, just ensure `context/mcp.md` is correct.

## Tests

- `save_draft_as` creates a new version from the draft, clears the source draft,
  sets it active (mirror the existing service tests through the MCP seam);
- `save_draft_as` succeeds against a **locked** source version (the escape path);
- `update_project` version-metadata patch succeeds; no-op edits are rejected;
- `diff_versions` returns the structured per-table delta for two versions.

## Done when

Tools registered, parity tests green, `context/mcp.md` updated, `make ci` green.

## Completion evidence

Implemented 2026-06-30:

- `tool_save_draft_as` wraps `save_draft_as` and registers MCP
  `save_draft_as`.
- `tool_update_project` wraps `patch_version` and registers MCP
  `update_project` for the shipped `locked` / `make_active` metadata fields.
- `tool_diff_versions` wraps `get_project_diff` and registers MCP
  `diff_versions`.
- `context/mcp.md` documents Phase 3 scopes, save-as locked-version behavior,
  diff usage, and the `update_project` field limitation.

Verification:

- `cd backend && uv run ruff check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/versions.py tests/test_mcp.py`
- `cd backend && uv run ty check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py features/project_document/versions.py tests/test_mcp.py`
- `cd backend && uv run pytest tests/test_mcp.py` — 27 passed.
- `make format`
- `make ci` — backend 1254 passed / 2 skipped; frontend 215 test files / 1985
  tests passed; production build completed.
