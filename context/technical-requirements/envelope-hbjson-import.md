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
  `catalog_origin = null`; the assembly type comes from the `W_/R_/F_`
  identifier prefix (else `other`), overridable in the preview. Parsed from the
  honeybee **dict shape** directly — no honeybee runtime dependency.
  A file written by **PH-Navigator for SketchUp** is this shape and does carry
  a `ph_nav` block (see below).

### Reading what honeybee actually writes

- **Abridged constructions.** `Model.to_dict()` writes each construction as an
  `OpaqueConstructionAbridged` whose `materials` are identifier *strings*, with
  the material dicts in a sibling `properties.energy.materials` list. Both
  types are accepted and the identifiers resolve against that list; only a
  `Model` carries one, so the single-object and group shapes must inline their
  materials. A layer naming a material the file does not contain skips that
  construction (`import_material_unresolved`).
- **`ph_nav` from `user_data`.** A honeybee `Model` preserves only `user_data`,
  so PH-Navigator for SketchUp writes the same block, in the same shape, under
  `user_data["ph_nav"]` (plus `"source": "ph-navigator-sketchup"`). Every
  `ph_nav` read — construction, layer material, division cell — takes the
  top-level key first and `user_data["ph_nav"]` second, so a native file is
  unaffected.
- **Division cells.** honeybee-PH writes `{row, column, material}`; the PHN
  download format writes `column_width`/`row_height`/`ph_nav` on the cell.
  Widths always come from the grid's `column_widths` (both producers write it),
  by the cell's `column` or, when it has none, its position. Only `row == 0`
  cells are read and a multi-row grid is still rejected. Grid-level `steel_stud_spacing_mm` reaches every segment of
  that layer when no per-cell block carries one, with a
  `steel_stud_spacing_from_grid` warning: the grid holds one spacing for the
  whole layer, so per-segment attribution cannot be recovered.
- **Material dedup.** A material's PH-Navigator id is read from
  `ph_nav.project_material_id` or, for a file that went through honeybee
  objects (the Grasshopper export), `properties.ref.external_identifiers.ph_nav`.
  With neither, it keys on its value identity (normalized display name + conductivity + density +
  specific heat + emissivity + color) rather than its honeybee identifier,
  which is per-layer. Thickness is excluded: it belongs to the layer, so one
  product at two depths stays one project material.
- **Unsupported constructions.**   a layer material with no `thickness` — `EnergyMaterialNoMass`, the core of
  honeybee-PH's declared-U sandwich, carries a bare R-value — has no place in a
  PHN assembly. That
  construction is reported as its own preview row
  (`action = "skip"`, `unsupported = <the parse error's own code>`,
  non-overridable because an `Assembly` requires at least one layer) and the
  rest of the file imports. `unsupported` carries the rejection code the same
  parse would have raised as a 422 — `import_unsupported_layer_type`,
  `import_material_unresolved`, or any other from the list below — so there is
  one vocabulary, not two. This applies to **foreign files only**: a native
  library that will not parse is still a 422, because that would be a defect in
  this app.

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
  JSON object), `resolutions` (per-construction overrides, keyed by
  `resolution_key`), and `material_resolutions` (per-material overrides —
  `{source_key, action: "create_new"}`, the reject-the-match escape hatch).
  ETag-guarded like every envelope command; re-runs the same deterministic
  plan server-side and performs **one** `replace_materials_and_assemblies`.

## Preview response

