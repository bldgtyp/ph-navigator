---
DATE: 2026-07-26
TIME: 12:15 EDT
STATUS: Phase 1 complete — Phases 2-4 pending
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers.
RELATED: ./README.md, ./PRD.md, ../assembly-condensation-risk/STATUS.md
---

# Status

## Phase log

| Phase | State | Notes |
| --- | --- | --- |
| **1** — category, air permeance, R exclusion | ✅ **DONE** 2026-07-26 | see below |
| **2** — membrane rendering + single-segment validation | ⏳ pending | |
| **3** — air-barrier designation + E2178 check | ⏳ pending | |
| **4** — export/import (`ph_nav` round-trip, PHPP drop) | ⏳ pending | |

### Phase 1 — what shipped

- **`membrane` catalog category.** Alembic `20260726_0009` widens the
  `ck_catalog_materials_category` CHECK (drop + re-add); the downgrade parks
  any `membrane` row under `finishes` rather than failing on live data.
  Threaded through `MATERIAL_CATEGORY_IDS`, the import label map, and the
  frontend category overlay (now thirteen options).
- **`air_permeance_l_s_m2_at_75pa`** on both `catalog_materials` (nullable
  column + non-negative CHECK) and the document's `ProjectMaterial`, plus the
  drift field keys, refresh choices, hand-enter / update commands, catalog
  import-export file format, and both editors.
- **New `air_permeance` unit quantity** (SI `L/(s·m²) @ 75 Pa`, IP
  `cfm/ft² @ 1.57 psf`, factor 0.196840) in the frontend picker, the backend
  validation allowlist, and `UnitQuantity`. The unit test asserts the
  0.02 SI ↔ 0.0039 IP criterion pair, which doubles as a check on the factor.
- **Membrane layers excluded from R.** `thermal.is_membrane_layer` gates
  `_valid_segments` and the `missing_conductivity` check. An assembly whose
  layers are *all* membranes reports the new `no_thermal_layers` flag instead
  of falling through to `invalid_geometry`.
- **`category` added to `thermal_input_hash`** — it now decides membrane-ness,
  so re-categorising a material must invalidate the cached preview.

**No document schema-version bump.** The new field is nullable with a `None`
default, so pre-existing bodies validate unchanged and no upgrade step is
needed; the fingerprint guard (`tests/project_document_schema/`) and the v7
corpus snapshot were regenerated, and the snapshot diff is purely the added
`"air_permeance_l_s_m2_at_75pa":null` key.

**Deliberately not in Phase 1:** HBJSON and PHPP export still treat a membrane
layer like any other, so a membrane exports with a null conductivity. That is
Phase 4's job (`PRD.md` §7), not an oversight.

### Phase 1 verification

`make format` clean; backend `ruff format --check`, `ruff check`,
`check_backend_boundaries`, `ty check`, `alembic upgrade head`, and
`pytest -n auto` (1490 passed, 7 skipped); frontend `format:check`, `lint`,
`check:all`, `pnpm test` (2262 passed), `pnpm build`. `make ci` itself cannot
run from a worktree — its `db-up` prerequisite collides with the shared
`phn-v2-postgres` container — so the recipe's steps were run individually
against the same test database.

## State

**PRD drafted. Phase 1 implemented.** Spun out of the `assembly-condensation-risk`
research on 2026-07-26 once it became clear that membranes dominate a wall's
vapour resistance and that PHN cannot represent them at all.

Established:
- Membranes are a prerequisite for a trustworthy condensation screen, with the
  sd arithmetic to prove it (`PRD.md` §1).
- The feature has standalone value independent of condensation — WRBs and vapour
  retarders are submittal-bearing products PHN cannot currently track (§2).
- Model settled as a **layer variant driven by a `membrane` material category**,
  not a new interface node type, with the rationale for rejecting the
  alternative (§3).
- One real interaction with existing code identified: membrane layers must be
  exempt from `thermal.py`'s `missing_conductivity` flag, or adding a WRB would
  break the U-value on every assembly it touches.

Resolved 2026-07-26 (Ed, second review) — **all four open questions closed**:
- **Membranes carry no thermal resistance at all.** Not "R ≈ 0" but excluded from
  the R calculation outright — the conservative treatment, numerically negligible
  (6-mil poly ≈ 0.00045 m²K/W, four orders below a typical assembly), and it
  matches PHPP, where membranes are not entered on the U-Values worksheet. So
  `conductivity_w_mk` is never required or used for them, and `_valid_segments` /
  `thermal_issues` must *skip* membrane layers rather than zero them.
- **New field: `air_permeance_l_s_m2_at_75pa`** (ASTM E2178, the value on WRB
  datasheets). Lives on materials generally, not just membranes — closed-cell
  spray foam, XPS, and taped sheathing are air barriers too. It pairs with the
  air-barrier designation to give a real check: designated face vs the
  0.02 L/(s·m²) @ 75 Pa material criterion. It does **not** feed condensation.
- **Correction to a same-day decision:** Q-M1's "export as a thin
  `EnergyMaterial`" is superseded. Removing the conductivity made that payload
  invalid (`EnergyMaterial` needs a positive one), so membranes are omitted from
  the HBJSON construction entirely and carried in the `ph_nav` extension block to
  keep PHN → HBJSON → PHN round trips lossless.
- Air barrier modelled as a **face annotation** on the assembly, explicitly
  outside the condensation math (§5).

## Next step

**Phase 2** — membrane layer rendering (fixed hairline instead of 1:1 scale,
distinct solid/dashed treatment), single-segment validation, and the
layer-height modal's "not drawn to scale" copy.

## Dependencies

- **Blocks:** `assembly-condensation-risk` Phase 2 (the engine). Phases 1–2 here
  are the gate.
- **Shares:** the `vapor_sd_equivalent_m` material field defined in
  `../assembly-condensation-risk/PRD.md` §4. Whichever feature ships first
  should land that field; the other consumes it. **Phase 1 did not land it** —
  the phase table scopes Phase 1 to `air_permeance_l_s_m2_at_75pa` only, so the
  sd field is still unclaimed by either feature. Adding it is now a
  well-trodden path: `air_permeance_l_s_m2_at_75pa` in commit history is a
  complete worked example of threading one nullable material field end-to-end.

## Blockers

**None.** All four open questions were resolved 2026-07-26 (Ed) before Phase 1;
nothing surfaced during implementation that reopens one.

| # | Question | Resolution |
| --- | --- | --- |
| ~~Q-M1~~ | Massless Honeybee material round-trip? | ✅ omit membranes from the HBJSON construction; carry in `ph_nav` for lossless round-trip |
| ~~Q-M2~~ | Do membranes need an R field? | ✅ no — **omit from R entirely**; plus **new `air_permeance_l_s_m2_at_75pa` field** |
| ~~Q-M3~~ | One `membrane` category or subdivided? | ✅ one |
| ~~Q-M4~~ | Separate `coating` category for paints? | ✅ no — same category |

## Verification

Phase 1 gate met, and tightened past what this section originally asked for:
adding a membrane layer leaves the Effective U-Value **byte-identical** (not
"changed only by a near-zero R") and raises no `missing_conductivity` flag —
`PRD.md` §9 criterion 1, covered by
`test_membrane_layer_leaves_thermal_result_exactly_unchanged`. Criterion 1a is
covered by `test_membrane_only_assembly_reports_no_thermal_layers_not_a_zero_divide`.
