---
DATE: 2026-07-26
TIME: 12:15 EDT
STATUS: Delivered — all four phases implemented 2026-07-26 (see ./STATUS.md)
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Membrane / sheet-good layers in the Assembly Builder (WRBs, vapour-control
  layers, coatings), plus an air-barrier designation on the assembly section.
RELATED: ./README.md, ./STATUS.md,
  ../../2026-07-29/assembly-condensation-risk/PRD.md (depends on this),
  context/ui/pages/envelope-tab.md, backend/features/project_document/envelope_models.py
---

# PRD — Membrane layers and air-barrier designation

## 1. Why this is a prerequisite, not a nicety

The vapour resistance of a wall is dominated by whatever its most vapour-tight
layer is, and that layer is almost always a membrane or a coating. A 2×6 wall,
in equivalent air-layer thickness (`sd = µ·d`):

| Layer | sd |
| --- | --- |
| Gypsum board 12.7 mm (µ 10) | 0.13 m |
| Mineral wool 140 mm (µ 1) | 0.14 m |
| Plywood sheathing 12 mm (µ 200) | 2.40 m |
| **Interior latex paint** (ISO 10456 Table 5) | **1.0 m** |
| **6-mil polyethylene** (ISO 10456 Table 5) | **50 m** |

The poly alone is ~95 % of the assembly's total sd. The *paint* is comparable to
the plywood. Neither can be represented in PHN today.

So a condensation screen run on assemblies that cannot hold membranes is not
merely incomplete — it is wrong in an unpredictable direction. Omitting an
interior vapour retarder overstates inward drying; omitting a vapour-tight
exterior sheathing membrane overstates outward drying. Either way the user gets a
confident-looking number computed from a wall that does not exist.

**`assembly-condensation-risk` Phase 2 (the engine) should not ship before this
lands.**

## 2. Standalone value (independent of condensation)

This is worth building even if the condensation screen never ships:

- **Specification tracking.** PHN tracks `specification_status`,
  `datasheet_status`, and datasheet assets per material. WRBs, vapour retarders,
  tapes, and self-adhered flashings are submittal-bearing products on every
  Phius job — and today they are literally unrepresentable, so they cannot be
  tracked, chased, or evidenced.
- **Accurate wall sections.** A section that omits the WRB and the VB is not the
  drawing anyone would issue.
- **Client and reviewer communication.** The air-barrier designation (§5) is a
  drawing convention architects already read.
- **HBJSON fidelity.** Honeybee models membranes as massless materials; our
  exports currently cannot express one.

## 3. Model: a layer variant, not a new node type

**Recommendation: add a `membrane` material category and treat a layer whose
material is a membrane as a rendering/resolution variant of the existing
`AssemblyLayer`. Do not introduce a new interface/interlayer node type.**

Considered and rejected — a distinct "interface" node attached *between* layers.
It is arguably the more honest physics (a membrane is a 2-D interface, has no
width segments, and sits exactly where Glaser evaluates condensation), but it
would need its own commands, its own ordering semantics against layers, its own
insert/drag UI, and threading through every serializer — a large change for
physics that layers already express. HBJSON, PHPP, and WUFI all model membranes
as ordered layers; matching that keeps every export path simple.

What the variant changes:

| Aspect | Normal layer | Membrane layer |
| --- | --- | --- |
| Segments | 1..n side-by-side | **exactly 1** (validated) — membranes are continuous |
| Rendering | height in px = thickness in mm (1:1) | **fixed hairline** (~3–4 px), distinct treatment (solid/dashed rule, not a hatched block) |
| Thickness | drives R and sd | real value stored and counted in total thickness; not drawn to scale |
| Vapour datum | `sd = µ · d` | **`vapor_sd_equivalent_m` directly** — the natural datum for sheet goods |
| Thermal | R = d/λ, blocked by `missing_conductivity` | **excluded from the R calculation entirely**; no conductivity required or used |

**Membranes carry no thermal resistance at all** — decided 2026-07-26 (Ed), as
the conservative treatment. The numbers back it: 6-mil polyethylene at
λ ≈ 0.33 W/mK and 0.15 mm gives R ≈ 0.00045 m²K/W, roughly four orders of
magnitude below a typical assembly's R. Omitting it is both simpler and
marginally conservative (slightly higher U), and it matches PHPP practice, where
membranes are not entered on the U-Values worksheet.

(I have not verified an explicit ISO 6946 prohibition on membrane layers and
won't claim one — the standard computes `R = d/λ` for each layer without a
special membrane provision. The justification here is numerical negligibility
plus conservatism, which stands on its own.)

Real interaction with existing code: `thermal.py:_valid_segments` drops any
segment whose material lacks `conductivity_w_mk`, and `thermal_issues` raises
`missing_conductivity`. Membrane layers must be **skipped by both** — not
"contribute zero", but excluded from iteration — so that adding a WRB neither
changes nor breaks the U-value on any assembly it touches.

