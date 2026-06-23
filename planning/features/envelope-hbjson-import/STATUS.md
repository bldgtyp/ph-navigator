---
DATE: 2026-06-23
TIME: 17:17 EDT
STATUS: Implementing — Phases 0–2 DONE (full backend import); Phase 3 (frontend) next
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
- **Implementation: in progress.** Phases 0–2 complete (see below): the
  export round-trips losslessly and the full backend import (native + foreign
  honeybee-PH, preview + apply) is live. Frontend (Phase 3) is next.

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
- **Phase 1 — DONE (2026-06-23).** Backend native front-end: `hbjson_import.py`
  (reverse → IR), `import_planning.py` (matching ladder rungs 1–3 & 6 +
  `build_import_plan`), `import_models.py`, `commands/envelope_import.py`
  (`import_envelope_constructions`), preview route
  `POST …/envelope/import/hbjson/preview`, 13 tests. Also added per-segment
  `steel_stud_spacing_mm` to the export `ph_nav` (reuse-path round-trip) and the
  `context/technical-requirements/envelope-hbjson-import.md` contract doc. See
  `phases/phase-01-native-import.md`.
- **Phase 2 — DONE (2026-06-23).** Backend foreign front-end: raw honeybee-PH
  files (single `OpaqueConstruction`, name-keyed group, or `Model`) normalize
  into the **same** IR via `parse_construction_library`'s native/foreign
  dispatch; `W_/R_/F_` identifier → assembly-type heuristic; cells-based hybrid
  detection (honeybee stamps an empty `divisions` on every material); name-match
  rungs 4–5 (project + catalog, flagged for confirmation). 7 foreign tests. See
  `phases/phase-02-foreign-import.md`.
- **Phase 3** — frontend: "Upload constructions HBJSON" menu item + hidden file
  input + preview/confirm modal (report-status chips).
- **Phase 4** — polish: conflict/ambiguity UX, drift warnings, cross-project
  copy QA, browser smoke.

## Blockers
- None for research. Remaining sub-decisions (schema_version bump in D2;
  name-match tolerance in D3/D5) are settled during their phases.
