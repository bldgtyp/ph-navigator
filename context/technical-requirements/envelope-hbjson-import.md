# HBJSON Opaque-Construction Import — Contract

The inverse of `envelope-hbjson-export.md`: upload a construction-library
file and re-create its assemblies (and the project materials they
reference) inside the active version's **draft**. Two-step, preview →
confirm, so nothing is written until the user accepts the plan.

v1 reads the **PHN-native** `PHNavigatorOpaqueConstructionLibrary` shape
(a direct reverse of the export — no honeybee dependency). The raw
honeybee-PH path normalizes into the same IR and lands in Phase 2.

Implementation: `backend/features/envelope/hbjson_import.py` (parse → IR),
`import_planning.py` (`build_import_plan`), `commands/envelope_import.py`
(apply), `import_models.py` (contracts). Tests:
`backend/tests/envelope/test_envelope_hbjson_import.py`.

## Endpoints

- **Preview (dry run):**
  `POST …/versions/{version_id}/envelope/import/hbjson/preview` —
  `multipart/form-data` with a `file` field; project **edit** access.
  Parses + matches + plans against the current draft view and catalog and
  returns the plan. **No mutation.** Body is capped (8 MB) → 413
  `import_file_too_large`.
- **Apply:** the existing `POST …/draft/envelope/commands` with command
  `kind = "import_envelope_constructions"`, carrying `file` (the parsed
  JSON object) + `resolutions` (per-construction overrides). ETag-guarded
  like every envelope command; re-runs the same deterministic plan
  server-side and performs **one** `replace_materials_and_assemblies`.

## Preview response

```json
{
  "project_id": "...", "version_id": "...",
  "source": "version | draft", "version_etag": "...", "draft_etag": "... | null",
  "schema_version": <int>,
  "constructions": [
    { "source_assembly_id": "asm_… | null", "name": "...",
      "action": "add_new | replace | skip",
      "target_assembly_id": "asm_… | null", "warnings": ["..."] }
  ],
  "materials": [
    { "source_key": "...", "name": "...",
      "decision": "reuse_project_material | reuse_catalog_in_project | pick_from_catalog | create_new",
      "project_material_id": "pmat_…", "catalog_record_id": "rec… | null",
      "warnings": ["..."] }
  ],
  "counts": { "constructions_add": 0, "constructions_replace": 0, "constructions_skip": 0,
              "materials_reused": 0, "materials_picked_from_catalog": 0, "materials_created": 0 },
  "warnings": ["..."]
}
```

The caller echoes `version_etag` (or `draft_etag` when a draft exists)
back on the apply command's `If-Match-Version` / `If-Match` header.

## Material matching ladder (PRD §5)

Run per distinct incoming material (deduped by
`ph_nav.project_material_id`); stop at the first hit:

1. **reuse_project_material** — `project_material_id` already in the body.
2. **reuse_catalog_in_project** — exactly one existing project material
   shares the incoming `catalog_origin.catalog_record_id`. >1 ⇒ a
   `ambiguous_in_project_catalog_material` warning, then fall through.
3. **pick_from_catalog** — `catalog_record_id` resolves to an *active*
   `catalog_materials` row ⇒ a fresh copy via `project_material_from_catalog`
   (snapshots the **live catalog** values, not the file's — D3).
4–5. name / property matches — **Phase 2**.
6. **create_new** — project-only `ProjectMaterial` (`catalog_origin = null`):
   copies the file's thermal props + color; `category` defaults to `"Other"`
   (not exported); `specification_status` carries the file's value if valid
   else `"missing"`; datasheets are dropped (project-scoped asset ids).

## Construction collision policy (D5)

Per construction, default action: `ph_nav.assembly_id` matches an existing
assembly ⇒ **replace**; otherwise **add_new** (name auto-suffixed on
collision via `next_unique_name`). A `resolutions[]` entry
(`source_assembly_id` + `action` + optional `target_assembly_id`) overrides
the default. A `replace` whose target no longer exists falls back to
`add_new` with a `replace_target_missing` warning. Never silently overwrite.

## Round-trip fidelity

The reuse path (rung 1, same-project) is lossless: assembly id, layer/segment
ids, orientation (document order is restored, the inverse of the export's
outside-in normalization), `is_continuous_insulation`, and
`steel_stud_spacing_mm` all round-trip. **Lossy** by design: a homogeneous
layer's segment width (not exported → defaults to 1000 mm; thermally
irrelevant for a full-width segment) and, on create-new, `category` +
datasheets.

## Rejections (typed 422 unless noted)

`import_invalid_json` · `import_wrong_file_type` · `import_invalid_file` ·
`import_schema_too_new` · `import_unsupported_divisions` (multi-row grid) ·
`import_missing_cell_material` · `import_file_too_large` (413). Import does
**not** block on thermal incompleteness — incomplete assemblies are legal in
a draft and surface in the preview, not as errors.

## See also

- `context/technical-requirements/envelope-hbjson-export.md` — the format
  this reverses, including the additive `ph_nav` round-trip fields.
- `planning/features/envelope-hbjson-import/` — PRD, decisions, phases.
