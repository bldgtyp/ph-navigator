---
DATE: 2026-06-23
TIME: 17:17 EDT
STATUS: Feature complete (core) — Phases 0–4 DONE; follow-ups noted below
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
- **Implementation: in progress.** Phases 0–3 complete (see below): the
  export round-trips losslessly, the full backend import (native + foreign
  honeybee-PH, preview + apply) is live, and the frontend upload/preview/confirm
  flow is wired. Phase 4 (polish) is next.

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

## Follow-ups (deferred — out of the v1 "polish" scope)
- **Per-material override** in the preview: needs the apply command to carry
  per-material resolutions (currently material decisions are deterministic
  server-side). Backend change.
- **Material drift detection** in the import plan (reuse hit a material that has
  `local_overrides` / values that differ from the file): surface a divergence
  warning like the refresh-from-catalog model. Backend change.
- **Skip for foreign constructions**: resolutions are keyed by source assembly
  id, which honeybee files lack; key by identifier to allow it. Backend change.
- **Live browser smoke**: validated via the vitest upload→preview→apply flow +
  backend route/command tests; a manual end-to-end run against the dev stack is
  still worth doing before release.

## Blockers
- None for research. Remaining sub-decisions (schema_version bump in D2;
  name-match tolerance in D3/D5) are settled during their phases.