```json
{
  "project_id": "...", "version_id": "...",
  "source": "version | draft", "version_etag": "...", "draft_etag": "... | null",
  "schema_version": <int>,
  "constructions": [
    { "resolution_key": "<file construction identifier>",
      "source_assembly_id": "asm_… | null", "name": "...",
      "action": "add_new | replace | skip",
      "target_assembly_id": "asm_… | null", "warnings": ["..."],
      "unsupported": "<reason code> | null" }
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

   Any reuse rung (1, 2, or 4) that keeps an existing project material whose
   thermal values (`conductivity_w_mk`, `density_kg_m3`, `specific_heat_j_kgk`,
   `emissivity`) differ from the file's adds a `reused_material_values_differ`
   warning — informational; the project's values are kept.
6. **create_new** — project-only `ProjectMaterial` (`catalog_origin = null`):
   copies the file's thermal props + color; `category` defaults to `"Other"`
   (not exported); `specification_status` carries the file's value if valid
   else `"needed"`; Honeybee's external `MISSING` reads back as internal
   `needed` (either case) via `envelope/honeybee_specification_status.py`; datasheets are dropped (project-scoped asset ids).

## Construction collision policy (D5)

Per construction, default action: `ph_nav.assembly_id` matches an existing
assembly ⇒ **replace**; otherwise **add_new** (name auto-suffixed on
collision via `next_unique_name`). A `resolutions[]` entry
(`resolution_key` + `action` + optional `target_assembly_id`) overrides the
default. `resolution_key` is the file's construction identifier, present on
every preview `ConstructionPlanItem`, so **foreign** constructions (which have
no native assembly id) can be skipped/added too — they just have no `replace`
option. A `replace` whose target no longer exists falls back to `add_new`
with a `replace_target_missing` warning. Never silently overwrite.

## Round-trip fidelity

The reuse path (rung 1, same-project) is lossless: assembly id, layer/segment
ids, orientation (document order is restored, the inverse of the export's
outside-in normalization), `is_continuous_insulation`, and
`steel_stud_spacing_mm` all round-trip. **Lossy** by design: a homogeneous
layer's segment width (not exported → defaults to 1000 mm; thermally
irrelevant for a full-width segment) and, on create-new, `category` +
datasheets — **except for membranes**, whose `category` and
`air_permeance_l_s_m2_at_75pa` are carried explicitly (see below), because
losing the category would turn an imported WRB back into an ordinary layer
that demands a conductivity it does not have.

**Membrane layers and the air-barrier designation** ride the construction's
`ph_nav` block rather than `materials[]` (see `envelope-hbjson-export.md`).
Import splices membranes back at their recorded `outside_index` — *before* the
orientation reversal, since those indices are outside→inside — and re-points
the air-barrier designation at whatever layer id the rebuilt assembly minted.
A malformed or foreign `air_barrier` is dropped rather than raised: import is
forgiving, and losing an annotation beats failing the construction.

**A PH-Navigator for SketchUp file** carries the block on the construction
only, so its *materials* have no `ph_nav`. Membrane layers keep their
`lyr_`/`seg_` ids (they ride inside the construction block), thermal layers get
freshly minted ones, `is_continuous_insulation` is lost, and an air-barrier
designation survives only when it points at a membrane layer. Adding a
per-material `user_data["ph_nav"]` on that side would close all of it with no
change here — the reads are already in place.

## Rejections (typed 422 unless noted)

`import_invalid_json` · `import_wrong_file_type` (not native, and not a
recognizable honeybee construction) · `import_invalid_file` ·
`import_no_constructions` (a model with no opaque constructions) ·
`import_schema_too_new` · `import_unsupported_divisions` (multi-row grid) ·
`import_missing_cell_material` · `import_unsupported_layer_type` (a layer
material with no thickness) · `import_material_unresolved` (an abridged layer
naming a material the file lacks) · `import_file_too_large` (413). Import does
**not** block on thermal incompleteness — incomplete assemblies are legal in
a draft and surface in the preview, not as errors. In a **foreign** file every
per-construction failure above is reported as one skipped row carrying that
same code in `unsupported`, instead of a 422, so one unreadable construction
never rejects the file.

## Frontend

The "Upload constructions HBJSON" menu item (editor-only) on Envelope →
Assemblies drives this: `useEnvelopeHbjsonImport` reads the file and calls the
preview route, `ImportConstructionsDialog` shows the plan and lets the user
override each construction's action (Add new / Replace / Skip — Replace only
when the file matched an existing assembly; a row carrying `unsupported` shows
its reason and no control), and confirming fires the
`import_envelope_constructions` command (with the chosen `resolutions`) on the
existing envelope-command rail. See `frontend/src/features/envelope/`
(`hooks/useEnvelopeHbjsonImport.ts`,
`components/dialogs/ImportConstructionsDialog.tsx`).

## See also

- `context/technical-requirements/envelope-hbjson-export.md` — the format
  this reverses, including the additive `ph_nav` round-trip fields.
- `planning/features/envelope-hbjson-import/` — PRD, decisions, phases.
