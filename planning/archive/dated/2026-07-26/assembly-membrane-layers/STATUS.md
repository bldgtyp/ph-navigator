---
DATE: 2026-07-26
TIME: 12:15 EDT
STATUS: All four phases complete
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers.
RELATED: ./README.md, ./PRD.md, ../../../../features/assembly-condensation-risk/STATUS.md
---

# Status

> **Superseded in part, 2026-07-27.** Phase 2's rendering was reworked the day
> after this packet was archived: a membrane now gets a reserved 14 mm band
> (`MEMBRANE_BAND_HEIGHT_MM`) drawn as a full-width rule, instead of a 4 mm
> hairline rect. That deleted `canvas-hit-box.ts`, `canvasHitBox`,
> `MEMBRANE_DISPLAY_THICKNESS_MM`, `MEMBRANE_MIN_HIT_HEIGHT_PX`, and the
> `hitRoomAbove/BelowMm` geometry fields — **all named below no longer exist**.
> Reserving real drawing space made non-overlap structural, so none of the
> hit-box negotiation described in this file survives.
>
> That rework also found the real cause of the click theft this packet fought:
> the global `button { min-height: var(--phn-control-height) }` in
> `styles/base.css` forced *every* segment hit target to 38 px regardless of
> its layer, so thin layers stole clicks from the layers below. The membrane
> `z-index` bump recorded here had been masking it. See
> `context/ui/pages/envelope-tab.md` and `context/DESIGN_SYSTEM.md` for current
> behaviour; the account below stands as the record of what shipped on 07-26.

## Phase log

| Phase | State | Notes |
| --- | --- | --- |
| **1** — category, air permeance, R exclusion | ✅ **DONE** 2026-07-26 | see below |
| **2** — membrane rendering + single-segment validation | ✅ **DONE** 2026-07-26 | see below |
| **3** — air-barrier designation + E2178 check | ✅ **DONE** 2026-07-26 | see below |
| **4** — export/import (`ph_nav` round-trip, PHPP drop) | ✅ **DONE** 2026-07-26 | see below |

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
  `cfm/ft² @ 1.57 psf`) in the frontend picker, the backend validation
  allowlist, and `UnitQuantity`. Its factor is *composed* from the existing
  flow and area conversions rather than typed as a literal — the first draft
  hand-entered 0.19684 and was wrong in the fifth digit (0.1968504). The unit
  test asserts the published 0.02 SI ↔ 0.0039 IP criterion pair, which
  double-checks it.
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

### Phase 2 — what shipped

- **The predicate moved to its own module.** `backend/features/envelope/membranes.py`
  now owns `is_membrane_material` / `is_membrane_layer`; `thermal.py` and
  `commands/layers.py` both consume it, so the R exclusion and the
  single-segment rule cannot disagree about what a membrane layer is.
- **Single-segment validation, on both directions of travel.** `add_segment`
  returns 409 `membrane_layer_single_segment` on a membrane layer, and
  `assign_segment_material` refuses to put a membrane into a layer that is
  already split. The section hides the ⊕ affordance so the user is never
  offered an action that would fail.
- **Hairline rendering.** `buildAssemblyCanvasGeometry` substitutes a fixed
  nominal drawn thickness (`MEMBRANE_DISPLAY_THICKNESS_MM`) for membrane
  layers. Because the substitution happens in the geometry, the y-stacking,
  the SVG rects, and the overlay hit targets all agree without any of them
  knowing about membranes. The layer's real `thickness_mm` is untouched and
  remains what the dimension column and Total Thickness report.
- **The section dialog drops width and steel-stud** for membrane segments and
  says why; the thickness control is labelled "not drawn to scale".

**Three defects the first cut had, none of them caught by the tests that
were passing at the time:**

1. **The band was unclickable.** Found by opening it in a browser: ~4 px is
   legible but too small to hit, and the neighbouring 140 mm layer's overlay
   won every click, so the membrane was visible and unreachable. Rendering a
   thing small and making it usable are two separate problems.
2. **Two adjacent membranes stole each other's clicks.** Found in review, once
   the fix for (1) existed. Both boxes expand, both are raised the same
   stacking step, and paint order alone decided which one a click selected —
   at 0.5× zoom the overlap is most of the target. A dedicated air barrier
   stacked onto a WRB is a real assembly, not a contrivance.
