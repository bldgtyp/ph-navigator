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

3. **Two things could sink it**, and both are open questions, not code problems:
   - **Catalog coverage** — if µ is unknown for most materials the chip reads
     "not available" everywhere (Q-1, gate on a measurement).
   - **Licensed data** — the µ tables we want are ISO 10456 / ASHRAE, and this
     repo is public with a hard no-licensed-data rule (Q-3).

## Dependencies — two prerequisite features gate Phase 2

✅ **`planning/archive/dated/2026-07-26/assembly-membrane-layers/` Phases 1–2 — shipped 2026-07-26.** Membranes and
coatings dominate a wall's vapour resistance and PHN cannot represent them yet.
(`decisions.md` §D-10)

✅ **`planning/archive/dated/2026-07-28/assembly-boundary-conditions/` Phase 1 — landed
2026-07-26.** Was blocking because `thermal.py` added no surface films at all
and three of ISO 13788's four criteria are evaluated *at the surface*.
`backend/features/envelope/boundary_conditions.py` now supplies both
`resolve_surface_resistances()` and `ISO_13788_SURFACE_CHECK_RSI = 0.25`.
(`decisions.md` §D-11)

Independent of each other; can run in parallel. See `PRD.md` §2a.

## Phase map

Phase 0 coverage probe → 1 material fields → **1½ both prerequisites
(external)** → 2 engine + golden tests → 3 chip + "what's missing" state → 4
modal verdict/diagrams → 5 modal numbers/assumptions. See `PRD.md` §8.
Phases 1–3 are independently valuable; work can stop after any.
