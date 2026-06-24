---
DATE: 2026-06-24
TIME: 17:58 EDT
STATUS: Complete — implementation and closeout gates green; archived
AUTHOR: Codex with Ed May
SCOPE: Promote aperture glazing/frame refs from inline per-element snapshots into
  flat, deduped, documented project entities (`ProjectGlazing` / `ProjectFrame`)
  that mirror `ProjectMaterial` — gaining datasheet "bookshelf" linking and
  `specification_status`. Backend data-model + write-path refactor plus the
  aperture-builder frontend rewire. No user-visible builder change.
RELATED:
  - planning/features/apertures-glazings-frames-reports/ (the consumer feature — the
    two report pages; BLOCKED on this one)
  - planning/features/report-tables/ (the report-table primitive; names glazing +
    frame as the intended next consumers)
  - planning/features/window-glass-catalog-enums/ (glazing catalog enums; its
    Phase 5 frontend is still pending — coordinate, see "Sequencing")
  - context/technical-requirements/data-model.md (the JSON-document model)
  - context/ui/pages/envelope-tab.md §2.7.3 (the Materials/Specifications precedent)
---

# Glazing + Frame Documentation — documented project entities (Materials parity)

## Why this exists

Ed wants to **link datasheets to glazings and frames the same way we do for
materials** (the bookshelf model), and to "mimic and adopt the data-structure
patterns from Materials wherever we can." Today that is impossible, because
glazings and frames are stored in a fundamentally different shape than
materials:

| | Materials (target pattern) | Glazings / Frames (today) |
| --- | --- | --- |
| Storage | flat **deduped** table `tables.project_materials[]`, one row per unique product | **inline snapshots** embedded per aperture element (`elements[].glazing`, `elements[].frames.{top,right,bottom,left}`) |
| Reference | segment → `project_material_id` (FK) | none — the full ref is copied into every slot |
| Datasheets | `datasheet_asset_ids[]` per product (bookshelf) | only a single `datasheet_url` string per inline ref |
| Spec status | `specification_status` per product | none |
| Dedup | structural (one row per product) | only `catalog_origin.catalog_record_id` lets you *recompute* uniqueness |

**The core insight (the same one that drove the V1→V2 Materials restructure,
envelope-tab.md §2.7.3 / Q-ENV-2):** *datasheets and spec-status are
per-product questions, not per-use questions.* You cannot attach a datasheet
"to a frame" when the frame exists as four independent inline copies on every
window that uses it. So delivering Ed's ask **requires** promoting glazings and
frames to flat, deduped, documented project entities — `ProjectGlazing` and
`ProjectFrame` that carry `specification_status` + `datasheet_asset_ids` +
`catalog_origin`, exactly like `ProjectMaterial`, with aperture elements
referencing them by FK id.

This feature is that promotion. It is the **prerequisite first step** Ed asked
to break out. It ships no new page — the aperture builder looks and behaves the
same to the user — but afterwards glazings/frames are documentable entities and
the two report pages (the sibling feature) can be built as thin
`MaterialsPanel` clones.

## What this feature delivers

1. New document models `ProjectGlazing` / `ProjectFrame` (mirror `ProjectMaterial`).
2. New flat tables `tables.project_glazings[]` / `tables.project_frames[]`.
3. Aperture elements reference glazing/frame **by FK id** instead of inline refs.
4. A v11→v12 document migration that hoists existing inline refs into the flat
   tables and rewrites elements to FK.
5. Every write site that constructed an inline ref now **upserts** a flat entity
   (dedup by `catalog_record_id`) and sets the FK — backend-owned, so the pick
   command and the builder UI barely change.
6. Documentation commands (`update_project_glazing/frame`, `remove_*`) +
   datasheet attachment wired through the generic asset registry +
   write-validation. (No dedicated UI yet — surfaced by the report pages in the
   sibling feature; verified here at the API/integration level.)
7. Drift comparator reads the flat entity vs. catalog (unchanged logic, new source).

**Behavior change to flag (intended):** the flat model imposes Materials'
**shared-edit semantics** — editing a `ProjectFrame` changes every aperture
slot that references it; to make one slot different you pick/enter a different
product (the Materials "detach to a new material" pattern). This replaces
today's per-slot-independent inline editing. See PRD §"Semantics change".

## Read order

1. `PRD.md` — the contract: models, tables, FK, dedup rules, semantics change,
   invariants, non-goals.
2. `decisions.md` — the accepted design calls (all resolved; D-2 = Option A).
3. `PLAN.md` — phase sequence + dependency order.
4. `phases/` — file-level implementation plans (real `file:line` anchors).
5. `STATUS.md` — current state, next step, verification ledger.

## Phase map

| Phase | File | Summary |
| --- | --- | --- |
| 0 | `phases/phase-00-models-and-tables.md` | `ProjectGlazing`/`ProjectFrame` models; `project_glazings`/`project_frames` tables; element FK fields; cross-table validation; `ensure_project_*` upsert/dedup helpers. |
| 1 | `phases/phase-01-document-migration.md` | v11→v12 `mode="before"` document migration (inline → flat + FK); seeds/templates; golden-corpus test. Lands with Phase 0. |
| 2 | `phases/phase-02-rewire-write-path.md` | Rewire every inline-ref construction site (pick handlers, factories, default_refs, _ref_helpers, refresh, HBJSON import) to upsert flat + set FK. Drift comparator re-source. |
| 3 | `phases/phase-03-documentation-commands-and-assets.md` | `update_/remove_project_glazing/frame` commands; datasheet asset-registry extension; write-validation; tests. |
| 4 | `phases/phase-04-frontend-builder-rewire.md` | Aperture builder reads FK → resolves against flat tables for canvas/inspector; types updated; visual parity; no user-facing change. |
| 5 | `phases/phase-05-closeout.md` | Fold decisions into `context/`; `simplify` + `docs-pass` + `make ci`; ready the sibling report-pages feature. |

Dependency order: 0+1 (co-land) → 2 → 3 → 4 → 5. Phases 0–3 are backend and
each ends green on `make ci`; Phase 4 is the only frontend phase here.

## Sequencing note (window-glass-catalog-enums Phase 5)

`window-glass-catalog-enums` paused before its **Phase 5 (frontend)**, which
touches the glazing catalog UI and "overlaps a frontend area Ed is actively
editing." This feature's Phase 4 also touches the aperture builder frontend.
Land the catalog-enums Phase 5 first (or explicitly coordinate), so the
glazing single-select / derived-name UI is settled before the builder rewire
moves on top of it. The backend halves are independent.
