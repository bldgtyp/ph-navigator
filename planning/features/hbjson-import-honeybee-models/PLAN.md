---
DATE: 2026-09-10
TIME: 12:42 EDT
STATUS: Implemented on branch (2026-09-10)
AUTHOR: Claude (with Ed May)
SCOPE: Implementation sequence for honeybee `Model` HBJSON import
RELATED: README.md, PRD.md, STATUS.md
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/92
---

# Implementation plan

All parser work is in the **foreign** branch of
`backend/features/envelope/hbjson_import.py`. The native
`PHNavigatorOpaqueConstructionLibrary` branch keeps its current behavior:
every new read is a *fallback* behind the existing one, so a native file takes
the same path it takes today and the round-trip tests are the regression net.

Branch: `feature/hbjson-import-honeybee-models` from `main`.

## Change 1 — abridged constructions (`hbjson_import.py`)

`_foreign_constructions`, `Model` branch: build
`{identifier: material_dict}` from `properties.energy.materials`, then accept
`OpaqueConstructionAbridged` alongside `OpaqueConstruction` and replace each
string entry in `materials[]` with the resolved dict. An unresolvable
identifier makes that construction *skipped* (change 5), not a file error.
`_opaque_from_list` grows the materials map as an argument; the group and
single-object branches pass an empty map, so an abridged construction outside
a `Model` has nothing to resolve against and is skipped by the same rule.

## Change 2 — `ph_nav` from `user_data` (the filed issue)

One helper, five call sites:

```python
def _ph_nav(payload: dict[str, Any]) -> dict[str, Any]:
    """The additive PHN block: the download format's own key, or the slot a
    honeybee Model preserves (`user_data`), which is where PH-Navigator for
    SketchUp writes the same block."""
    return _as_dict(payload.get("ph_nav")) or _as_dict(_as_dict(payload.get("user_data")).get("ph_nav"))
```

