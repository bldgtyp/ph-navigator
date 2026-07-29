---
DATE: 2026-07-28
UPDATED: 2026-07-29
TIME: 22:52 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 4 — modal tiers 1–2: the verdict and the Glaser/temperature
  diagrams. After this phase the feature is legible.
RELATED: ../PRD.md §6.3 (tiers 1–2), ../decisions.md §D-2/§D-8/§D-9,
  context/DESIGN_SYSTEM.md
---

# Phase 4 — Modal tiers 1–2 (verdict + diagrams)

## Goal

A consultant who clicks the chip can act without re-deriving the Glaser
construction: one plain-language verdict, the four criteria, the Ma picture,
and — one tier deeper — where in the wall and in which month.

## Work

### Tier 1 — Verdict

1. **Verdict sentence** — plain language, risk framing (§D-2): never
   "PASS"/"FAIL" (AC 8); when worst-of-paths ran, one line naming the path
   ("worst path: stud").
2. **Caveat stack** (§D-9) directly under the verdict, before the tiles:
   high-storage/masonry (routes to EN 15026 / WUFI, names the driving-rain
   omission) and multiple-interfaces (low-confidence, interface count, no
   precise Ma headline). A caveated clear never reads as full-confidence
   green (AC 9).
3. **Criterion tiles** — 2×2: Surface condensation · Mould growth · fRsi ·
   Interstitial accumulation; each a status chip naming its worst month.
4. **Hero chart** — 12-month accumulated Ma curve with the Ma-limit reference
   line (Recharts, existing dependency; load the `dataviz` skill before
   writing chart code). Direction-agnostic month labelling (E-18).
5. **Method statement** — the persistent one-liner (ISO 13788 monthly
   steady-state; ignores capillary/sorption, driving rain, air leakage —
   which typically moves more moisture than diffusion). Always visible, not
   collapsible (A-2's constraint).

### Tier 2 — Where & when

6. **Glaser diagram** — psat vs pv across the **sd axis**, condensing
   interface(s) marked and labelled by layer name; a toggle re-plots against
   real thickness (both views, as the workbook offers). Membranes are
   near-zero-width on the thickness view and dominant on the sd view — the
   pair of views is itself the explanation.
7. **Month selector** defaulting to the worst month; drives both diagrams.
8. **Temperature profile** through the layers with the mould-growth,
   condensation, and surface-temperature thresholds drawn at the interior
   boundary (the Rsi = 0.25 basis, as the workbook draws it).

## Design notes

Plain CSS on the 3-tier tokens; reuse blessed components; the diagrams are
the one genuinely new visual — sketch against `context/DESIGN_SYSTEM.md`
doctrine before building, and keep both charts inside `overflow` containers
so the wide modal never scrolls horizontally.

## Out of scope

Tiers 3–4 (numbers, assumptions editing); any export/download affordance
(§D-14 — none in v1).

## Verification

- AC 8 and 9 verified across d1–d4 component states and both caveat types.
- Component tests for tile states, caveat rendering rules, and the
  sd/thickness toggle; chart-data mapping unit-tested against a golden
  result fixture.
- Browser smoke against the seeded local route for the clear state, including
  the default worst month, July selection, sd/thickness toggle, all three
  charts, and no horizontal modal overflow. Caveated, d2–d4, multi-interface,
  and reverse-drive states are covered by component/engine fixtures rather
  than claimed as browser-smoked.
- `make ci` green.

## Result — 2026-07-29

- The screened modal now opens with a plain-language risk verdict, worst path,
  caveats, four criterion tiles, annual accumulated-Ma chart, selected-limit
  line, and persistent ISO 13788 method statement.
- The Where tab plots `psat` and `pv` against cumulative sd or physical
  thickness, labels condensing interfaces, defaults to the worst month, and
  pairs the vapour plot with the layer-temperature profile and all three
  interior-boundary temperatures.
- Recharts reference marks use `ifOverflow="extendDomain"` so a selected Ma
  limit or risk threshold outside the raw series range remains visible.
- Focused verification: backend condensation suites **45 passed**; frontend
  condensation suites **18 passed**; TypeScript and all frontend static
  contracts passed. Full-repository CI evidence is recorded in the phase
  commit.
