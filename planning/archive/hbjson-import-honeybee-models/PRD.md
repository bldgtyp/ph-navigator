---
DATE: 2026-09-10
TIME: 12:42 EDT
STATUS: Complete
AUTHOR: Claude (with Ed May)
SCOPE: Behavior contract for importing a honeybee `Model` HBJSON into Envelope → Assemblies
RELATED: README.md, PLAN.md, context/technical-requirements/envelope-hbjson-import.md
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/92
---

# Product contract

A consultant who builds assemblies in **PH-Navigator for SketchUp**, exports
the model's HBJSON, and uploads it on Envelope → Assemblies gets the same
preview → confirm plan the native download already produces: the assemblies
land with their type, orientation, exterior condition, layers, framed-layer
segments at their real widths, membranes at their recorded positions, and the
air-barrier designation. A construction PH-Navigator cannot represent is named
in the preview and skipped; it never fails the file.

The same work fixes the raw honeybee-PH path for every other producer:
Grasshopper (`honeybee_grasshopper_ph`), designPH, and any honeybee model
written by `Model.to_dict()`.

## What is broken today (tested 2026-09-10)

Method: `parse_construction_library` run directly against three
PH-Navigator for SketchUp phase-6 host-gate artifacts (private,
`ph-navigator-sketchup/_private/assembly-builder/phase6/`; nothing from them
is reproduced here or in tests). Each gap was isolated by normalizing the
previous one by hand in a scratch script and re-parsing.

| # | Gap | Observed | Cause |
| --- | --- | --- | --- |
| 1 | Abridged constructions | all three files → 422 `import_no_constructions` | `Model.to_dict()` writes `properties.energy.constructions[]` as `OpaqueConstructionAbridged`, whose `materials` is a list of **identifier strings**, with the full material dicts in a sibling `properties.energy.materials[]`. `_opaque_from_list` accepts only `type == "OpaqueConstruction"`, so it sifts zero constructions (`honeybee_energy/properties/model.py`, `construction/opaque.py::to_dict`). |
| 2 | Division-cell shape | after de-abridging by hand → 422 `import_invalid_file` "A dimension is missing or non-positive" | honeybee-PH's canonical cell is `{row, column, material}`, with per-column widths on the grid's `column_widths` and one `steel_stud_spacing_mm` on the grid (`honeybee_ph/honeybee_energy_ph/properties/materials/opaque.py`). PHN's own download format writes `{column_width, row_height, material, ph_nav}` per cell, and `_parse_hybrid_layer` reads only that. Any framed layer therefore fails the whole file. |
| 3 | `ph_nav` location (the filed issue) | membranes, assembly id, type, orientation, exterior condition and air barrier all default | a honeybee `Model` preserves only `user_data`, so the SketchUp export writes the same block, same shape, at `construction.user_data["ph_nav"]` with `"source": "ph-navigator-sketchup"`. `_parse_construction` reads only the top-level `ph_nav` key. |
| 4 | No-mass layers | 422 `import_invalid_file` on the whole file | a declared-U assembly is a 10 mm λ 100 shell + `EnergyMaterialNoMass` + shell sandwich (SketchUp `phn_assemblies.py::_declared`, and the same shape from `honeybee_grasshopper_ph/.../assmbly_create_sd_const.py`). `EnergyMaterialNoMass` has no `thickness`, so `_meters_to_mm` raises and one unrepresentable construction takes the file with it. |

With those four normalized in a scratch script, the SketchUp wall artifact
parses cleanly: four thermal layers outside to inside, the framed layer's
three segments at 368 / 1000 / 38 mm, the membrane spliced at its recorded
index, `asm_`/`lyr_`/`seg_` ids preserved where the file carries them, and the
air-barrier designation intact. The declared-U artifact reduces to one skipped
construction.

## Known fidelity limits of a SketchUp file (not defects to fix here)

The SketchUp side writes the side channel on the construction only, so its
**materials** carry no `ph_nav`. Consequences, all visible in the tested parse:

- Thermal layers and their segments get freshly minted `lyr_`/`seg_` ids
  (membrane layers keep theirs: they ride inside the construction block).
- The air-barrier designation survives only when it points at a **membrane**
  layer, because `_rebuilt_air_barrier` remaps through `source_layer_id`.
  A designation on a thermal layer is dropped silently.
- One project material used in several layers arrives as several incoming
  materials (the dedup key falls back to `__anon__<identifier>`, and honeybee
  identifiers are per-layer), so it can create duplicate project materials.