Replaces the reads in `_parse_construction`, `_parse_homogeneous_layer`,
`_parse_hybrid_layer` (cell and parent) and `_register_material`. Nothing
else about those functions changes: the block's field names and shapes are
identical on both sides (verified against `phn_assemblies.py::_side_channel`
and `_membrane_material`, and against the SketchUp `attrs.rb` vocabularies —
`assembly_type`, `orientation`, `exterior_condition` and `air_barrier`'s
`{layer_id, face}` all match this repo's `Literal`s exactly).

## Change 3 — honeybee-PH division cells

`_parse_hybrid_layer`: read a cell's width from its own `column_width` when
present, else from the grid's `column_widths[cell["column"]]`. Keep only
`row == 0` cells (the multi-row rejection stays as the guard it is today).
A cell with neither width source is a skipped construction, not a file error.

## Change 4 — grid-level steel-stud spacing

Same function: when a cell's `ph_nav` carries no `steel_stud_spacing_mm`,
fall back to the grid's. Applying a per-layer value to every segment is a
deliberate approximation (PRD D2), so the construction carries a
`steel_stud_spacing_from_grid` warning into the preview.

## Change 5 — a construction may be skipped without failing the file

- `ImportParseError` gains nothing; instead `_parse_construction` is called
  per construction inside a `try` in the **foreign** branch only. A failure
  becomes `SkippedConstruction(resolution_key, name, reason)`.
- New dataclass `SkippedConstruction` and a `skipped: list[SkippedConstruction]`
  field on `ParsedConstructionLibrary`.
- Explicit detection ahead of the generic catch: a layer material of any type
  other than `EnergyMaterial` (`EnergyMaterialNoMass` is the one that arrives
  in practice) is recognized and reported as
  `construction_unsupported_layer_type` rather than as a missing dimension.
  Reason codes: `construction_unsupported_layer_type` ·
  `construction_material_unresolved` · `construction_unreadable`.
  (The code was named `construction_unsupported_no_mass_layer` when this plan
  was written; the type check is what the parser can actually assert, and the
  name follows it.)
- The native branch keeps raising: a native file that will not parse is a
  defect in this app, and a 422 is the honest answer.

## Change 6 — plan, contract, and dialog

- `import_planning.py`: emit one `ConstructionPlanItem` per skipped
  construction, `action="skip"`, `unsupported=<reason code>`,
  `warnings=[<reason code>]`; count it in `counts.constructions_skip`.
  A `resolutions[]` entry naming a skipped key stays a no-op (skipped
  constructions never enter the IR list the planner builds assemblies from),
  which is what keeps the apply path from minting a zero-layer `Assembly`.
- `import_models.py`: additive `unsupported: str | None = None` on
  `ConstructionPlanItem` (PRD D1).
- `frontend/src/features/envelope/types.ts`: the same optional field.
- `ImportConstructionsDialog.tsx`: when `unsupported` is set, render the
  reason in place of the action control (the row already renders
  `RowWarnings`).
- `import-labels.ts`: labels for the three reason codes and for
  `steel_stud_spacing_from_grid`.
- Foreign-material dedup (PRD D3): `_register_material` keys a material with
  no `ph_nav.project_material_id` on its value identity —
  `normalize_display_name(display_name)` plus conductivity, density, specific
  heat, emissivity and color — instead of `__anon__<identifier>`. Thickness
  stays out of the key; it belongs to the layer.

## Tests

`backend/tests/envelope/test_envelope_hbjson_import.py`, one focused test per
stated behavior, fixtures built from **honeybee's own serializers**
(`OpaqueConstruction.to_dict(abridged=True)` plus
`[m.to_dict() for m in construction.materials]`) so the shapes cannot drift
from what honeybee writes. Synthetic values only; no host-gate artifact and
nothing PHI/Phius-derived enters the repo.

1. An abridged `Model` imports its constructions with the materials resolved.
2. A construction's `ph_nav` read from `user_data` restores assembly type,
   orientation, exterior condition, air barrier and spliced membranes.
3. A honeybee-PH division grid imports segment widths from `column_widths`.
4. Grid `steel_stud_spacing_mm` reaches the segments and warns.
5. A no-mass sandwich is one skipped plan item; a sibling construction in the
   same file still imports.
6. An abridged construction naming a material the model does not carry is
   skipped, not fatal.
7. Two layers of the same material in a foreign file produce one incoming
   material.
8. Regression: the native round-trip tests are untouched and still pass.

Frontend: one `ImportConstructionsDialog` test that an `unsupported` row shows
its reason and offers no action control.

## Docs

- `context/technical-requirements/envelope-hbjson-import.md`: the honeybee
  `Model` shapes accepted (abridged + material resolution), the `user_data`
  fallback, the division-cell shapes, the per-construction skip rule and its
  reason codes, and the foreign dedup key. Add a line to the round-trip
  fidelity section for what a SketchUp file loses (PRD "Known fidelity
  limits") and why.
- `context/ui/pages/envelope-tab.md`: one line for the unsupported row.

## Verification

1. `make ci` from the repo root.
2. Re-run the scratch parse against the three private SketchUp host-gate
   artifacts (`ph-navigator-sketchup/_private/assembly-builder/phase6/`,
   read in place, never copied into this repo) and confirm the wall artifact
   parses with membranes, framed widths and air barrier, and that the
   declared-U artifact yields exactly one skipped construction.
3. Browser check per `context/USING_A_WEB_BROWSER.md`: upload a synthetic
   honeybee `Model` fixture through Envelope → Assemblies and confirm the
   preview renders the unsupported row and imports the rest.
4. Closeout gate from `CLAUDE.md`: `simplify`, `docs-pass`, `make format`,
   `make ci`.

## Risks

- **Silent behavior change on foreign imports.** Changes 5 and 6 turn some
  files that used to 422 into partial imports. That is the intent, but it
  means a user can no longer tell "nothing imported" from "most of it
  imported" without reading the preview. The unsupported row is the mitigation
  and is why D1 favors a visible row over a plan-level warning.
- **Dedup by value identity** (D3) collapses two distinct foreign materials
  that share a name and every thermal property. Accepted: they are
  indistinguishable to this app.
- **The division-cell divergence stays.** Two shapes now have to be read
  forever. The comment in `_parse_hybrid_layer` should say which producer
  writes which, so the next reader does not "clean up" one of them.
