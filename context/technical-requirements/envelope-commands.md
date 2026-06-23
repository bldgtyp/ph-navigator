# Envelope Semantic Command Catalog

The Assembly Builder accepts edits as **semantic commands** — typed,
discriminated, narrowly-scoped intents that the backend applies in a
single atomic transaction over the project document. This is the API
the frontend and the MCP server both call. There is no general
"PATCH this field" endpoint; every edit is one of the commands below.

## Endpoint

- REST: `POST /api/v1/projects/{project_id}/versions/{version_id}/draft/envelope/commands`

Request body:

```json
{ "command": { "kind": "<command_kind>", ... } }
```

Concurrency:

- `If-Match-Version: <version_etag>` is required on the first command
  against a saved version (no draft yet). The server forks a draft.
- `If-Match: <draft_etag>` is required on every subsequent command
  against the same draft.

Successful response is the `EnvelopeReadResponse` for the updated draft
(or the saved version when the command is a no-op short-circuit, in
which case `draft_etag` is `null`).

Authentication is project-scoped edit access. Viewers and locked
versions are rejected with HTTP 409 (`viewer_read_only`,
`version_locked`).

## Command list

24 command kinds, grouped by domain. JSON shapes live in
`backend/features/envelope/models.py`; the table below cites the model
class name.

### Assembly commands

| Kind | Model | Purpose | Notable conflicts |
|------|-------|---------|-------------------|
| `create_assembly` | `CreateAssemblyCommand` | Create an assembly with one default layer + one null segment. | `duplicate_assembly_name` |
| `rename_assembly` | `RenameAssemblyCommand` | Rename, with trim + case-fold uniqueness check (own name → no-op). | `duplicate_assembly_name`, `assembly_not_found` |
| `update_assembly_type` | `UpdateAssemblyTypeCommand` | Change `type` (wall / roof / floor / etc.). | `assembly_not_found` |
| `duplicate_assembly` | `DuplicateAssemblyCommand` | Deep-copy an assembly, new IDs, "Copy" suffix. | `duplicate_assembly_name`, `assembly_not_found` |
| `delete_assembly` | `DeleteAssemblyCommand` | Remove an assembly. | `assembly_not_found` |
| `flip_orientation` | `FlipOrientationCommand` | Toggle `first_layer_outside` ↔ `last_layer_outside`. | `assembly_not_found` |
| `flip_layers` | `FlipLayersCommand` | Reverse layer order; segment IDs preserved. | `assembly_not_found` |
| `flip_segments` | `FlipSegmentsCommand` | Reverse segment order in every layer that has ≥2 segments; no-op when all layers are single-segment. | `assembly_not_found` |

### Layer commands

| Kind | Model | Purpose | Notable conflicts |
|------|-------|---------|-------------------|
| `add_layer` | `AddLayerCommand` | Insert a new layer above/below a target layer; null `target_layer_id` appends. New layer inherits the target's width. | `assembly_not_found`, `layer_not_found` |
| `update_layer_thickness` | `UpdateLayerThicknessCommand` | Set layer `thickness_mm` (> 0). | `assembly_not_found`, `layer_not_found` |
| `delete_layer` | `DeleteLayerCommand` | Remove a layer. | `last_layer` (assemblies keep ≥1 layer), `layer_not_found`. |

### Segment commands

| Kind | Model | Purpose | Notable conflicts |
|------|-------|---------|-------------------|
| `add_segment` | `AddSegmentCommand` | Insert a new segment left/right of a target; null `target_segment_id` appends. | `layer_not_found`, `segment_not_found` |
| `update_segment` | `UpdateSegmentCommand` | Set `width_mm`, `is_continuous_insulation`, `steel_stud_spacing_mm`. Does not touch material assignment. | `segment_not_found` |
| `delete_segment` | `DeleteSegmentCommand` | Remove a segment. | `last_segment` (layers keep ≥1 segment), `segment_not_found`. |
| `update_segment_use_site_notes` | `UpdateSegmentUseSiteNotesCommand` | Set per-segment author notes. | `segment_not_found` |

### Material assignment commands

| Kind | Model | Purpose | Notable conflicts |
|------|-------|---------|-------------------|
| `paste_assignment` | `PasteAssignmentCommand` | Paint-bucket paste: set `project_material_id`, `is_continuous_insulation`, `steel_stud_spacing_mm` on a segment. No-op short-circuits when the assignment is byte-equal to the current state — response carries no new `draft_etag`. | `segment_not_found`, `project_material_not_found` |
| `pick_project_material` | `PickProjectMaterialCommand` | Assign an existing project material to a segment (or clear with `null`). | `project_material_not_found`, `segment_not_found` |
| `pick_catalog_material` | `PickCatalogMaterialCommand` | Copy a catalog row into the project as a new project material and assign it; subsequent picks of the same catalog row reuse the existing copy. **Touches DB** (reads `catalog_materials`). | `catalog_material_not_found`, `segment_not_found` |
| `hand_enter_material` | `HandEnterMaterialCommand` | Create an ad-hoc project material from form fields and assign it. | `segment_not_found` |
| `detach_segment_material` | `DetachSegmentMaterialCommand` | Fork the segment's project material into a new "(Custom)" copy with no `catalog_origin`; assign the copy. | `segment_has_no_material`, `segment_not_found` |

### Project-material commands

| Kind | Model | Purpose | Notable conflicts |
|------|-------|---------|-------------------|
| `update_project_material` | `UpdateProjectMaterialCommand` | Patch any subset of project-material fields. Edits to catalog-bound fields auto-flag `local_overrides`. | `project_material_not_found` |
| `remove_unused_project_materials` | `RemoveUnusedProjectMaterialsCommand` | Drop project materials no segment references. | — |
| `remove_project_material` | `RemoveProjectMaterialCommand` | Drop one project material, only when no segment references it. Used by the Materials tab's Unused section row-level remove action. | `project_material_not_found`, `project_material_in_use` |
| `refresh_project_material_from_catalog` | `RefreshProjectMaterialFromCatalogCommand` | Reconcile a drifted catalog-origin project material against the current catalog row using per-field `take_catalog` / `use_value` / `keep_mine` choices. **Touches DB**. See `envelope-catalog-drift.md`. | `project_material_has_no_catalog_origin`, `catalog_material_source_missing`, `catalog_material_source_deactivated`, `unknown_project_material_refresh_field` |

## Conflict code reference

All command conflicts emit HTTP 409 with this body:

```json
{
  "error_code": "<code>",
  "detail": "<human-readable>",
  "details": { "<entity>_id": "..." }
}
```

Catalog of conflict codes raised by envelope commands:

- `duplicate_assembly_name`
- `assembly_not_found`, `layer_not_found`, `segment_not_found`,
  `project_material_not_found`
- `last_layer`, `last_segment`
- `segment_has_no_material`
- `project_material_in_use`
- `project_material_has_no_catalog_origin`
- `catalog_material_not_found` (catalog row missing at pick time)
- `catalog_material_source_missing`,
  `catalog_material_source_deactivated`
- `unknown_project_material_refresh_field`
- `version_etag_mismatch`, `draft_etag_mismatch`, `version_locked`,
  `viewer_read_only` (concurrency / authz envelope, applies to every
  command)

## See also

- `backend/features/envelope/commands/registry.py` — handler map.
- `backend/features/envelope/models.py` — command JSON schemas.
- `backend/features/envelope/service.py` — ETag protection,
  no-op short-circuit, draft/version branching.
- `backend/tests/envelope/test_envelope_commands_*.py` — per-command
  contract tests.
