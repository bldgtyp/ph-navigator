---
DATE: 2026-07-26
UPDATED: 2026-07-29 — Complete
TIME: 07:17 EDT
STATUS: Complete — implementation verified; production data apply remains operator-held
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Router for the assembly condensation-risk feature.
RELATED: ./research.md, ./PRD.md, ./decisions.md, ./STATUS.md
---

# Assembly condensation risk (ISO 13788 / modified Glaser)

Add an interstitial-condensation **risk screen** to Envelope ▸ Assemblies,
alongside the Total Thickness and Effective U-Value facts already in the assembly
header. Chip at rest; a four-tier progressive-disclosure modal on click.

Modelled on the **PHI Condensation Tool v1.7.5**
(`~/Dropbox/bldgtyp-00/00_PHPP/Tools/PHI Condensation Tool/`), implemented from
**ISO 13788:2012**.

## Read order

1. **`research.md`** — teardown of the PHI workbook (formulas, inputs, verdict
   logic), the ISO 13788 interior-climate models, the µ/perm unit story, and a
   line-by-line map of what PHN already has vs what is missing.
2. **`decisions.md`** — is this worth building (7 angles), the design decisions
   it forces, 21 edge cases, and the eight resolved questions.
3. **`PRD.md`** — the product contract: material fields, assumption model, chip
   states, modal tiers, backend contract, phasing, acceptance criteria.
4. **`STATUS.md`** — current state and next step.
5. **`phases/`** — one implementation plan per phase (00–05), drafted
   2026-07-28.

## The three things to know

1. **The exterior climate side is already done.** `ClimateRecord` carries monthly
   air temperature *and* monthly dew-point temperature — exactly the pair the PHI
   tool uses. No new climate ingestion, no new project settings for the exterior
   boundary. (`research.md` §4)

2. **The one genuinely new datum is µ** (water-vapour diffusion resistance
   factor) — not "permeance". µ is thickness-independent and belongs on the
   material; permeance is a property of a *layer*. Thin sheets additionally need
   `sd` stored directly. Both fields are optional and backwards-compatible by
   construction. (`research.md` §6, `PRD.md` §4)

3. **Two things could have sunk it; both are now settled** (by 2026-07-29):
   - **Catalog coverage** — the Phase 0 probe is go: 93.4% resolves before
     product entry. The 99 stud+cavity pseudo-materials use the named cavity
     family plus a caveat (`decisions.md` §D-12).
   - **Licensed data** — µ values live in the private DB; the repo carries the
     loader only (Q-3). Since resolved *in mechanism* too: the licensed-data
     pipeline (implemented 2026-07-28) publishes reviewed, versioned datasets
     from the private `ph-navigator-data` repo to R2 and applies them
     idempotently with an audit trail — the µ dataset is its first `db_seed`
     consumer.

## Dependencies — all cleared ✅ (pipeline mechanics implemented 2026-07-28)

✅ **`planning/features/licensed-data-pipeline/`** — split out 2026-07-28
(Ed) and **implemented the same day** (Phases 1–3 on branches: private
`ph-navigator-data` repo + CI publisher → R2 immutable versioned keys +
manifest → PHN `datasets` feature with `applied_datasets` audit and guarded
apply CLIs). The Q-3 "values live in the private DB" decision now has running
machinery; the µ seed rides its `db_seed` path (pipeline Phase 4 = our seed's
local dry-run, resumed once Phase 1 supplies the columns; Phase 0 already
supplied the accepted 201-row roster).
Only the *production* apply waits on the pipeline's Ed-gated Phase 3 cutover.

✅ **`planning/archive/dated/2026-07-26/assembly-membrane-layers/`** — all four
phases, shipped 2026-07-26 (rendering reworked 07-27). Assemblies hold membrane
layers, excluded from R, with `air_permeance_l_s_m2_at_75pa` and an air-barrier
face designation. It deliberately did *not* land the vapour fields — those are
this feature's Phase 1. (`decisions.md` §D-10)

✅ **`planning/archive/dated/2026-07-28/assembly-boundary-conditions/`** — all
four phases, 2026-07-26 → 2026-07-28. `boundary_conditions.py` supplies
`resolve_surface_resistances()` and `ISO_13788_SURFACE_CHECK_RSI = 0.25`;
`Assembly.exterior_condition` has four values; `thermal_standard` carries both
ISO 6946 and ASHRAE. (`decisions.md` §D-11)

See `PRD.md` §2a for the full inherited-API table, and `decisions.md` §D-15 for
what reading the as-built code changed here.

## What came back with them

- **Ft is now our obligation.** `unconditioned_space` is expressible and gets a
  film, but nothing models the far-side temperature. It is not screened in v1,
  same as `ground`.
  (`PRD.md` §6.5)
- **`sd` must win, and now must exist.** A membrane's thickness is app-mutable
  (auto-snapped to 1 mm when implausible), so `µ · d` is not a valid fallback for
  a membrane — a membrane without `sd` blocks. (`decisions.md` §D-15a)
- **The engine takes its film table and climate as arguments.** Looking them up
  inside the calculation produced a real import cycle last time.

## Phase map

Contract in `PRD.md` §8; implementation plans in `./phases/`:

| Phase | Plan | Ships |
| --- | --- | --- |
| 0 | ✅ `phases/phase-00-coverage-probe.md` + `phase-00-report.md` | Complete: 93.4% catalog coverage, 201-row roster, go; both policies accepted |
| 1 | ✅ `phases/phase-01-material-vapor-fields.md` | Complete: µ/sd fields end-to-end + the private `iso10456-vapor-mu` seed drilled locally and published through private PR #2; production DB apply remains Ed-dispatched |
| 2 | ✅ `phases/phase-02-glaser-engine.md` | Complete: pure engine, synthetic-golden-tested against the PHI workbook |
| 3 | ✅ `phases/phase-03-route-and-chip.md` | Complete: cached live route + eight-state chip + corrective blocked/not-screened modal |
| 4 | ✅ `phases/phase-04-modal-verdict-diagrams.md` | Complete: risk verdict, criteria, Ma and layer-profile diagrams |
| 5 | ✅ `phases/phase-05-modal-numbers-assumptions.md` | Complete: shared number tables, versioned assumptions editor, acceptance closeout |

Phases 1–4 are independently valuable; work can stop after any.
