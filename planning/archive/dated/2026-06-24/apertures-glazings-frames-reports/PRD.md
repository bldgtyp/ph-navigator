---
DATE: 2026-06-24
TIME: 17:45 EDT
STATUS: Planning
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Product/behavior contract + decisions for the two aperture spec-report pages.
RELATED: ./README.md, ./PLAN.md, ./phases/,
  ../glazing-frame-documentation/ (prerequisite)
---

# PRD — Apertures → Glazings / Frames report pages

## North star

These pages are **`MaterialsPanel` with different content.** Reuse the report-
table primitive, the status chips, the datasheet zone, the empty-state, the
section grouping, the sort order — everything. A user moving between
Envelope/Materials and Apertures/Glazings should see an identical visual and
interaction language; only the rows and columns differ. This is an explicit
Ed constraint: "no new styles, no new components, no new functions unless
absolutely required."

Template to clone:
`frontend/src/features/envelope/components/MaterialsPanel.tsx` (full).
Shared primitives reused verbatim: `ReportTable`, `StatusDot`,
`StatusFilterChips`, `AttachmentChipCell` (`shared/ui/report-table/`),
`AutocompleteSelect`, `AttachmentCell` + `useAssetUrls` +
`DATASHEET_ATTACHMENT_CONFIG` (`features/assets/`).

## Page 1 — Apertures → Glazings (`/projects/{id}/apertures/glazings`)

Lists every unique `ProjectGlazing` in the project, once each.

**Columns** (mirror Materials' column shape: a bold primary name, a few numeric
spec columns with two-line label+unit headers, a datasheet chip, a status pill):

| Column | Source | Notes |
| --- | --- | --- |
| Glazing (primary) | `name` | bold; clickable to expand |
| Manufacturer | `manufacturer` | text |
| U-value | `u_value_w_m2k` | numeric, right-aligned, unit per active IP/SI |
| g-value (SHGC) | `g_value` | numeric, unitless |
| Datasheet | `datasheet_asset_ids.length` | `AttachmentChipCell` |
| Status | `specification_status` | `StatusDot` + `AutocompleteSelect` pill |

## Page 2 — Apertures → Frames (`/projects/{id}/apertures/frames`)

Lists every unique `ProjectFrame` in the project, once each.

| Column | Source | Notes |
| --- | --- | --- |
| Frame (primary) | `name` | bold; clickable to expand |
| Manufacturer | `manufacturer` | text |
| U-value | `u_value_w_m2k` | numeric |
| Ψ-install | `psi_install_w_mk` | numeric |
| Width | `width_mm` | numeric, IP/SI length |
| Datasheet | `datasheet_asset_ids.length` | `AttachmentChipCell` |
| Status | `specification_status` | status pill |

(Column set is the minimal spec-meaningful mirror of Materials' 7 columns;
adjust during Phase 2 if Ed wants brand/operation surfaced. Keep it to the same
visual density — one dense row per product.)

## Expanded row (mirror MaterialsPanel expansion, `MaterialsPanel.tsx:305-405`)

- **Left:** `Datasheets` — `AttachmentCell` over `datasheet_asset_ids`
  (drag-and-drop, the bookshelf datasheet flow wired in the prerequisite via
  `assets/registry.py`), disabled when status = N/A; drift badge + "Refresh from
  catalog" when drifted; comments for viewers.
- **Right:** `Used in N elements` — use-site sub-rows from the read model. Each
  row shows the aperture path: `<aperture type name> · <element name>` for
  glazings, `<aperture type name> · <element name> · <side>` for frames.
- **Photos:** **omitted in v1** (aperture use-sites carry no install photos yet —
  Feature 1 D-5). No "Photos" column; the use-site rows have no photo zone. The
  read DTO carries the field shape so photos can be added later with no schema
  change.

## Sort + grouping + filter (mirror Materials)

- Status filter chip row (`StatusFilterChips`) with All / Missing / Question /
  Complete / N/A counts + the `n/total resolved` summary
  (`MaterialsPanel.tsx:411-416`).
- Section grouping: In-scope → N/A → Unused, where **Unused** = entities with no
  use-sites (a `ProjectGlazing`/`ProjectFrame` referenced by no element, e.g.
  after the last window using it changed product). Same three-section layout as
  Materials (`MaterialsPanel.tsx:104-114, 417-455`).
- Sort within group by `naturalSortCompare(name)` (reuse the materials sort or a
  shared helper).
- Viewer visibility: hide N/A + Unused from viewers (mirror
  `viewerVisibleMaterials`).

## Editing (mirror Materials)

- Spec-status `<AutocompleteSelect>` → dispatches `update_project_glazing` /
  `update_project_frame` (built in the prerequisite Phase 3).
- Datasheet attach/detach → the generic asset flow with
  `tableKey: "project_glazings" | "project_frames"` (mirror
  `MaterialsPanel.tsx:338-346` `onAttachmentChange`).
- Row `⋯`/pencil → edit values (optional; can reuse a `ProjectMaterialEditorModal`-
  style editor or defer field-editing to the builder). Remove-unused `X` on
  Unused rows → `remove_project_glazing/frame`.
- Locked-version + viewer gates identical to Materials.

## Backend read API (mirror envelope)

- `build_apertures_read_parts(body)` — selector mirroring
  `backend/features/envelope/selectors.py:build_envelope_read_parts` — one pass
  over `tables.apertures`, collecting use-sites per `glazing_id` / per frame-slot
  id, returning `ProjectGlazingRead[]` / `ProjectFrameRead[]`
  (entity + `use_sites[]`).
- Use-site DTOs `ProjectGlazingUseSite` / `ProjectFrameUseSite` (mirror
  `ProjectMaterialUseSite`): `aperture_type_id`, `aperture_type_name`,
  `element_id`, `element_name`, and (frames only) `side`.
- Read endpoint mirroring `GET .../versions/{id}/envelope` — e.g.
  `GET .../versions/{id}/apertures/spec-report?source=...` (or extend the
  apertures slice). Frontend fetches via a TanStack hook mirroring
  `useEnvelopeReadQuery`.
- Drift report: reuse `aperture_drift` (re-sourced in the prerequisite Phase 2)
  to flag drifted entities; surface in the expansion exactly like
  `MaterialDriftBadge`.

## Non-goals / decisions

- **D-R1:** No new visual design. Reuse report-table tokens/classes; if a token
  is missing, add it in `tokens.css` (not at the call site) — but expect none to
  be missing (Materials already exercises them).
- **D-R2:** Route-based sub-tabs (convert `AppSubTabButton` →
  `AppSubTabLink`, mirror Envelope) so the pages are deep-linkable like
  `/envelope/materials`.
- **D-R3:** Retire `ProjectRefsView` + `refsAggregation.ts` once both pages are
  live. They were the interim glazing/frame report; these pages replace them.
- **D-R4:** Photos omitted in v1 (Feature 1 D-5).
- **D-R5:** Field-editing UI (beyond spec-status + datasheets) is optional in
  v1; spec-status + datasheet linking are the must-haves (Ed's ask). Confirm
  scope at Phase 2.
