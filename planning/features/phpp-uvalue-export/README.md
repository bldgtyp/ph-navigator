---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Implementing — Phase 1 (backend export core) done 2026-06-24; Phases 2–4 pending
AUTHOR: Ed (via Claude)
SCOPE: Add "Download in PHPP format" to ENVELOPE → Assemblies (a second item in
  the existing "…" Assembly-actions menu, next to "Download constructions
  HBJSON"). Produce one CSV per assembly — laid out to match the PHPP "U-Values"
  worksheet so a consultant can copy/paste it directly — bundled into a single
  ZIP. The CSV respects the app's live IP/SI unit preference. Assemblies that
  cannot be represented in PHPP (too many layers, too many heat-flow pathways,
  or incomplete materials) get an explicit error CSV (never a partial one) plus
  a confirm/cancel modal before the download proceeds.
RELATED:
  - context/PRD.md §15 (export is a saved-version deliverable, not a draft preview)
  - context/ui/pages/envelope-tab.md (the "…" Assembly-actions menu lives here)
  - context/CODING_STANDARDS.md (backend feature layering; frontend rules)
  - backend/features/envelope/hbjson_export.py (the export precedent we mirror)
  - backend/features/envelope/thermal.py (U-value / total-R already computed in SI)
  - backend/features/envelope/routes.py (`GET /envelope/export/hbjson` route shape)
  - backend/features/shared/responses.py (`json_download_response` → add zip variant)
  - backend/features/assets/service.py (`_run_bulk_download` — stdlib zip+csv precedent)
  - backend/features/project_document/envelope_models.py (Assembly/Layer/Segment/Material)
  - frontend/src/features/envelope/routes/EnvelopePage.tsx (`exportHbjson`, "…" menu)
  - frontend/src/features/envelope/hooks.ts (`useEnvelopeHbjsonExportMutation`)
  - frontend/src/features/envelope/api.ts (`downloadEnvelopeHbjson` → add PHPP calls)
  - frontend/src/lib/units/ (`useUnitPreference`, length/thermal converters)
  - frontend/src/shared/ui/ModalDialog.tsx + DialogActions.tsx (error/confirm modal)
  - frontend/src/shared/lib/downloadBlob.ts (browser save helper)
  - planning/features/envelope-hbjson-import/ (sibling envelope-export/import feature)
---

# PHPP U-Value Export — Feature Folder

## Scope

Add a **"Download in PHPP format"** action to the Envelope → Assemblies "…"
menu, beside the existing **"Download constructions HBJSON"**. It downloads a
**ZIP of per-assembly CSVs**, each CSV laid out to mirror the PHPP **U-Values**
worksheet so the consultant can select a block and paste it straight in.

This is the natural sibling of the existing HBJSON export: it reads the same
**saved version** document, runs through the same envelope feature layer, and
streams a file to the browser the same way. The novel parts are (1) the
SI→PHPP CSV layout, (2) respecting the live IP/SI toggle, (3) the
PH-Nav-segments → PHPP-3-sections mapping, and (4) per-assembly error CSVs +
a confirm/cancel modal instead of HBJSON's all-or-nothing 422.

## Read order

1. `README.md` (this file) — scope + phase map.
2. `STATUS.md` — current state, next step, blockers.
3. `decisions.md` — the four resolved design questions + the open details to
   confirm before/while coding (read this before Phase 1 — two cells of the CSV
   layout and the "2 vs 3 sections" cap are still soft).
4. `PRD.md` — the behavior contract and the **canonical CSV layout spec**.
5. `research.md` — codebase findings (export pipeline, units, thermal, models)
   with concrete file paths, so the implementer doesn't re-discover them.
6. `phases/phase-0N-*.md` — the active phase plan.

## Phase map

| Phase | Title | Output |
| --- | --- | --- |
| 1 | Backend export core | `backend/features/envelope/phpp_export.py`: segment→section mapping, eligibility (≤8 rows, ≤3 consistent pathways, complete materials), full-block CSV render (SI), filename sanitize/dedupe, in-memory ZIP. Pytest with golden CSVs. |
| 2 | Backend routes + units | `GET …/envelope/export/phpp/preflight` (per-assembly eligibility JSON) and `GET …/envelope/export/phpp?units=IP\|SI` (zip stream). `zip_download_response` helper. IP `[ X.X in ]` annotation. Route tests. |
| 3 | Frontend wiring | `api.ts` calls, export hook + preflight, the new `AppMenuItem`, draft-version warning, the confirm/cancel error modal (`ModalDialog`+`DialogActions`), `downloadBlob`. Vitest. |
| 4 | Verify + docs + closeout | Playwright walkthrough (SI, IP, error case); validate real PHPP copy/paste alignment and finalize soft cells; run the closeout gate (simplify, docs-pass, `make format`, `make ci`); fold decisions into `context/`. |

## Non-goals (v1)

- No new persisted data and no schema-version bump — pure read/serialize.
- No Rsi/Rse surface resistances (PHN is construction-only; we emit `0.00`,
  exactly as the screenshots show — PHPP applies its own).
- No `.xlsx`/native-PHPP writing — CSV only, for copy/paste.
- No steel-stud "modified zone" correction translated into PHPP (a split
  segment is exported as an ordinary parallel-path section).
- Reading the **draft** — like HBJSON, the export reads the last **saved
  version** and warns if an unsaved draft exists.
