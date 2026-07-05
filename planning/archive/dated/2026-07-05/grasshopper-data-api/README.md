# Feature: Grasshopper Data API (downstream Rhino/GH read routes)

```
DATE:    2026-07-05
TIME:    12:17
STATUS:  ✅ Backend COMPLETE & ARCHIVED (Phases 01–03, merged to main
         2026-07-05). GH-client Phases 04–05 DEFERRED to
         honeybee_grasshopper_ph_plus — start from CLIENT_HANDOFF.md.
AUTHOR:  Claude (with Ed)
SCOPE:   Backend routes + auth so Rhino/Grasshopper components can pull
         assemblies (as HBJSON OpaqueConstructions) and aperture/window
         types (grid JSON + HBJSON WindowConstructions) from PH-Nav V2,
         with a V1/V2 version switch on the existing GH components.
RELATED: research.md, STATUS.md
```

## Intent

PH-Nav V1 serves two Grasshopper "get" components (constructions, window
types) from unauthenticated bt_number-keyed routes. V2 must provide the
equivalent surface — reusing its existing HBJSON export services — plus
bearer-token auth on the REST seam and bt_number/latest-version resolution,
so Rhino users can flip a `version` switch on the existing GH components and
keep working.

## Read order

1. `STATUS.md` — current state and next step.
2. `PRD.md` — the behavior contract (routes, wire contract, decisions,
   parity requirements). Decisions all settled 2026-07-05.
3. `PLAN.md` — 5-phase sequence (1–3 backend here; 4–5 GH client in
   honeybee_grasshopper_ph_plus).
4. `phases/phase-NN-*.md` — the per-phase implementation handoff docs
   (requirements, references, validation, testing, acceptance gates).
5. `decisions.md` — accepted decisions D1–D6 + open items O1–O7.
6. `research.md` — V1 workflow/data-flow synthesis, V2 gap analysis,
   decision log (§5).

## Key external code (read-only precedent, do not import)

- V1 backend: `~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend/features/{assembly,aperture}/`
- V1 GH client: `~/Dropbox/bldgtyp-00/00_PH_Tools/honeybee_grasshopper_ph_plus/honeybee_ph_plus_rhino/gh_compo_io/ph_navigator/`
