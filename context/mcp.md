---
DATE: 2026-06-30
TIME: 17:44 EDT
STATUS: ACTIVE MCP CONTRACT
RELATED: context/technical-requirements/llm-mcp-schema.md, context/technical-requirements/save-versioning.md, backend/features/mcp/
---

# PH-Navigator MCP Contract

This is the live MCP reference for PH-Navigator agents. Historical MCP intent
still lives in `context/technical-requirements/llm-mcp-schema.md`; when the two
disagree, this file describes the shipped surface.

## Operating Model

MCP tokens are project-scoped bearer tokens issued by a logged-in editor. Tokens
must include `project:read`; write-capable tokens also include `project:write`.
Every project-scoped tool re-checks the current token record at call time, so
revoked or expired tokens fail closed before a write or commit runs.

Project-document writes land in the issuing editor's draft, not directly in the
saved version. The normal write loop is:

1. Read the current version or draft with `get_document` or `get_table`.
2. Apply a write tool using the latest `version_body_etag` or `draft_etag`.
3. Read back if another write depends on the new draft etag.
4. Call `save_draft` to persist, or `discard_draft` to drop the draft.

`save_draft` expects `if_match` to be the saved version body etag seen when the
draft was opened. A locked version returns `version_locked`; use
`save_draft_as` to create an unlocked copy from the draft or saved body.

## Error Envelope

MCP write helpers translate backend `HTTPException` details into a JSON
`ToolError` message:

```json
{"code":"version_etag_mismatch","message":"...","request_id":"","recoverability":"refresh","details":{}}
```

The MCP SDK exposes that JSON as the error message text, not as a separately
typed object. Clients should parse the message string when `isError` is true.

Recoverability values:

| Value | Meaning |
|---|---|
| `refresh` | Re-read project/version/draft state and retry only if still intended. |
| `reauthenticate` | Issue or select a valid token. |
| `forbidden` | The token lacks scope or is for another project. |
| `fatal` | Caller input or unsupported operation; do not retry unchanged. |
| `retry` | Transient failure; retry may succeed. |

## Scope Matrix

| Tool | Scope |
|---|---|
| `list_projects`, `get_project`, `list_versions`, `list_status_items`, `diff_versions` | `project:read` |
| `get_document`, `get_table` | `project:read` |
| `list_envelope_assemblies`, `list_project_materials`, `query_unfinished_envelope_work`, `report_material_catalog_drift`, `report_missing_envelope_evidence` | `project:read` |
| `list_project_climate_sources`, `get_project_location`, `get_project_sun_path` | `project:read` |
| `list_climate_datasets`, `search_climate_locations`, `get_climate_location` | valid MCP token |
| `list_assets`, `resolve_asset_urls`, `get_asset_url`, `start_bulk_download`, `get_job` | `asset:read` plus project access |
| `bulk_attach`, `bulk_detach` | `project:write` and `asset:write` |
| `apply_envelope_command`, `apply_aperture_command`, custom-field mutation tools | `project:write` |
| `replace_table`, `preview_replace_table`, `save_draft`, `save_draft_as`, `discard_draft`, `update_project` | `project:write` |
| `delete_project`, `restore_project`, `hard_delete_project` | `project:write` |
| HBJSON model/file tools | project access; write tools require write scope |

## Registered Tool Names

This block is CI-guarded. Every registered MCP tool must appear here exactly
once, and every name here must be registered by `build_mcp_server`.

<!-- mcp-tool-inventory:start -->
- `add_custom_field`
- `apply_aperture_command`
- `apply_envelope_command`
- `bulk_attach`
- `bulk_detach`
- `calculate_aperture_u_values`
- `change_custom_field_type`
- `create_hbjson_file`
- `delete_custom_field`
- `delete_hbjson_file`
- `delete_project`
- `diff_versions`
- `discard_draft`
- `duplicate_custom_field`
- `edit_custom_field_options`
- `get_aperture_type`
- `get_aperture_window_constructions`
- `get_asset_url`
- `get_climate_location`
- `get_document`
- `get_hbjson_file_download_url`
- `get_hbjson_model_data`
- `get_job`
- `get_project`
- `get_project_location`
- `get_project_sun_path`
- `get_table`
- `hard_delete_project`
- `list_aperture_types`
- `list_assets`
- `list_climate_datasets`
- `list_envelope_assemblies`
- `list_hbjson_faces`
- `list_hbjson_files`
- `list_hbjson_hot_water_systems`
- `list_hbjson_shading_elements`
- `list_hbjson_spaces`
- `list_hbjson_ventilation_systems`
- `list_project_climate_sources`
- `list_project_materials`
- `list_projects`
- `list_status_items`
- `list_versions`
- `preview_replace_table`
- `query_unfinished_envelope_work`
- `rename_custom_field`
- `rename_hbjson_file`
- `replace_table`
- `report_aperture_catalog_drift`
- `report_material_catalog_drift`
- `report_missing_envelope_evidence`
- `resolve_asset_urls`
- `restore_project`
- `save_draft`
- `save_draft_as`
- `search_climate_locations`
- `set_custom_field_description`
- `set_custom_field_formula`
- `start_bulk_download`
- `update_project`
<!-- mcp-tool-inventory:end -->

