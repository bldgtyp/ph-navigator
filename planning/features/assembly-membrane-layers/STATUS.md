---
DATE: 2026-07-26
TIME: 10:42 EDT
STATUS: Draft — not started
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers.
RELATED: ./README.md, ./PRD.md, ../assembly-condensation-risk/STATUS.md
---

# Status

## State

**PRD drafted. No code written.** Spun out of the `assembly-condensation-risk`
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

**Phase 1** — add the `membrane` category to the `catalog_materials` CHECK
constraint, wire it through the material picker, and exempt membrane layers from
`missing_conductivity`. This is small, self-contained, and unblocks everything
else. It does not depend on any open question.

## Dependencies

- **Blocks:** `assembly-condensation-risk` Phase 2 (the engine). Phases 1–2 here
  are the gate.
- **Shares:** the `vapor_sd_equivalent_m` material field defined in
  `../assembly-condensation-risk/PRD.md` §4. Whichever feature ships first
  should land that field; the other consumes it.

## Blockers

**None. All four open questions resolved 2026-07-26 (Ed); ready to implement.**

| # | Question | Resolution |
| --- | --- | --- |
| ~~Q-M1~~ | Massless Honeybee material round-trip? | ✅ omit membranes from the HBJSON construction; carry in `ph_nav` for lossless round-trip |
| ~~Q-M2~~ | Do membranes need an R field? | ✅ no — **omit from R entirely**; plus **new `air_permeance_l_s_m2_at_75pa` field** |
| ~~Q-M3~~ | One `membrane` category or subdivided? | ✅ one |
| ~~Q-M4~~ | Separate `coating` category for paints? | ✅ no — same category |

## Verification

Phase 1 gate: adding a membrane layer to an existing assembly changes its
Effective U-Value only by the membrane's own near-zero R, and raises no
`missing_conductivity` flag (`PRD.md` §9, criterion 1).
