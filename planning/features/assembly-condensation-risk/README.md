---
DATE: 2026-07-26
TIME: 10:14 EDT
STATUS: Active — research complete, PRD drafted, blocked on open questions
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
   it forces, 14 edge cases, and the 7 open questions that block a build.
3. **`PRD.md`** — the product contract: material fields, assumption model, chip
   states, modal tiers, backend contract, phasing, acceptance criteria.
4. **`STATUS.md`** — current state and next step.

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
     loader only (Q-3). The boundary-conditions work has since proved that path
     end-to-end for the ASHRAE surface films.

## Dependencies — both cleared ✅

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

Phase 0 coverage probe → 1 material fields (µ/sd) → ~~1½ prerequisites~~ ✅ done
→ 2 engine + golden tests → 3 chip + "what's missing" state → 4 modal
verdict/diagrams → 5 modal numbers/assumptions. See `PRD.md` §8.
Phases 1–3 are independently valuable; work can stop after any.
