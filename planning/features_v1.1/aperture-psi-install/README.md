# Feature: Aperture Psi-Install (`psi_install_w_mk`)

```
STATUS:  Active — design accepted 2026-08-03; phases 01–04 complete
         2026-08-03/04, phases 05–07 pending.
ORIGIN:  honeybee_grasshopper_ph_plus (GH plugin, PH-Nav V1 client — Get Apertures)
DATE:    2026-07-05 (need filed) / 2026-08-03 (research + PRD draft)
AUTHOR:  Ed + Claude
SCOPE:   Window install thermal-bridge values: project data model, defaults,
         mulled-edge rule, evidence PDFs, UI, route-3 export contract, and the
         coordinated GH-client change.
RELATED: research.md (code survey, all citations); PRD.md (draft design + UX
         options); gh-material-thermal-defaults (sibling "missing PH value"
         case, already shipped); planning/archive/dated/2026-08-03/public-attachment-access
         (the TB PDF-attachment recipe this reuses)
```

## One-liner

Windows need real per-edge **Ψ-install** values (W/m·K) that originate in
PH-Navigator and flow through route 3 → Grasshopper → HBJSON → PHX →
WUFI/PHPP/METr. Today the value is `null` everywhere and the GH client
fabricates 0.04 W/mK — which is not even the Phius default (0.052).

## Read order

1. **`STATUS.md`** — current state, phase ledger, coordination notes.
2. **`decisions.md`** — the accepted design in 10 decisions (D-1…D-10);
   supersedes PRD recommendations where they differ (D-7 evidence axes,
   D-5 route-3 contract).
3. **`PLAN.md`** — phase map, ordering constraints, status-ux-unification
   coordination.
4. **`phases/phase-01…07`** — coding-agent handoff plans (01–06 PHN,
   07 honeybee_grasshopper_ph_plus).
5. **`PRD.md`** — rationale, personas, UX wireframe (kept as accepted-design
   background; decisions.md wins on conflicts).
6. **`research.md`** — the grounding: how psi-install is handled today in
   honeybee_ph, PHX (WUFI/PHPP/METr/PPP writers), both GH plugins, and PHN
   itself, with file:line citations; program default values verified against
   the phius-rules corpus; upstream bug list found along the way.
7. **`phx-bug-handoff.md`** — self-contained upstream bug list for the
   PHX-agent (Ed delivers; outside this packet's phases).

## The shape of the answer (summary of PRD)

- New project table `aperture_install_types` (like thermal bridges: psi value +
  Flixo PDF attachment + status), seeded with a program-aware **Default** row
  (Phius 0.052 / PHI 0.04 W/m·K).
- Assignment is per aperture-element **edge** (top/right/bottom/left), nullable
  → inherits Default. Interior (mulled) edges are **derived Ψ=0**, never
  stored, never assignable — per Phius §1.4.4.6.
- Primary UX: per-aperture **Installs modal** with a read-only key-view SVG
  (reusing `ApertureSvgCanvas`); pick a type, paint perimeter edges, bulk
  copy across apertures. No new canvas click events.
- Route 3 emits the resolved effective value per edge; the GH client's
  dedup-by-frame-name must be fixed before PHN emits *varying* per-edge values
  (sequencing note in PRD §7.7).

## Key facts a future session must not lose

- Downstream (honeybee_ph → PHX → WUFI/PHPP/METr) is **already per-edge and
  faithful**; psi rides on the window type, and PHN aperture-type grid cells
  map 1:1 to window types. No downstream schema work needed.
- There are **no install on/off flags anywhere** in the stack — Ψ=0 on an edge
  is the only representation of "not installed / mulled".
- **Phius default is 0.030 Btu/hr·ft·°F ≈ 0.052 W/m·K**, not 0.04 (mid-wall
  tiers 0.020/0.015 IP; 0 at mulled sides). 0.04 W/mK is the PHI-side
  convention. Defaults must be program-aware.
- `ProjectFrame` rows are deduped by catalog product → psi stored there can
  never express head-vs-sill differences; the assignment must live on the
  element-side slot.
- The old AirTable workflow already proved the "named install types applied
  per edge" model in production (research.md §4.2).
