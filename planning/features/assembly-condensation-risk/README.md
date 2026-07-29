---
DATE: 2026-07-26
UPDATED: 2026-07-28 — pipeline mechanics implemented; phase plans drafted
TIME: 22:52 EDT
STATUS: Ready — all questions resolved, prerequisites cleared, phase plans in
  ./phases/; Phase 0 next
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
   it forces, 21 edge cases, and the 8 open questions (7 resolved, Q-8 open).
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

3. **Two things could have sunk it; both are now settled** (2026-07-26):
   - **Catalog coverage** — build it (Q-1). One live sub-question remains: 24 %
     of the catalog is stud+cavity pseudo-materials with no single defensible µ
     (`decisions.md` §D-12).
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
local dry-run, resumed once our Phases 0–1 supply the roster and columns).
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
  film, but nothing models the far-side temperature. New **Q-8**; recommendation
  is "not screened" in v1, same as `ground`. (`PRD.md` §6.5)
- **`sd` must win, and now must exist.** A membrane's thickness is app-mutable
  (auto-snapped to 1 mm when implausible), so `µ · d` is not a valid fallback for
  a membrane — a membrane without `sd` blocks. (`decisions.md` §D-15a)
- **The engine takes its film table and climate as arguments.** Looking them up
  inside the calculation produced a real import cycle last time.

## Phase map

Contract in `PRD.md` §8; implementation plans in `./phases/`:

| Phase | Plan | Ships |
| --- | --- | --- |
| 0 | `phases/phase-00-coverage-probe.md` | the coverage number, the seed roster, the §D-12 + Q-8 calls, go/no-go |
| 1 | `phases/phase-01-material-vapor-fields.md` | µ/sd fields end-to-end + the `iso10456-vapor-mu` seed drilled locally (joint with pipeline Phase 4) |
| 2 | `phases/phase-02-glaser-engine.md` | the pure engine, golden-tested against the PHI workbook |
| 3 | `phases/phase-03-route-and-chip.md` | route + chip + the "what's missing" state — usable |
| 4 | `phases/phase-04-modal-verdict-diagrams.md` | modal tiers 1–2 — legible |
| 5 | `phases/phase-05-modal-numbers-assumptions.md` | modal tiers 3–4 + closeout — complete |

Phases 1–3 are independently valuable; work can stop after any.
