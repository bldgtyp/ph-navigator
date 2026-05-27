# TB-08b Code Review

Date: 2026-05-14
Reviewer: Codex
Scope: current uncommitted TB-08b implementation only. This review checks the slice against `planning/ROADMAP.html` TB-08b, `context/technical-requirements/data-model.md`, and `context/user-stories/10-windows.md`, not against the final Windows app.

## Findings

### M1 - `catalog_origin` allows wrong catalog table/version for frame and glazing refs

- File: `backend/features/project_document/document.py:81`
- File: `backend/features/project_document/document.py:100`
- File: `backend/features/project_document/document.py:123`

`CatalogOrigin` is shared across all copied catalog values and permits `catalog_table` values of `"materials"`, `"frame_types"`, or `"glazing_types"`, while `catalog_version_id` accepts any of `matv_`, `framev_`, or `glazingv_`. Because `FrameRef` and `GlazingRef` do not add a validator tying the origin to their own catalog family, these payloads currently validate:

- `FrameRef.catalog_origin.catalog_table = "materials"`
- `FrameRef.catalog_origin.catalog_version_id = "glazingv_..."`
- `GlazingRef.catalog_origin.catalog_table = "frame_types"`

That diverges from the TB-08b/TB-08c contract that frame slots are copied from the Window-Frame catalog and glazing slots from the Window-Glazing catalog. It also weakens the refresh-from-catalog hook described in `context/technical-requirements/data-model.md` §7.1, where `catalog_origin` is the stored pointer used later to find the source row/version.

This is not a live-FK issue. The plan explicitly says no live join/FK should be enforced. The missing guard is purely shape consistency: `FrameRef` should only accept `catalog_table == "frame_types"` with a `framev_` version id, and `GlazingRef` should only accept `catalog_table == "glazing_types"` with a `glazingv_` version id. If `CatalogOrigin` is intended to stay reusable for future materials/project-material refs, use per-ref validators or typed subclasses rather than tightening the base model globally.

## Scope Check

The implementation otherwise matches the TB-08b slice boundary:

- `ProjectDocumentV1.tables.window_types` is now typed as `list[WindowTypeEntry]`.
- The window type grid shape enforces at least one row, column, and element; positive dimensions; ordered spans; and in-bounds span ends.
- Window type names are unique per version with trim + case-insensitive comparison.
- The new `window_types` table contract is registered through the existing table registry, with no new service-layer branch.
- Generic draft read/replace, diff, saved download, MCP table-read surface, and unsupported-table behavior all still route through the registry.
- `/api/v1/schemas/window-type/v1.json` is exposed.
- No frontend work was added, which is correct for TB-08b.

## Verification

Ran:

```bash
cd backend && uv run ty check
cd backend && uv run pytest --no-cov tests/test_project_document_window_types.py tests/test_project_document.py::test_unsupported_table_names_fail_through_registry tests/test_mcp.py::test_mcp_read_tools_return_document_and_structured_write_rejection tests/test_schemas.py::test_versioned_openapi_endpoint_includes_schema_and_inspectability_routes
```

Result: `ty` passed; targeted pytest selection passed (`10 passed`).