Thickness is still stored and still counts toward Total Thickness: it is
physically real, costs nothing, and a section that silently under-measures is
worse than one carrying a sub-millimetre term. It is simply not drawn to scale
and not converted to R.

## 4. Data changes

- **Catalog category.** `catalog_materials` has a `CHECK` constraint enumerating
  categories (`insulation, finishes, woods, metals, masonry, stud_layers_steel,
  stud_layers_wood, air_*_heat_flow, rainscreen_insulation, doors`). Add
  `membrane`. Widening a CHECK enum is a safe, backwards-compatible migration
  (drop + re-add constraint); existing rows are untouched.
- **No R field for membranes** (Q-M2 resolved) — they are excluded from the
  thermal calculation, so `conductivity_w_mk` stays optional and unused for them
  and no new resistance field is added.
- **New: air permeance** (§4a).
- No change to `AssemblyLayer` / `AssemblySegment` schemas. "Is this a membrane
  layer?" is derived from the assigned material's category, so there is no new
  document field and no denormalized flag to keep in sync.

## 4a. Air permeance — a new material field

Ed's addition, 2026-07-26: record air permeability alongside the moisture data,
because it is the defining datum for air-barrier materials.

```
air_permeance_l_s_m2_at_75pa: float | None      # ≥ 0
```

**Why this shape.** The published test for building materials is **ASTM E2178**,
reported as air permeance in **L/(s·m²) at 75 Pa** — which is exactly what WRB
and air-barrier membrane datasheets carry, and exactly what the code criterion is
written against. Storing the tested product value keeps the catalog row aligned
with the datasheet, rather than an intrinsic permeability that nobody publishes.

- SI canonical `L/(s·m²) @ 75 Pa`; IP display `cfm/ft² @ 1.57 psf`
  (`1 L/(s·m²) = 0.1969 cfm/ft²`).
- The air-barrier **material** criterion is `≤ 0.02 L/(s·m²) @ 75 Pa`, which
  converts to `0.0039 ≈ 0.004 cfm/ft²` — matching the published IP threshold, a
  useful check that the conversion is right.
- Fully vapour/air-tight products (poly, foil, metal) are typically reported as
  "<0.0001" or effectively zero; store the reported figure, nullable when unknown.

**It belongs on materials generally, not just membranes.** Ed's earlier point
stands: the air barrier is often *not* a membrane — closed-cell spray foam,
XPS, taped sheathing, parged block all qualify. So the field goes on
`ProjectMaterial` / `catalog_materials` beside the vapour fields, same nullable
shape, same drift machinery.

**It does not feed the condensation calculation.** ISO 13788 ignores air leakage
entirely (`assembly-condensation-risk/decisions.md` §D-11). Its payoff is §5.

## 5. Air-barrier designation

Ed's observation is the important one: **the air barrier is sometimes a dedicated
membrane and sometimes the face of a material layer** — the interior face of
closed-cell spray foam, the exterior face of taped ZIP sheathing, parged block,
airtight drywall. So it is not a material property (the same XPS is the air
barrier in one assembly and not in another) and not really a layer property
either (it matters *which face*).

**Model it as an annotation on the assembly, pointing at a face:**

```
Assembly.air_barrier: { layer_id: str, face: "interior" | "exterior" } | None
```

One optional field, no new node type, no new commands beyond set/clear. Renders
as a bold continuous line on the section at exactly that face — the convention
architects already use.

**The payoff for §4a's air permeance:** once a face is designated as the air
barrier, the material at that face has a testable claim to check. If its
`air_permeance_l_s_m2_at_75pa` exceeds the ASTM E2178 material criterion
(0.02 L/(s·m²) @ 75 Pa), flag it — "the layer you designated as the air barrier
does not meet the air-barrier material criterion" is a real error caught at
design time. If the value is unknown, say so rather than implying it passes.

This is the pairing that makes both halves worth more than either alone: the
designation says *where*, the permeance says *whether*.

Two constraints on this:

1. **It does not feed the condensation calculation.** ISO 13788 explicitly
   ignores air leakage. The designation is a drawing and communication feature
   only, and the UI must not imply otherwise.
2. It is, however, worth pairing in copy: convective moisture transport through
   an air-barrier defect typically moves *more* moisture than diffusion does.
   The condensation modal's method-limits line should say so, right next to the
   assembly whose air barrier is now drawn.

**Deliberately not built:** the full "perfect wall" four-control-layer set
(water / air / vapour / thermal designations). The same annotation pattern would
extend to them cleanly, but one designation at a time.

## 6. Behaviour

- Adding a membrane uses the **existing** add-layer flow; it becomes a membrane
  because the assigned material's category is `membrane`. No new command, no
  separate "add membrane" affordance.
- The layer-height modal shows a nominal thickness for membranes and notes that
  it is not drawn to scale.
