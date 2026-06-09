---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Not started
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 7 — split `backend/features/mcp/tools.py` (1,046 lines)
       into a `mcp/tools/` package grouped by tool family. Pure
       organisation, zero behavior change.
EFFORT: ~1 h
BUCKET: Soon
DEPENDS_ON: none
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md` §1b
  - `backend/features/mcp/tools.py`
  - `backend/features/mcp/server.py` (consumer)
---

# Phase 7 — Split `mcp/tools.py` by family

## Goal

Replace the single 1,046-line `tools.py` with a `mcp/tools/` package
that groups tool functions by domain. `mcp/tools/__init__.py`
re-exports the public surface so `mcp/server.py` keeps working with no
changes (or only a single import path update).

## Current shape

Top-level tool functions in `tools.py`, by domain (from the grep
outline):

### Projects
- `tool_list_projects` (156)
- `tool_get_project` (165)
- `tool_list_versions` (179)
- `tool_delete_project` (187)
- `tool_restore_project` (209)
- `tool_hard_delete_project` (227)

### Status items
- `tool_list_status_items` (263)

### Documents / tables
- `tool_get_document` (271)
- `tool_get_table` (287)
- `tool_replace_table` (690)

### Envelope
- `tool_list_envelope_assemblies` (312)
- `tool_list_project_materials` (345)
- `tool_report_material_catalog_drift` (378)
- `tool_report_missing_envelope_evidence` (403)
- `tool_query_unfinished_envelope_work` (445)
- `tool_apply_envelope_command` (646)

### Assets / jobs
- `tool_list_assets` (532)
- `tool_get_asset_url` (548)
- `tool_resolve_asset_urls` (555)
- `tool_start_bulk_download` (568)
- `tool_get_job` (588)
- `tool_bulk_attach` (595)
- `tool_bulk_detach` (618)

### Custom fields
- `tool_add_custom_field` (715)
- `tool_rename_custom_field` (750)
- `tool_delete_custom_field` (826)
- `tool_duplicate_custom_field` (862)
- `tool_change_custom_field_type` (897)
- `tool_edit_custom_field_options` (937)
- `tool_set_custom_field_description` (979)
- `tool_set_custom_field_formula` (1014)

### Helpers
- `_get_project_detail_or_error` (129)
- `_token_user_or_error` (143)
- `_dict_items` (805)
- `_segment_work_item` (811)

## Target layout

```
backend/features/mcp/tools/
    __init__.py          # re-exports the full public surface
    _helpers.py          # _get_project_detail_or_error, _token_user_or_error,
                         #   _dict_items, _segment_work_item
    projects.py          # 6 project tool functions
    status_items.py      # tool_list_status_items
    documents.py         # tool_get_document, tool_get_table, tool_replace_table
    envelope.py          # 6 envelope tool functions
    assets.py            # 7 asset/job tool functions
    custom_fields.py     # 8 custom-field tool functions
```

Every file under 300 lines after the split, well under the soft limit.

## Pre-work

1. Find every caller of `tools.py`:

   ```bash
   grep -rn "from backend.features.mcp.tools" backend/
   ```

   Expected: `mcp/server.py` and tests. Anyone else is unexpected;
   inspect.

2. Confirm the public surface — anything in `tools.py` without a
   leading underscore is presumed public; the helpers move to
   `_helpers.py` (still importable from anywhere in `tools/` but not
   re-exported from `__init__`).

## Steps

1. Create the `mcp/tools/` directory and stub `__init__.py`.
2. For each domain file, cut the listed functions out of `tools.py`
   into the new file. Move the imports they need. Add `from
   ._helpers import ...` where applicable.
3. After each cut, update `mcp/tools/__init__.py`:

   ```python
   from .projects import (
       tool_list_projects,
       tool_get_project,
       ...
   )
   from .documents import ...
   # etc.

   __all__ = [
       "tool_list_projects",
       "tool_get_project",
       ...
   ]
   ```

4. Once `tools.py` is empty, delete it.
5. Update `mcp/server.py` if it imported specific names from
   `backend.features.mcp.tools` — typically no change needed because
   `from backend.features.mcp.tools import ...` still resolves through
   the new `__init__.py`.
6. Run MCP-related tests:

   ```bash
   cd backend && uv run pytest tests/features/mcp -q
   ```

7. `make ci`.

## Files touched

- New: `backend/features/mcp/tools/__init__.py`,
  `_helpers.py`, `projects.py`, `status_items.py`, `documents.py`,
  `envelope.py`, `assets.py`, `custom_fields.py`.
- Deleted: `backend/features/mcp/tools.py`.
- Possibly modified: `backend/features/mcp/server.py` (imports only).

## Verification

- `wc -l backend/features/mcp/tools/*.py` — every file under 600 lines
  (target: under 400).
- All MCP tests pass with no changes other than possible import path
  updates.
- `make ci` green.

## Risks

- **Internal helpers moved without their callers**: a private helper
  used by only one function should travel with that function, not go
  to `_helpers.py`. Re-check before placing.
- **Tool registration**: if `mcp/server.py` registers tools by
  iterating the `tools` module, the new package layout must still
  expose every tool through `mcp.tools`. The `__init__.py` re-exports
  guarantee this — but verify by running the server in dev mode
  (`uv run python -m backend.features.mcp.server` or whatever the
  current invocation is) and listing tools.

## Done when

- `tools.py` is deleted, no file in `tools/` exceeds 600 lines, tests
  pass, CI green, `STATUS.md` updated.
