# Phase 2 — Generic table writes (`replace_table`)

DATE: 2026-06-30
STATUS: Complete on branch `codex/mcp-write-loop`.
GOAL: Wire the `replace_table` stub to the real service so an MCP agent can write
      the 14 flat data tables (Rooms + all equipment + thermal bridges). This is
      the core write-parity unlock.

## Build

1. **Wire `tool_replace_table`** (`features/mcp/tools_documents.py`) to
   `features.project_document.service.replace_table_slice` — the same service
   the browser's `PUT /draft/tables/{name}` calls. Remove the
   `mcp_write_deferred` rejection.
   - Args already on the stub: `project_id, version_id, table_name, rows,
     draft_etag, base_version_etag`. Map `draft_etag → if_match`,
     `base_version_etag → if_match_version` (lazy draft create on first write).
   - `project:write`; `try/except HTTPException → raise_http_exception_as_mcp_error`.
   - Recoverability: `version_locked`, `draft_etag_mismatch`,
     `version_etag_mismatch`, `project_version_not_found` → `refresh`;
     row/field validation failures → `fatal`.
   - Return the updated `RegisteredTableResponse` envelope (same shape as
     `get_table`), so an agent can read the bumped `draft_etag` for its next call.
2. **No allow-list / no rejection** (open question resolved — PRD §2). Pass
   through to `replace_table_slice` for **all** registered tables, exactly like
   the browser PUT. Do **not** add a guard rejecting `apertures` /
   `assembly_segments` / `project_materials` — the browser already replaces
   `apertures`, and each table's `replace_request_model` (`extra="forbid"`) +
   `validate_document` already constrains what is accepted (e.g. a structural
   edit to `assembly_segments` fails as a validation error on its own).
   - Instead, **document** in `context/mcp.md` + the docstring: (a)
     `replace_table` is a *whole-table* replace — `get_table` first, submit the
     full row set, or you drop rows; (b) for envelope/aperture *structural* edits
     prefer the command tools (`apply_envelope_command` / `apply_aperture_command`)
     — `replace_table` is the lower-level primitive.
3. **`preview_replace_table` MCP tool** (recommended). Wrap
   `service.preview_table_replace` → `TableReplacePreviewResponse` so an agent
   can see the dependent-link cascade (e.g. deleting a heat-pump row other rows
   reference) before committing a destructive replace.

## Docs closeout (same PR)

- Update `context/mcp.md`: mark `replace_table` live; list the replaceable
  tables; document the read→replace→save pattern and the etag handshake; add
  `preview_replace_table`.
- Update each new tool's docstring with the lifecycle + replaceable-table note.

## Tests

`backend/tests/test_mcp.py` / `test_mcp_drafts.py`:
- read a flat table (e.g. `rooms`) → `replace_table` with edited rows → read
  back: change present, `draft_etag` bumped → `save_draft` → saved version shows
  the edit (full loop with Phase 1);
- stale `draft_etag` replace → `draft_etag_mismatch`, draft preserved;
- `replace_table` works on a semantic table the same way the browser PUT does
  (e.g. round-trip `apertures` via `get_table` → `replace_table`), proving there
  is **no** MCP-side rejection / parity gap;
- a replace that violates a table's `replace_request_model` (e.g. extra/unknown
  fields, or a structural edit to `assembly_segments`) → validation `fatal`;
- locked version replace → `version_locked`;
- `preview_replace_table` reports the dependent-link cascade without persisting.

## Done when

`replace_table` writes every registered table (mirroring the browser PUT — no
MCP-side rejection), the full read→replace→save loop passes, the command-vs-replace
+ read-before-replace guidance is in `context/mcp.md`, `make ci` green.

## Completion evidence

Implemented 2026-06-30:

- `tool_replace_table` now wraps `replace_table_slice` with `draft_etag →
  if_match` and `base_version_etag → if_match_version`.
- `preview_replace_table` is registered and wraps `preview_table_replace`.
- No table allow-list or semantic-table rejection was added; `apertures` parity
  is covered by test.
- The MCP wrapper accepts full browser PUT payloads, `get_table(...).rows`
  envelopes (read-only overlay keys ignored), or bare row arrays where current
  side payload is sufficient.
- `context/mcp.md` documents the read-before-replace rule, etag handshake,
  payload shapes, preview tool, and command-vs-replace guidance.

Verification:

- `cd backend && uv run ruff check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py`
- `cd backend && uv run ty check features/mcp/tools_documents.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py`
- `cd backend && uv run pytest tests/test_mcp.py` — 22 passed.
- `make format`
- `make ci` — backend 1249 passed / 2 skipped; frontend 215 test files / 1985
  tests passed; production build completed.