## Tool Inventory

### Project And Version Reads

- `list_projects()` returns the one project visible to the project-scoped token.
- `get_project(project_id)` returns project metadata plus version list.
- `list_versions(project_id)` returns version metadata.
- `list_status_items(project_id)` returns the relational status tracker.
- `diff_versions(project_id, from_version_id, to)` returns per-table changed
  paths for version-vs-version diffs, or version-vs-draft when `to="draft"`.
- `get_project_location(project_id)` and `get_project_sun_path(project_id)`
  return SI-canonical location and sun-path data.

### Project Documents And Tables

- `get_document(project_id, version_id)` returns the saved document or the
  token owner's current draft when one exists.
- `get_table(project_id, version_id, table_name)` returns one registered table.
  Custom-field-capable tables return a `{field_defs, rows}` envelope under the
  `rows` field.
- `replace_table(project_id, version_id, table_name, rows, draft_etag?,
  base_version_etag?)` replaces one registered table in the token owner's draft
  through the same `replace_table_slice` service as browser
  `PUT /draft/tables/{name}`. This is a whole-table write: read first, submit
  the full intended row set or full table replace payload, then call
  `save_draft`.
- `preview_replace_table(project_id, version_id, table_name, rows, draft_etag?,
  base_version_etag?)` validates the same payload and etags as `replace_table`
  but does not persist; it reports the optional dependent-link cascade that a
  destructive replace would trigger.

For `replace_table`, use `draft_etag` after a draft exists. On the first draft
write, use `base_version_etag` from `get_document.version_body_etag` or
`get_table.version_body_etag`. A stale draft/version etag returns a structured
`refresh` error.

The `rows` argument accepts:

- a full table replace payload matching the browser PUT body, such as
  `{field_defs, rooms, single_select_options}`;
- the current `get_table(...).rows` envelope with its `rows` array edited; or
- a bare row array when the table has no required side payload, or when the
  existing draft/version already carries the option lists needed by those rows.

For envelope/aperture structural edits, prefer the semantic command tools
(`apply_envelope_command`, `apply_aperture_command`). `replace_table` remains
available for browser-parity table replacement on all registered tables,
including semantic-command tables, but it is the lower-level primitive.

### Draft Lifecycle

- `save_draft(project_id, version_id, if_match?)` commits the token owner's
  draft to the active version and clears the draft. Recoverable conflict codes
  include `version_locked`, `version_etag_mismatch`, `draft_etag_mismatch`,
  `project_version_not_found`, and `draft_not_found`.
- `save_draft_as(project_id, version_id, name, kind?, locked?)` creates a new
  active version from the token owner's draft, or from the saved source version
  when no draft exists, and clears the source draft. This is the locked-version
  escape hatch after `version_locked`; `kind="submitted"` and `kind="closed"`
  are auto-locked by the service.
- `discard_draft(project_id, version_id)` deletes the token owner's draft.
  Calling it when no draft exists returns `discarded=false`.
- `update_project(project_id, version_id, locked?, make_active?)` patches the
  current REST version metadata surface and returns `ProjectDetail`. Despite the
  historical tool name, the shipped backend accepts only `locked` and
  `make_active` here; project/version naming is not part of this tool.

### Semantic Project-Document Writes

- `apply_envelope_command(project_id, version_id, command, if_match?,
  if_match_version?)` applies Assembly Builder commands through the same service
  boundary as the browser.
- `apply_aperture_command(project_id, version_id, command, if_match?,
  if_match_version?)` applies aperture commands.
- Custom-field mutation tools add, rename, duplicate, delete, type-convert,
  edit options, set descriptions, and set formulas on table field schemas.

### Envelope, Aperture, Assets, Climate, And HBJSON

The MCP server also exposes read/report tools for envelope assemblies, project
materials, unfinished envelope work, material/catalog drift, aperture types,
aperture U-value calculations, project climate sources, climate reference
datasets, uploaded assets, bulk download jobs, and HBJSON model-file inspection.
Those tools are read or asset-specific surfaces; mutating document tools still
follow the draft lifecycle above.

## Token Issuance

Editors issue and revoke project tokens through:

- `GET /api/v1/projects/{project_id}/mcp-tokens`
- `POST /api/v1/projects/{project_id}/mcp-tokens`
- `POST /api/v1/projects/{project_id}/mcp-tokens/{token_id}/revoke`

Plaintext tokens are shown only once. Stored rows keep a hash, prefix, scope
list, issuing editor, optional expiration, and revocation timestamp.