- The material picker groups `membrane` with the other categories; the segment
  properties modal hides width/steel-stud controls for membrane layers (they are
  always full-width, single-segment).
- Flip-orientation and flip-layers carry membranes along correctly — free,
  because they are layers.
- Air barrier is set from the section: click a layer face → "Mark as air
  barrier". Clearing is the same control.

## 7. Export and round-trip

- **HBJSON — membranes are omitted from the construction. Corrects the earlier
  Q-M1 resolution.** Last turn's answer was "export as a thin `EnergyMaterial`
  with real thickness and conductivity". Q-M2 removed the conductivity, and
  `EnergyMaterial` requires a positive one — so that answer no longer works.

  It also no longer *should*: membranes are now omitted from the R calculation,
  omitted from PHPP, and there is no place for them in HBJSON/PHX. Omitting them
  from the honeybee construction is the consistent choice, not a workaround.

  **Round-trip is preserved via the `ph_nav` extension block.** Export→import is
  a real path here (the tab offers "Upload constructions HBJSON", and the
  Rhino/GH loop is bidirectional), so silently dropping membranes would be data
  loss on a PHN → GH → PHN round trip. Carrying them as `ph_nav` metadata —
  which PHN already owns and honeybee/PHX already ignore — keeps the round trip
  lossless without putting anything invalid in the construction.
- **PHPP U-Values.** Membranes are conventionally not entered (≈0 R, and the
  worksheet has 8 slots). Recommend dropping them from that export deliberately,
  with the drop noted rather than silent.
- **HBJSON import** must map the reverse direction, or membranes will be lost on
  a round trip.

## 8. Phasing

| Phase | Content |
| --- | --- |
| **1** ✅ | `membrane` catalog category (migration), `air_permeance_l_s_m2_at_75pa` column + drift keys + IP/SI display, material-picker support, **exclusion of membrane layers from the R calculation** — shipped 2026-07-26, see `STATUS.md` |
| **2** ✅ | Membrane layer rendering (hairline + distinct treatment), single-segment validation, layer-height modal copy — shipped 2026-07-26, see `STATUS.md` |
| **3** ✅ | Air-barrier designation: field, set/clear control, bold-line rendering, **plus the ASTM E2178 permeance check on the designated face** — shipped 2026-07-26, see `STATUS.md` |
| **4** ✅ | Export/import: omit membranes from the HBJSON construction, carry them in `ph_nav` for lossless round-trip; deliberate PHPP drop — shipped 2026-07-26, see `STATUS.md` |

Phases 1–2 unblock `assembly-condensation-risk` Phase 2. Phase 3 is independent
and can ship in any order. Phase 4 can lag.

## 9. Acceptance criteria

1. Adding a membrane layer to an existing assembly leaves its thermal result
   **exactly unchanged** (membranes are excluded from R, not merely small), and
   introduces no `missing_conductivity` flag. Total Thickness does increase by
   the membrane's real thickness.
1a. An assembly consisting only of membrane layers yields no thermal result and
   an explicit incomplete state, not a divide-by-zero.
2. A membrane layer renders as a legible hairline at any zoom, and a 0.15 mm
   membrane never renders sub-pixel or invisible.
3. Membrane layers accept exactly one segment; the width and steel-stud controls
   are not reachable for them.
4. An assembly with an air-barrier designation renders a bold continuous line at
   the designated face, and clearing the designation removes it.
5. The air-barrier designation appears nowhere in condensation inputs or results.
5a. A designated air-barrier face whose material exceeds 0.02 L/(s·m²) @ 75 Pa is
   flagged; one with no recorded permeance says so rather than implying it passes.
6. HBJSON export omits membranes from the honeybee construction, and a
   PHN → HBJSON → PHN round trip restores them from `ph_nav` without loss.
7. Existing assemblies, exports, and catalog rows are unaffected — no new
   warnings, no migration of existing data.

## 10. Open questions

**All resolved 2026-07-26 (Ed).**

| # | Question | Resolution |
| --- | --- | --- |
| ~~Q-M1~~ | Massless Honeybee material in an opaque construction? | ✅ **membranes are omitted from the HBJSON construction entirely**, carried in `ph_nav` for lossless round-trip. *Supersedes the same-day "export as a thin `EnergyMaterial`", which Q-M2 invalidated by removing the conductivity.* |
| ~~Q-M2~~ | Do membranes need an R field? | ✅ **no — omit membranes from R calculations entirely.** No conductivity needed or used; the conservative treatment. **Plus: record air permeance** (§4a). |
| ~~Q-M3~~ | One `membrane` category or subdivided? | ✅ **one**, with the distinction carried by sd/permeance values and the material name. |
| ~~Q-M4~~ | Separate `coating` category for paints? | ✅ **no** — same category; they behave identically here (sd datum, no R, full-width, not drawn to scale). |
