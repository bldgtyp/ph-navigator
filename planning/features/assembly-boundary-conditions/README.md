---
DATE: 2026-07-26
TIME: 11:05 EDT
STATUS: Draft — PRD written, not started
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Router for assembly boundary conditions and surface films.
RELATED: ./PRD.md, ./STATUS.md, ../assembly-condensation-risk/,
  ../../archive/dated/2026-07-26/assembly-membrane-layers/ (complete),
---

# Assembly boundary conditions and surface films

Give assemblies a real boundary-condition model — what is on either side, what
surface film that implies, and which way heat flows — and make it visible on the
section.

## Read order

1. **`PRD.md`** — what PHN has today (verified), why it gates the condensation
   screen, the model, the rendering proposal, phasing, four open questions.
2. **`STATUS.md`** — current state and next step.

## The four things to know

1. **PHN has no surface-film model at all.** `thermal.py` sums only
   `thickness / conductivity`. No Rsi, no Rse, anywhere. (`PRD.md` §1)

2. **The header metric is construction-only — and says so.** Its tooltip already
   states *"Surface film resistances (air films) are NOT included"*, so this is
   not an honesty fix; it is a deliberate change of convention. ✅ Resolved —
   films get folded into the thermal calculation (Phase 2), which **moves every
   displayed value** (IP R up, SI U down) by ~4 % on a good assembly and ~15 % on
   a poor one, and the tooltip is rewritten alongside it. That is why Phase 2 is
   deliberately a separate diff from Phase 1.

3. **`Assembly.type` is currently decorative** — consumed only by HBJSON
   export/import metadata and the sidebar icon. It drives no physics. And there
   is no "adjacent to" axis at all, so ground contact, ventilated cavities, and
   unconditioned space are all silently modelled as outdoor air.

4. **The `air_*` catalog categories are cavities, not films** — 180 of 408 seeded
   materials are thickness-parameterized air *spaces* inside the construction.
   They coexist with the new film model untouched; conflating the two is what
   made this gap easy to miss.

## Why it blocks the condensation screen

ISO 13788's whole temperature profile depends on `R_total = Rsi + ΣR + Rse`, and
three of its four criteria (surface condensation, mould growth, fRsi) are
evaluated at a *second* Rsi of 0.25 m²K/W. Without a film model those three
cannot be computed at all. **Phase 1 here unblocks
`assembly-condensation-risk` Phase 2.**

## How this differs from honeybee-energy (source-verified)

Honeybee's `OpaqueConstruction` has **no type and no heat-flow direction** —
those only exist once a construction is on a `Face`. PHN, like PHPP, puts type on
the *assembly*, which is exactly what lets us resolve Rsi and heat-flow direction
without a geometric model, and therefore what makes a Glaser analysis possible.

Also worth knowing: honeybee's `r_factor` films are **ISO 10292 / EN 673**
(glazing standards), emissivity-dependent and direction-*in*dependent
(Rse = 0.0435 fixed, Rsi ≈ 0.120), and they are reporting-only — `to_idf()` emits
bare material layers and **EnergyPlus computes films itself at runtime**. So
nothing upstream can be inherited here. (`PRD.md` §1a)

## Rendering

Ed's call: promote the existing `exterior` / `interior` labels into the control
rather than adding new chrome. The exterior label becomes a three-option select
(**Outdoor air / Ventilated / Ground**); the interior label stays static and
shows its *derived* Rsi and heat-flow direction, since `Assembly.type` fully
determines it. Both display the resistance in play, which is the real win — the
most consequential thermal assumption in the assembly goes from invisible to
legible. Plus tinted face bands, with distinct treatments for ground and
ventilated. (`PRD.md` §5)
