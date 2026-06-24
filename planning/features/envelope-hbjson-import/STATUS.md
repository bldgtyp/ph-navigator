---
DATE: 2026-06-23
TIME: 17:17 EDT
STATUS: Feature complete — Phases 0–7 DONE; live browser smoke passed
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
- **Implementation: complete.** Phases 0–7 done (see below): the export
  round-trips losslessly, the full backend import (native + foreign honeybee-PH,
  preview + apply) is live, and the frontend upload/preview/confirm flow is wired
  with per-construction Add/Replace/Skip overrides (native + foreign), reused-
  material drift warnings, and per-material reject-the-match overrides.

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
- **Phase 3 — DONE (2026-06-23).** Frontend: "Upload constructions HBJSON"
  menu item (editor-only) + hidden file input in `EnvelopePage.tsx`;
  `useEnvelopeHbjsonImport` hook (FileReader-based read → multipart preview);
  `previewEnvelopeHbjsonImport` api + hook; `client.ts` FormData support;
  `ImportConstructionsDialog` preview/confirm modal (report-status chips,
  counts + per-construction/-material plan + warnings); apply via the existing
  command rail with the `import_envelope_constructions` kind. Dialog +
  upload-flow + viewer-gating tests (full frontend suite green, 1852 tests).
- **Phase 4 — DONE (2026-06-23).** Polish: per-construction **Add / Replace /
  Skip** override in the preview modal (`ImportConstructionsDialog` is now
  stateful; Replace offered only when the file matched an existing assembly;
  foreign constructions stay add-only since the backend keys resolutions by
  source assembly id) — selections flow to the `resolutions` the apply command
  already supports. Cross-project copy QA is covered by backend tests
  (pick-from-catalog + create-new across projects); matching-ladder warnings
  surface per-row in the modal.

- **Phase 5 — DONE (2026-06-23).** Skip/override for foreign constructions:
  construction resolutions are now keyed by a stable `resolution_key` (the
  file's construction identifier) carried on every IR construction +
  `ConstructionPlanItem`, replacing the `source_assembly_id` key. The modal
  renders the Add/Replace/Skip select for **all** constructions (foreign get
  Add/Skip — no Replace without a target). +1 backend foreign-skip test;
  frontend dialog tests updated.
- **Phase 6 — DONE (2026-06-23).** Material drift detection: when a reuse rung
  (by id, by in-project catalog record, or by name) keeps an existing project
  material whose thermal values (`conductivity_w_mk`, `density_kg_m3`,
  `specific_heat_j_kgk`, `emissivity`) differ from the file's, the material plan
  item carries a `reused_material_values_differ` warning (informational — still
  reuses). `_MaterialIndexes.by_id` replaced the id-set so the reused material is
  available to compare. +1 backend drift test; frontend warning label added.
- **Phase 7 — DONE (2026-06-23).** Per-material override: the user can reject an
  auto-match and force a fresh project-only copy (the false-positive name-match
  escape hatch). The apply command carries `material_resolutions`
  (`{source_key, action: "create_new"}`); `_resolve_one_material` short-circuits
  to create-new for forced source_keys. The modal adds a per-material "Create
  new" checkbox (hidden when the decision is already create_new) and the row's
  decision label reflects the override. +1 backend test, +1 dialog test.

## Verification
- **Live browser smoke — PASSED (2026-06-23).** Ran the worktree stack in
  isolation (backend :8001, frontend :5173, fresh `*_wt` DB, agent login) to
  avoid disrupting the running dev stack. Confirmed in a real browser: the
  "Upload constructions HBJSON" menu item renders, and a raw honeybee-PH
  `OpaqueConstruction` (`W_SmokeWall`, 2 layers) imports end-to-end — preview
  200 (foreign path → add_new, type `wall` from the `W_` prefix, both materials
  create_new), apply 200, and the assembly renders in the builder with correct
  thickness (112 mm), U-value, and material rows, landing in the draft with the
  "Uncommitted changes / Save Version" banner. Isolated env torn down after.

## Blockers
- None for research. Remaining sub-decisions (schema_version bump in D2;
  name-match tolerance in D3/D5) are settled during their phases.
