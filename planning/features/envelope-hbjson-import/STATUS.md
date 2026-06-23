---
DATE: 2026-06-23
TIME: 17:17 EDT
STATUS: Implementing — Phase 0 (export enhancement) DONE; Phase 1 next
AUTHOR: Ed (via Claude)
SCOPE: Status for Envelope HBJSON Import.
---

# Status

## State
- **Research: complete.** Mapped the export pipeline, the V2
  assembly/material document + command model, the catalog matching machinery,
  and the V1 import precedent. Verified against the attached example file.
- **Design: drafted as an outline** in `PRD.md`. Key conclusions:
  - The file is **PHN-native** (`PHNavigatorOpaqueConstructionLibrary`,
    schema 11) → import is a direct reverse of `hbjson_export.py`, **no
    honeybee dependency**.
  - The export is **lossy** for round-trip (`assembly.type`, `orientation`,
    homogeneous layer/segment ids, `is_continuous_insulation`) → needs small
    **additive export enhancements** (PRD §4 / decision D2).
  - Material matching is a **4-step ladder** reusing existing
    `pick_catalog_material` / `project_material_from_catalog` /
    catalog-repo logic (PRD §5).
  - Flow is **preview → confirm**, applied atomically through the existing
    `apply_envelope_command` pipeline (PRD §6).
- **Implementation: in progress.** Phase 0 complete (see below).

## Decisions (2026-06-23)
- **D1: both sources in v1** — PHN-native **and** raw Honeybee-PH.
- **D2: export enhancement is Phase 0** (additive `ph_nav` fields).
- **D4: unmatched materials are project-only** (no global-catalog write).
- D3/D5–D8 carry recommended defaults in `decisions.md` (settle during phasing).

## Phases
- **Phase 0 — DONE (2026-06-23).** Export enhancement: additive `ph_nav` fields
  in `hbjson_export.py` — construction `assembly_id`/`assembly_type`/
  `orientation`; homogeneous-layer `layer_id`/`segment_id`/
  `is_continuous_insulation` on the material `ph_nav`; hybrid wrapper `layer_id`
  + per-cell `segment_id`/`is_continuous_insulation`. Round-trip export tests
  added; `envelope-hbjson-export.md` contract doc updated.
- **Phase 1** — backend native front-end: reverse `hbjson_export.py` → IR,
  matching ladder rungs 1–3 & 6, `ImportEnvelopeConstructionsCommand`, preview
  route, tests.
- **Phase 2** — backend foreign front-end: honeybee-ph parse + layer→segment
  decomposition, matching rungs 4–5 (name/property), assembly-type handling,
  tests.
- **Phase 3** — frontend: "Upload constructions HBJSON" menu item + hidden file
  input + preview/confirm modal (report-status chips).
- **Phase 4** — polish: conflict/ambiguity UX, drift warnings, cross-project
  copy QA, browser smoke.

## Blockers
- None for research. Remaining sub-decisions (schema_version bump in D2;
  name-match tolerance in D3/D5) are settled during their phases.
