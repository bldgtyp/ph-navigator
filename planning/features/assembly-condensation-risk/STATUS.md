---
DATE: 2026-07-26
UPDATED: 2026-07-28
TIME: 10:14 EDT
STATUS: Ready — both prerequisites shipped; Phase 0 (coverage probe) is next
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for the condensation-risk feature.
RELATED: ./README.md, ./research.md, ./PRD.md, ./decisions.md
---

# Status

## State

**Research and documentation phase complete. No code written.**

Done:
- Full teardown of `PHI_CondenstationTool_March_v1.7.5.xlsx` — all six sheets,
  formulas extracted (not just values): saturation-pressure equations, layer
  R/sd/δ derivations, the Glaser tangent construction, gc/Ma accumulation, the
  four verification criteria, the four interior-climate models, and the national
  Ma-limit reference tables. → `research.md` §§1–3, 5.
- Input inventory mapped against the live PHN data model
  (`envelope/models.py`, `project_document/envelope_models.py`,
  `climate/record.py`, `envelope/thermal.py`, `catalog_materials` baseline
  migration). → `research.md` §4.
- Material-property analysis (µ vs sd vs permeance, US-unit conversions,
  verified against ISO 10456's 6-mil-poly value). → `research.md` §6.
- Feature interrogated from seven angles; verdict **build, conditionally**. →
  `decisions.md` Part 1.
- Eight design decisions taken or recommended, 14 edge cases enumerated, 7
  blocking open questions raised. → `decisions.md` Parts 2–4.
- Product contract drafted incl. progressive-disclosure modal design and a
  six-phase plan. → `PRD.md`.

Added 2026-07-26 (Ed's review of the above):
- **Q-2 resolved** — worst-of-all-paths, bounded enumeration (`decisions.md` §D-1).
- **Uncertainty caveats designed** as a named set rather than one flag, because
  capillary-active and high-storage materials fail in *opposite* directions and
  imply different actions. v1 fires two caveats derived from existing categories
  with **no new fields**; the per-material `moisture_behavior` enum is v1.1.
  (`decisions.md` §D-9)
- **Membrane layers spun out as a prerequisite feature** —
  `planning/archive/dated/2026-07-26/assembly-membrane-layers/` (complete). Membranes and coatings dominate
  a wall's sd, and PHN could represent neither; the engine must not ship before
  they land. (`decisions.md` §D-10, `PRD.md` §2a) — **shipped 2026-07-26.**

Resolved 2026-07-26 (Ed, second review) — **all seven open questions closed**:
- Q-1 build it (with a preliminary coverage read in `decisions.md` §D-12 that
  surfaced the composite stud-material problem); Q-3 µ values live in the private
  DB; Q-4 confirmed against the tool, with two corrections in §D-13; Q-5 floors
  on grade excluded — **and the underlying boundary-condition gap became a second
  prerequisite feature** (§D-11); Q-6 per-project Ma limit, default 200; Q-7
  screen-only preview, no export, no download-report affordance (§D-14).

### As-built reconciliation, 2026-07-28

Both prerequisites are shipped and deployed. Reviewing their archived packets and
the merged code produced four tightenings to this packet, recorded in
`decisions.md` §D-15 — none a reversal:

- **The "sd wins" rule is now load-bearing.** A membrane's `thickness_mm` is not
  drawn to scale, is excluded from Total Thickness, carries no R, and is
  **auto-snapped to 1 mm** by `membranes.should_snap_membrane_thickness` when
  implausible. `µ · d` on a membrane would read a number the app itself mutates.
  A membrane with no `sd` now **blocks** rather than falling through.
- **Total Thickness excludes membranes** (reversed 2026-07-27; moved to
  `membranes.total_thickness_mm`). Cosmetic here, but the chip sits beside that
  metric.
- **The engine must take its film table and climate as arguments.** The
  boundary-conditions work drafted the lookup inside `thermal.py` and produced a
  real import cycle through the storage layer. `calculate_assembly_thermal
  (assembly, materials_by_id, film_table=…)` is the shipped shape to copy.
- **"Layers" ≠ "layers with an R-value."** The membrane packet's closing lesson,
  worth five defects — four found in review, not by a green suite. Glaser
  inverts the bias: membranes contribute nothing to the temperature profile and
  dominate the vapour profile. Highest-risk source of a silent wrong answer in
  Phase 2.

Two obligations came back **to** this feature from the boundary-conditions work:
Ft for `unconditioned_space` (nothing models the far-side temperature → new Q-8,
recommendation is "not screened" in v1), and the disclosed seam that
`ventilated` / `unconditioned_space` apply ISO 6946 §6's `Rse = Rsi` under
whichever standard is loaded.

Also inherited, and directly reusable: `ThermalStatusFlag` gained
`no_thermal_layers` (the named-flag-per-cause pattern), and
`envelope/air_barrier.py` keeps `unknown` strictly distinct from `pass` — the
same rule this feature's blocked state needs.

Not done: nothing implemented here. No branch, no migration, no models.

## Next step

**Phase 0 — the catalog coverage probe (Q-1).** Before any code, measure: across
the production catalog and the assemblies in live projects, what fraction of
layers would have a µ or sd value after an ISO 10456 category-level seed? This is
the one number that decides whether the feature ships as a calculation or as a
data-entry push. It requires no schema change — it is a read-only analysis of
existing catalog rows against the ISO 10456 category list in `research.md` §7.

## Blockers

**All seven original open questions are resolved** (`decisions.md` Part 4). What
remains is sequencing, not decisions:

| Blocker | Nature |
| --- | --- |
| ✅ `assembly-boundary-conditions` | **cleared — all four phases, 2026-07-26 → 2026-07-28.** `boundary_conditions.py` exposes `resolve_surface_resistances()` → `(Rsi, Rse, heat_flow_direction)` and `ISO_13788_SURFACE_CHECK_RSI = 0.25`. Films are now in the thermal metric; `Assembly.exterior_condition` has four values; `thermal_standard` carries both ISO 6946 (in code) and ASHRAE (private object store), with a typed 409 rather than a fallback when a table is unpublished. Archived to `planning/archive/dated/2026-07-28/assembly-boundary-conditions/`. |
| ✅ `assembly-membrane-layers` **Phases 1–2** | **cleared 2026-07-26** — in fact all four phases shipped. Assemblies hold membrane layers, which are excluded from the R calculation and carry the `air_permeance_l_s_m2_at_75pa` datum. Archived to `planning/archive/dated/2026-07-26/assembly-membrane-layers/`. It deliberately did **not** land the vapour fields (its Phase 1 was scoped to air permeance), so `vapor_diffusion_resistance_mu` + `vapor_sd_equivalent_m` are **this feature's Phase 1**, exactly as `PRD.md` §4 and §8 already specify. Not a shared or unowned field — see the note below. |
| ⚠️ Composite stud materials | `decisions.md` §D-12 — 24 % of the seeded catalog is stud+cavity pseudo-materials with no single defensible µ. Recommendation (i): use the cavity's µ plus a caveat. Needs Ed's nod during Phase 0. |
| ⚠️ **Q-8 — screen `unconditioned_space`?** | *New 2026-07-28.* The value exists and gets a film, but Ft is modelled nowhere and both prerequisite packets deferred it here. Recommendation: **not screened in v1** (same treatment as `ground`); a nullable `adjacent_temp_factor` is an additive v1.1. Not blocking. |
| ✅ Occupancy-class default | `decisions.md` §D-13b — `normal`, a knowing departure from PHI's `low`/EN 15026 suggestion. Signed off by Ed 2026-07-26. |

**Both external prerequisites are cleared**, so nothing outside this packet gates
it. What remains is Phase 0 (the coverage probe) plus two calls that can be made
during it — the composite-stud policy and Q-8.

### The vapour fields are this feature's own work, not a dependency

`vapor_diffusion_resistance_mu` (µ) and `vapor_sd_equivalent_m` (sd) are
specified in `PRD.md` §4 — units, constraints, the four-step per-layer
resolution ladder, and the `sd ≥ 1500 m` convention for a vapour-tight layer —
and scheduled as **Phase 1** in §8. They need no separate feature packet: they
have exactly one consumer, the Glaser engine in Phase 2, and a field pair whose
only user is the feature that defines it is not a feature.

The earlier "whichever feature ships first should land that field" note was
about sequencing two features that were then running in parallel. That
ambiguity is gone. `air_permeance_l_s_m2_at_75pa` (shipped 2026-07-26) is a
complete worked example of threading one nullable material field end-to-end —
migration, catalog columns, document model, drift keys, refresh choices,
import/export, both editors, SI/IP display — and confirms the additive-field
path needs no document schema-version bump, only a regenerated fingerprint and
corpus snapshot.

## Verification

Nothing to verify yet. When Phase 2 lands, the gate is acceptance criterion 3 in
`PRD.md` §9: golden-file agreement with the PHI workbook's own outputs for a
reference assembly, to within rounding.

Both prerequisite packets ended up finding most of their real defects in review
or in a browser rather than from a green suite (membranes: five defects, four
found in review; boundary conditions: two rendering defects only a real browser
caught). Budget for that here — a passing `pytest` will not tell you the Glaser
engine is iterating the wrong set of layers.