3. **The single-segment rule had a back door.** Guarding `add_segment` was
   not enough, because a layer becomes a membrane layer by *material
   assignment*: assign a membrane to each segment of an ordinary two-segment
   layer and you land a two-segment membrane layer through the normal picker —
   and the section then hides the width controls, so the widths that no longer
   mean anything can no longer be fixed either.

The fixes: `canvasHitBox` (shared by the segment overlay and the dimension
cell) grows a membrane's box to a clickable minimum but never past an edge
shared with another membrane, which the geometry reports as
`hitRoomAbove/BelowMm`; and `require_single_segment_for_membrane` moved the
rule to `assign_segment_material`, the one chokepoint every assignment path
goes through, with `add_segment` keeping its own guard for the other direction.

### Phase 2 verification

Backend `ruff`/`ty`/`pytest`; frontend `tsc`, `lint`, `check:all`, `vitest`,
`build`. Browser-verified against a purpose-built six-layer wall (gypsum /
poly VB / stud cavity / plywood / WRB / cladding) on the `AGENT-BROWSER`
fixture, which confirmed all four of PRD §9's Phase-2-relevant criteria:
both membranes drew at the nominal height with `is-membrane` while every
other layer stayed 1:1; Total Thickness read 185.7 mm (membranes counted);
the U-value computed at 0.337 W/(m²K) with **no** `missing_conductivity`
despite both membranes having null conductivity; add-segment controls were
present on all five ordinary segments and on neither membrane; and the
membrane's Segment-properties dialog showed the note and the air-permeance
value with no width or stud controls, while an ordinary segment kept both.
The fixture was reset afterwards.

## State

**PRD drafted. All four phases implemented.** Spun out of the `assembly-condensation-risk`
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

### Phase 3 — what shipped

- **`Assembly.air_barrier: {layer_id, face} | None`** on the document, with a
  validator rejecting a designation that points at no layer of the assembly —
  a dangling one would render nothing and silently mislead. `delete_layer`
  clears the designation rather than blocking the delete or leaving the
  document invalid.
- **One command, `set_assembly_air_barrier`,** does both set and clear
  (`air_barrier: null`), so the control is a single toggle rather than a pair.
- **`envelope/air_barrier.py`** derives the ASTM E2178 verdict on the
  designated face and returns it as read-only `air_barrier_status` on the
  assembly. Three states, and **`unknown` is deliberately distinct from
  `pass`** (PRD §9 criterion 5a): a face with no recorded permeance has not
  been shown to qualify, and implying otherwise is the exact failure the check
  exists to prevent. On a split face the *leakiest* material governs — air
  finds the worst path — and one unrecorded material is enough to withhold a
  pass for the whole face.
- **A bold continuous rule on the designated face** in the section. The face
  is orientation-relative, not top/bottom: under `last_layer_outside` a
  layer's exterior face is its *bottom* edge, under `first_layer_outside` its
  top. Both directions are pinned by test, because getting it backwards draws
  a confidently wrong drawing.
- **The control lives in the Segment Properties dialog** as a layer-scoped
  section — the place you already land when you click into a layer. Copy says
  plainly that the designation feeds neither the thermal nor the condensation
  calculation, per PRD §5's constraint that the UI must not imply otherwise.

### Phase 3 verification

Full backend and frontend gates. Browser-verified on the same six-layer wall:
designating the WRB's exterior face drew the rule at y=172.7 in the section —
exactly the WRB's bottom edge, which is the exterior face under
`last_layer_outside` — and the dialog reported "Meets the ASTM E2178
air-barrier material criterion (0.0012 vs 0.02 L/(s-m2) @ 75Pa)". Fixture
reset afterwards.

**Deliberately not built:** the full "perfect wall" four-control-layer set
(water / air / vapour / thermal). The same annotation pattern extends to them
cleanly, but one designation at a time (PRD §5).

### Phase 4 — what shipped

- **HBJSON omits membranes from the construction.** An `EnergyMaterial`
  requires a positive conductivity and membranes deliberately have none, so
  emitting one was never valid — the export just hadn't noticed yet.