- `is_continuous_insulation` is lost; steel-stud spacing survives only at
  grid level, which is per-layer, not per-segment.

Change 2 in [`PLAN.md`](PLAN.md) reads `user_data["ph_nav"]` on **materials
and cells too**, not just constructions. That is the whole web-side fix: if
`ph-navigator-sketchup` later adds a per-material block carrying
`project_material_id`, `layer_id`, `segment_id`, `is_continuous_insulation`
and `steel_stud_spacing_mm`, every limit above closes with no further change
here. See decision D4.

## Acceptance

1. A honeybee `Model` dict whose constructions are abridged imports: each
   `OpaqueConstructionAbridged` resolves its layers against
   `properties.energy.materials` by identifier. A material identifier with no
   match skips that construction (change 5), never the file.
2. A construction's `ph_nav` block is read from the top-level `ph_nav` key
   first and `user_data["ph_nav"]` second. The same rule applies wherever the
   importer reads a `ph_nav` block: layer materials and division cells.
   Native PHN files are byte-for-byte unaffected (they hit the first read).
3. A honeybee-PH division grid imports: segment widths come from the cell's
   own `column_width` when present, else from the grid's `column_widths[column]`;
   only `row == 0` cells are read; the existing multi-row rejection is unchanged.
4. Grid-level `steel_stud_spacing_mm` reaches the imported segments when no
   per-cell block carries one, with a preview warning that the spacing was
   read per layer rather than per segment (D2).
5. A construction carrying a layer material that is not an `EnergyMaterial`
   (`EnergyMaterialNoMass` above all), or any layer the parser cannot read,
   is reported as one skipped construction in the preview
   with a reason, and the rest of the file imports. Structurally invalid
   **native** `PHNavigatorOpaqueConstructionLibrary` files still 422 as they
   do today.
6. Incoming materials in a foreign file dedupe on their value identity
   (normalized name + conductivity + density + specific heat + emissivity +
   color) rather than on the honeybee identifier (D3).
7. The preview dialog shows a skipped-as-unsupported construction with its
   reason and no action control; confirming imports everything else.
8. `context/technical-requirements/envelope-hbjson-import.md` states the
   honeybee `Model` shapes accepted, the `user_data` fallback, and the
   per-construction skip rule.

## Out of scope

- Any change to `hbjson_export.py` or `gh_api/constructions_export.py`. The
  divergence between PHN's per-cell `{column_width, row_height}` and
  honeybee-PH's `{row, column}` stays; the importer accepts both. A follow-up
  issue can make the download format additively carry `row`/`column` so
  third-party honeybee tooling can read it.
- A declared-U assembly kind in the PH-Navigator document model. Until one
  exists, a declared-U construction is skipped with a reason, not
  approximated by an invented equivalent layer.
- Apertures, shades, window constructions, and anything else in a honeybee
  `Model` beyond opaque constructions.

## Decisions (accepted by Ed 2026-09-10)

D1, D2 and D3 are settled as recommended; the reasoning is kept because it is
what the implementation has to preserve. D4 is a note to the other repo.

- **D1 — how an unsupported construction appears.** **Accepted:** an additive
  `unsupported: str | null` on `ConstructionPlanItem`, action forced to
  `skip`, the dialog rendering the reason with no action control. `Assembly`
  requires `layers: min_length=1`, so an overridable skip would let a user
  produce a document-validation failure at apply. The lighter alternative is
  to drop the construction from the plan entirely and name it in the
  plan-level `warnings`; it needs no contract change but gives the user
  nothing to look at in the row list.
- **D2 — grid steel-stud spacing.** **Accepted:** apply it to every segment of
  that layer and warn. The field is carried metadata in PH-Navigator (it does
  not enter `thermal.py`; only `gh_api` collapses it back to one grid value),
  so a wrong per-segment attribution is visible and editable, while dropping a
  real 406 mm spacing is silent.
- **D3 — foreign material dedup key.** **Accepted:** dedupe on value identity.
  Two incoming materials with the same normalized name and the same thermal
  properties are the same material for PH-Navigator's purposes; thickness
  lives on the layer, not the material, so it must stay out of the key.
- **D4 — cross-repo follow-up.** Ask `ph-navigator-sketchup` to add the
  per-material `user_data["ph_nav"]` block described above. It is their side's
  choice and their phase; this packet does not wait for it and needs no
  further web change when it lands.
