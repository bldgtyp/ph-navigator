# HBJSON Opaque-Construction Import — Contract

The inverse of `envelope-hbjson-export.md`: upload a construction-library
file and re-create its assemblies (and the project materials they
reference) inside the active version's **draft**. Two-step, preview →
confirm, so nothing is written until the user accepts the plan.

Two source shapes normalize into one IR (`parse_construction_library`
dispatches on the envelope):

- **PHN-native** `PHNavigatorOpaqueConstructionLibrary` — a direct reverse
  of the export; id/catalog provenance preserved.
- **Raw honeybee-PH** — a single `OpaqueConstruction`, a name-keyed group
  ("dump objects"), or a full `Model` (its opaque constructions are sifted).
  No `ph_nav`; materials key on `identifier`, `catalog_origin = null`; the
  assembly type comes from the `W_/R_/F_` identifier prefix (else `other`),
  overridable in the preview. Parsed from the honeybee **dict shape**
  directly — no honeybee runtime dependency.

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
4. **reuse_project_material (by name)** — incoming name matches exactly one
   existing project material (normalized via the canonical
   `normalize_display_name`) ⇒ reuse, flagged `name_matched_project_material`.
   >1 ⇒ `ambiguous_name_in_project`, fall through.
5. **pick_from_catalog (by name)** — matches an active `catalog_materials`
   row by name ⇒ a fresh copy, flagged `name_matched_catalog_material`.

   Name matches (4–5) are fuzzy by nature, so every hit carries a warning the
   preview surfaces for confirmation. Property-tolerance matching is deferred.
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

`import_invalid_json` · `import_wrong_file_type` (not native, and not a
recognizable honeybee construction) · `import_invalid_file` ·
`import_no_constructions` (a model with no opaque constructions) ·
`import_schema_too_new` · `import_unsupported_divisions` (multi-row grid) ·
`import_missing_cell_material` · `import_file_too_large` (413). Import does
**not** block on thermal incompleteness — incomplete assemblies are legal in
a draft and surface in the preview, not as errors.

## Frontend

The "Upload constructions HBJSON" menu item (editor-only) on Envelope →
Assemblies drives this: `useEnvelopeHbjsonImport` reads the file and calls the
preview route, `ImportConstructionsDialog` shows the plan, and confirming fires
the `import_envelope_constructions` command on the existing envelope-command
rail. See `frontend/src/features/envelope/` (`hooks/useEnvelopeHbjsonImport.ts`,
`components/dialogs/ImportConstructionsDialog.tsx`).

## See also

- `context/technical-requirements/envelope-hbjson-export.md` — the format
  this reverses, including the additive `ph_nav` round-trip fields.
- `planning/features/envelope-hbjson-import/` — PRD, decisions, phases.
