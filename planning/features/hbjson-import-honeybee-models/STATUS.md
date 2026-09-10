---
DATE: 2026-09-10
TIME: 12:42 EDT
STATUS: Implemented on branch `feature/hbjson-import-honeybee-models` (2026-09-10)
AUTHOR: Claude (with Ed May)
SCOPE: State ledger for the honeybee `Model` HBJSON import packet
RELATED: README.md, PRD.md, PLAN.md
ISSUE: https://github.com/bldgtyp/ph-navigator/issues/92
---

# Status

**Implemented on branch** `feature/hbjson-import-honeybee-models`
(2026-09-10). All six changes in [`PLAN.md`](PLAN.md) are in, with the
contract doc and the page doc updated. D1, D2 and D3 were accepted as
recommended (see [`PRD.md`](PRD.md) § Decisions); D4 remains a note to the
SketchUp repo, not a blocker.

Three refinements came out of the `simplify` review and are worth knowing:

- **One code vocabulary.** A skipped construction's `unsupported` carries the
  parse error's own `import_*` code rather than a parallel `construction_*`
  set, and it is the only carrier of the reason (the row's `warnings` stay for
  real approximations).
- **Thickness, not a type allowlist.** A layer is refused when the material has
  no `thickness`, which is what actually blocks it. An allowlist on
  `EnergyMaterial` would also have refused `EnergyMaterialVegetation`, which
  has everything a layer needs.
- **A third id slot.** `properties.ref.external_identifiers.ph_nav` is read as
  a material id alongside `ph_nav.project_material_id`. Both PH-Navigator
  exporters already write it, so a file that went out through Grasshopper and
  came back keeps rung-1 material identity instead of falling to name matching.

## Next step

Ed's call: PR against `main` (`Closes #92`), then merge. Deploy is separate
and also Ed's. Archive the packet flat-by-slug after it lands.

## Blockers

None. Issue #92 says the SketchUp export lands first; it has (their phase 6
merged 2026-09-10, PR #47), so this side is unblocked.

## Diagnosis evidence (2026-09-10)

`parse_construction_library` run directly against three private
`ph-navigator-sketchup` phase-6 host-gate artifacts, read in place:

- All three → 422 `import_no_constructions` (abridged constructions).
- After hand-de-abridging: the framed-wall artifacts → 422
  `import_invalid_file` "A dimension is missing or non-positive"
  (honeybee-PH division cells carry no per-cell width).
- After hand-normalizing the cells and hoisting `ph_nav` out of `user_data`:
  the wall parses completely (four thermal layers, segments 368 / 1000 / 38 mm,
  membrane spliced at its recorded index, `asm_`/`lyr_`/`seg_` ids kept where
  present, air barrier intact).
- The declared-U artifact fails on `EnergyMaterialNoMass` (no `thickness`),
  which today takes the whole file down.

Source shapes confirmed at their definitions, not inferred:
`honeybee_energy/properties/model.py` and `construction/opaque.py::to_dict`
(abridged model serialization), `honeybee_ph/honeybee_energy_ph/properties/
materials/opaque.py` (`PhDivisionCell.to_dict` = `{row, column, material}`),
`ph-navigator-sketchup/.../phn_assemblies.py::_side_channel` and
`features/assemblies/attrs.rb` (block contents and enum vocabularies).

## Verification ledger

2026-09-10, local (Docker Postgres):

- `backend`: full suite 1,947 passed / 7 skipped before the review
  refinements; `tests/envelope` 308 passed; the import file 32 passed after
  them. `ruff check`, `ruff format --check`, `ty check` clean.
- `frontend`: `ImportConstructionsDialog` 6 passed; `tsc --noEmit` clean;
  `pnpm run lint` 0 errors / 18 warnings (the repo's existing baseline).
- Real files: the parser was run in place against the three private
  PH-Navigator for SketchUp phase-6 host-gate artifacts (never copied into
  this repo). The framed-wall model now parses completely — four thermal
  layers, segments at 368 / 1000 / 38 mm, 406 mm stud spacing on the framed
  layer with its warning, the membrane spliced at its recorded index with its
  own `lyr_`/`seg_` ids, air barrier intact, and the six honeybee materials
  collapsed to two products plus the membrane. The declared-U model yields
  exactly one skipped construction (`import_unsupported_layer_type`).
- `make ci`: green (exit 0) — backend 1,948 passed / 7 skipped, frontend 287
  files / 2,547 tests passed, ruff + ty + backend-boundary + the frontend
  design guards all clean.

Not done: the browser check of the preview dialog against a running app
(PLAN § Verification step 3). The dialog change is covered by its unit test;
run the browser pass before merge if you want the visual.
