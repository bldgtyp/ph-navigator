---
DATE: 2026-06-23
TIME: 18:00 EDT
STATUS: DONE (2026-06-23)
AUTHOR: Ed (via Claude)
SCOPE: Phase 1 — backend native HBJSON construction import (PHN-native files).
---

# Phase 1 — Backend native import front-end

Reverse `hbjson_export.py` for `PHNavigatorOpaqueConstructionLibrary` files,
match materials (ladder rungs 1–3 & 6), and apply through the existing
envelope-command pipeline behind a preview → confirm flow.

## Concrete design calls (resolving PRD/decisions for this phase)

- **D3 → pick from catalog (current values).** A resolvable `catalog_record_id`
  re-picks via `project_material_from_catalog(row)` (snapshot current catalog
  values), not the file's embedded values.
- **D5 → replace-by-id default.** `ph_nav.assembly_id` matching an existing
  assembly defaults to **replace**; otherwise **add new** with the name
  auto-suffixed on collision (`next_unique_name`). Per-construction override
  (add_new / replace / skip) is carried in the command.
- **D7 → status policy.** reuse: untouched · pick-from-catalog: `missing` ·
  create-new: file's `ref_status` if a valid `SpecificationStatus`, else
  `missing`.
- **D8 → current draft.** Applied through `…/draft/envelope/commands`; user
  Saves a Version as normal.

## Material matching ladder (Phase 1 rungs)

Run per deduped incoming material (deduped by `ph_nav.project_material_id`):

1. **reuse_project_material** — `project_material_id` exists in the body.
2. **reuse_catalog_in_project** — exactly one existing project material shares
   the incoming `catalog_origin.catalog_record_id`. >1 ⇒ `conflict_ambiguous`.
3. **pick_from_catalog** — `catalog_record_id` resolves to an active
   `catalog_materials` row ⇒ `project_material_from_catalog(row)`. Resolvable
   but inactive/missing ⇒ falls through to create-new with a warning.
4–5. name/property matches — **deferred to Phase 2**.
6. **create_new** — hand-entered project material, `catalog_origin=null`,
   copies the file's thermal props + color; `category` defaults to `"Other"`
   (not exported); status per D7; `datasheet_asset_ids` dropped (project-scoped
   asset ids do not cross the import boundary safely).

## Export round-trip completion (folded in)

Import revealed the export still drops per-segment `steel_stud_spacing_mm` (it
only emits a collapsed divisions-level value). Added per-segment
`steel_stud_spacing_mm` to the homogeneous material `ph_nav` and each hybrid
cell `ph_nav` so the reuse path round-trips losslessly. This is pure data
preservation and is orthogonal to the deferred steel-stud *semantics* (Q-AB-1).

## New backend surfaces

- `hbjson_import.py` — IR + `parse_construction_library(raw)`; structured
  `ImportParseError` for wrong type / bad JSON / schema too new / multi-row
  divisions / missing cell material.
- `import_planning.py` — `build_import_plan(conn, body, library, resolutions)`
  → preview summary **and** the resolved next `ProjectDocumentV1` (one function,
  two consumers).
- `import_models.py` — `ConstructionResolution` (command input) + preview
  response models.
- `commands/envelope_import.py` — `import_envelope_constructions` handler;
  registered in the command registry; `ImportEnvelopeConstructionsCommand` added
  to the `EnvelopeCommand` union.
- Route `POST …/envelope/import/hbjson/preview` (multipart, `ProjectEditAccess`)
  → dry-run plan. Apply reuses `…/draft/envelope/commands` with the new kind.

## Atomicity

Parse + match + validate the whole file, then one
`replace_project_materials` + one `replace_assemblies` (materials first so
assemblies validate against present ids). Import does **not** block on thermal
incompleteness — incomplete assemblies are legal in a draft.

## Out of scope (this phase)

Foreign honeybee-ph files (Phase 2); name/property matching (Phase 2);
per-material override in preview (Phase 4); frontend (Phase 3).
