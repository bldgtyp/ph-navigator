---
DATE: 2026-07-26
TIME: 12:15 EDT
STATUS: Complete — all four phases shipped 2026-07-26
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Router for membrane layers + air-barrier designation.
RELATED: ./PRD.md, ./STATUS.md, ../../2026-07-29/assembly-condensation-risk/
---

# Membrane layers and air-barrier designation

Let assemblies hold **membrane / sheet-good layers** — WRBs, vapour-control
layers, self-adhered flashings, paints and coatings — and let an assembly
designate **which face is the air barrier**.

## Read order

1. **`PRD.md`** — why it's a prerequisite, the layer-variant model, the
   air-barrier annotation, exports, phasing, four open questions.
2. **`STATUS.md`** — current state and next step.

## The three things to know

1. **This blocks `assembly-condensation-risk` Phase 2.** A wall's vapour
   resistance is dominated by its membranes: in a typical 2×6 wall, 6-mil poly is
   ~95 % of total sd, and the interior *paint* is comparable to the plywood
   sheathing. A condensation screen on assemblies that can't hold membranes
   computes a confident number for a wall that doesn't exist. (`PRD.md` §1)

2. **Model it as a layer variant, not a new node type.** A `membrane` material
   category; membrane layers render as a fixed hairline instead of 1:1 scale,
   take exactly one segment, use `sd` directly as their vapour datum, and are
   **excluded from the R calculation entirely** (no conductivity needed or used —
   6-mil poly is ≈ 0.00045 m²K/W, and PHPP doesn't enter membranes either).
   Reusing `AssemblyLayer` keeps every command, export, and drift path unchanged.
   (`PRD.md` §3)

3. **The air barrier is a face, not a layer or a material.** Sometimes it's a
   dedicated membrane; sometimes it's the interior face of spray foam or the
   taped exterior face of sheathing. So it's an annotation —
   `Assembly.air_barrier = {layer_id, face}` — drawn as a bold continuous line.
   It **does not feed the condensation math** (ISO 13788 ignores air leakage
   entirely). (`PRD.md` §5)

4. **Materials also gain an air-permeance field**
   (`air_permeance_l_s_m2_at_75pa`, ASTM E2178 — the number on WRB datasheets),
   on materials generally rather than just membranes. Paired with the
   designation above it gives a real design-time check: does the layer you called
   the air barrier actually meet the 0.02 L/(s·m²) @ 75 Pa material criterion?
   The designation says *where*; the permeance says *whether*. (`PRD.md` §4a)

## Standalone value

Worth building even without the condensation screen: WRBs and vapour retarders
are submittal-bearing products that PHN currently cannot represent, so they can't
be spec-tracked or datasheet-chased; sections that omit them aren't drawings
anyone would issue; and HBJSON exports can't express a massless layer.