- **They ride `ph_nav.membrane_layers` instead**, each with the
  `outside_index` it occupies in the *full* outside→inside layer list, so the
  importer splices them back without depending on how many were dropped
  before it. `category` and `air_permeance_l_s_m2_at_75pa` have no honeybee
  home at all; this block is the only thing keeping them across a round trip.
- **The air-barrier designation round-trips too**, re-pointed at whatever
  layer id the rebuilt assembly minted (`_safe_id` can mint a fresh one, and a
  designation aimed at a stale id would fail the document validator). A
  malformed designation is dropped rather than raised — import is forgiving by
  design, and losing an annotation beats failing the construction.
- **PHPP drops membranes from the U-Values rows deliberately**, recorded on
  `dropped_membrane_layer_ids` rather than left silent. The 8-row budget is
  counted *after* the drop, so a WRB can no longer push a real eight-layer
  assembly over the limit; Total Thickness still reports the physical
  assembly.

**Five defects, four of them found in review rather than by the passing tests:**

1. **An all-membrane assembly produced a blank CSV labelled "exportable"** — it
   resolved to a single 100 % section with zero rows. Now fails with a new
   `no_thermal_layers` export reason that says why.
2. **The air barrier was exported and never read back**, so the round trip this
   phase exists to guarantee lost it. Now restored, and re-pointed at whatever
   layer id the rebuilt assembly minted.
3. **The fix for (2) broke every multi-layer foreign import.** Memoizing minted
   layer ids by `source_layer_id` collapsed them onto one id when that id is
   `None` — which it is for *every* layer of a raw honeybee construction — so
   the uniqueness validator rejected the assembly. Only single-layer foreign
   fixtures existed, so nothing caught it. **The first attempt at this fix also
   silently didn't apply** (the formatter had reflowed the line being matched);
   the new regression test is what surfaced that.
4. **A negative `outside_index`** was read as Python's own insert-before-the-end
   and landed the layer mid-stack instead of prepending. Now clamped at both ends.
5. **A membrane with no recorded name dropped its whole layer** — thickness,
   position and all — silently. It now falls back to a placeholder name and
   keeps the layer.

The recurring lesson, and the one worth carrying forward: every place that
assumed "layers" and "layers with an R-value" were the same set needed
revisiting once membranes existed, and the passing tests said nothing about
any of it.

### Phase 4 verification

Full backend and frontend gates. Round-trip coverage in
`tests/envelope/test_envelope_membrane_exports.py`: membranes restored in
order and at the right indices, in **both** orientations (`materials[]` is
canonically outside→inside, so the flip has to survive the splice); the
air-barrier designation restored; a malformed one dropped; the PHPP drop
recorded; and eight real layers plus membranes still exporting.

## Next step

**None — the feature is complete.** Possible follow-ups, none of them
committed to:

- ~~The `vapor_sd_equivalent_m` field is still unclaimed by either this feature
  or `assembly-condensation-risk`.~~ **Settled 2026-07-26:** the vapour field
  pair belongs to `assembly-condensation-risk` Phase 1, where its own `PRD.md`
  §4 and §8 already specify and schedule it. Nothing is owed from here.
- The "perfect wall" four-control-layer set (water / air / vapour / thermal
  designations) would extend the Phase 3 annotation pattern cleanly, but PRD
  §5 deliberately scoped this to one designation.

## Dependencies

- **Blocks:** `assembly-condensation-risk` Phase 2 (the engine). Phases 1–2 here
  were the gate, and both shipped 2026-07-26 — **this feature no longer blocks
  the condensation engine.** (Its other prerequisite,
  `assembly-boundary-conditions` Phase 1, is separate and still open.)
- **Shares:** the `vapor_sd_equivalent_m` material field defined in
  `../../../../features/assembly-condensation-risk/PRD.md` §4. Whichever feature ships first
  should land that field; the other consumes it. **This feature deliberately did
  not** — its phase table scoped Phase 1 to `air_permeance_l_s_m2_at_75pa` only.
  **Resolved 2026-07-26:** with membranes complete, the vapour pair
  (`vapor_diffusion_resistance_mu` + `vapor_sd_equivalent_m`) is unambiguously
  `assembly-condensation-risk`'s own Phase 1, per its `PRD.md` §4/§8. Adding it
  is a well-trodden path now: `air_permeance_l_s_m2_at_75pa` in commit history
  is a complete worked example of threading one nullable material field
  end-to-end.

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
