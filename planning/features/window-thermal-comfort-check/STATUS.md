---
DATE: 2026-08-18
TIME: 10:52 EDT
STATUS: Draft — not started
AUTHOR: Ed May / Claude
SCOPE: Current state and next step for the window thermal-comfort check
RELATED:
  - planning/features/window-thermal-comfort-check/PRD.md
---

# STATUS — Window Thermal Comfort Check

**State:** `Deferred` — PRD drafted 2026-08-18, no code written, no phases
planned.

## Next step

Answer PRD §10.2 before anything else:

> Does the sill height belong on the aperture **type**, or can one type be
> reused at different floor heights within a project?

The PRD assumes per-type. If reuse across heights is real, the datum has to
move to the aperture *instance* and the derivation, the document schema, and
the roll-up all change. Everything else in the PRD is stable regardless.

Then decide PRD §10.1 (blocked vs not-screened for a missing sill height;
recommendation is blocked) and write `phases/`.

## Blockers

None technical. PHN already holds every input except the two new fields:

- `sill_height_mm` on `ApertureTypeEntry` — new
- NFRC standard-size whole-window U on the window construction — new
- ASHRAE 99% heating design temp — **already present**, as
  `ClimateDesignConditions.heating_990_db_c`
- Per-element whole-window U — **already present**, from
  `features/aperture_u_value/`

## Verification plan

Per PRD §8. The criterion port in
`phius-rules/rulesets/phius-2024-r1/calculators/window-comfort/impl.py` is the
oracle (19 passing tests, validated against the official Phius applet); PHN's
implementation must agree with it.

Fixture geometry from Arverne D storefronts, with **synthetic U-values only** —
this repo is public and window product data is licensed.

## Notes carried in from the originating session (2026-08-18)

- Phius clarifications behind this feature were recorded in the `phius-rules`
  corpus in the same session (commit `d183dcb`): per-lite evaluation,
  finished-floor HHS datum, NFRC standard-size data route, and gyms/lounges
  being non-exempt.
- The existing aperture U-value CSV/XLSX export carries `grid_position` as the
  element's **top-left cell only** (`column_span[0]`, `row_span[0]`) and
  `height` as the element's full spanned height, but does **not** export
  `row_heights_mm`. Head height is therefore not reconstructible from the
  report alone — which is part of why this check has to live in the backend
  against the document, not in a spreadsheet against the export.
- Row 0 is the **top** row (`apertures/edge_classification.py`:
  `row_start - 1` is the "top" neighbour).
- Real-world validation of the `sill_height_mm` parameter: the Arverne D
  storefront measures **3.56 m** floor-to-transom-head in Rhino, while the PHN
  aperture grid for the same type totals **3.353 m**. The 207 mm difference is
  exactly the missing datum — the assembly base sits above finished floor. The
  model was internally consistent and still could not answer the compliance
  question, which is the argument for this feature in one line.
