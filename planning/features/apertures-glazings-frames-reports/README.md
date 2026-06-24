---
DATE: 2026-06-24
TIME: 17:45 EDT
STATUS: Active — Phase 0 complete; Phase 1 next
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Two new REPORTING pages — "Apertures → Glazings" and "Apertures → Frames"
  — that mirror the "Envelope → Materials" page exactly (same report-table look,
  spacing, fonts, status chips, datasheet zones), changing only the CONTENT.
RELATED:
  - planning/features/glazing-frame-documentation/ (PREREQUISITE — builds the
    ProjectGlazing/ProjectFrame entities these pages present)
  - planning/features/report-tables/ (the report-table primitive these pages reuse;
    it explicitly names glazing + frame as the intended next consumers)
  - context/ui/pages/envelope-tab.md §2.7.3 (Materials/Specifications page — the
    page being mirrored)
  - context/ui/pages/apertures-tab.md (the Apertures tab these sub-tabs join)
---

# Apertures → Glazings / Frames — report pages (Materials clones)

## Scope

Ed's original request: two **reporting** pages, "Apertures/Glazings" and
"Apertures/Frames", that **mirror the design, functionality, and structure of
Envelope/Materials** and **reuse as much as possible** — no new styles, no new
components, no new functions unless absolutely required. The user should see no
difference in colors, fonts, spacing, padding, ordering, or behavior versus the
Materials page; **only the content changes** (glazing products / frame products
instead of materials).

Each glazing product and each frame product is shown **once** (deduped) — exactly
like Materials. With the prerequisite feature in place, "once" is structural:
each page lists the rows of one flat table (`project_glazings` / `project_frames`).

## Why this is a thin feature

The hard part is the data model, and that is the **prerequisite**
(`glazing-frame-documentation`): it turns glazings/frames into flat, deduped,
documented `ProjectGlazing`/`ProjectFrame` entities that already carry
`specification_status`, `datasheet_asset_ids`, and `catalog_origin` — the same
shape `ProjectMaterial` has. Once that lands, these pages are near-mechanical
clones of `MaterialsPanel`
(`frontend/src/features/envelope/components/MaterialsPanel.tsx`) over the report-
table primitive (`frontend/src/shared/ui/report-table/`). The report-tables PRD
already designated glazing + frame as this primitive's next consumers.

## What this feature delivers

1. **Backend read API** — `build_apertures_read_parts` selector (mirror
   `build_envelope_read_parts`) returning `ProjectGlazingRead[]` /
   `ProjectFrameRead[]` enriched with use-sites; a read endpoint; a
   glazing/frame catalog-drift report (reuse `aperture_drift`).
2. **Two report pages** — `GlazingsPanel` / `FramesPanel`, clones of
   `MaterialsPanel`: report-table rows, status filter chips, expandable rows with
   datasheet drop-zones (`AttachmentCell`) + "Used in N elements" use-sites +
   drift badge + editable spec-status (`AutocompleteSelect` styled as a status
   pill).
3. **Routing** — convert the Apertures sub-tab bar (already declares
   "Apertures · Glazings · Frames", `AperturesTab.tsx:38-42`) from state-based to
   route-based, and route `/apertures/glazings` and `/apertures/frames` to the
   two panels.
4. **Retire** the stop-gap `ProjectRefsView` modal + `refsAggregation.ts` (the
   "Phase-12 replacement for V1's Frame/Glazing sub-tabs"), now superseded by
   these pages.

## Read order

1. `PRD.md` — the contract (mirror Materials), the column maps, decisions.
2. `PLAN.md` — phase sequence.
3. `phases/` — file-level plans.
4. `STATUS.md` — current state + the blocking dependency.

## Phase map

| Phase | File | Summary |
| --- | --- | --- |
| 0 | `phases/phase-00-backend-read-api.md` | `build_apertures_read_parts` selector + `ProjectGlazingRead`/`ProjectFrameRead` + use-site DTOs + read endpoint + drift report. |
| 1 | `phases/phase-01-frontend-routing-and-panels.md` | Route-based Apertures sub-tabs; `GlazingsPanel`/`FramesPanel` shells (MaterialsPanel clones); query hooks + api + types. |
| 2 | `phases/phase-02-wire-and-retire-modal.md` | Columns, status chips, datasheet zones, use-sites, spec-status, drift; retire `ProjectRefsView` + `refsAggregation`. |
| 3 | `phases/phase-03-closeout.md` | Browser smoke (sign in as Ed), UI_UX page docs, closeout gate. |

## Dependency

The original packet was hard-blocked on `glazing-frame-documentation`, but the
current checkout already includes the required `ProjectGlazing`/`ProjectFrame`
entities, flat tables, commands, and datasheet registry entries. Phase 0 used
those seams and is complete.
