---
DATE: 2026-07-29
TIME: 14:17 EDT
STATUS: Complete — codebase + example-artifact research done 2026-07-29
AUTHOR: Claude (Fable 5)
SCOPE: Research notes — decoded Phius example spreadsheet, backend calc code
  map, frontend page map, export precedents, and the edge-case inventory that
  drove the PRD.
RELATED: ./PRD.md, ./decisions.md
---

# Research — Aperture U-Value Detail Report

## 1. Backend calculation code map

Feature slice `backend/features/aperture_u_value/` (no `repository.py` —
pure computation over the loaded JSONB document body):

- `service.py` — ISO 10077-1:2006 math. Entry:
  `calculate_aperture_u_values(entry: ApertureTypeEntry, tables) -> ApertureUValueResult`.
  - Per element (`_calculate_element`, ~L213-251): interior dims = overall
    minus opposing frame widths; `A_glazing = int_w × int_h`;
    `Q_g = A_glazing × U_g`; `Q_f = Σ _side_frame_q(...)`;
    `Q_ψ = Σ (interior_len × Ψ_g)`; `U_el = (Q_g+Q_f+Q_ψ)/(W×H)`.
  - **45° corner split** (`_side_frame_q`, L262-274): each edge carries a
    center strip (`width × interior_len`) plus *half* of each of its two
    corner rectangles.
  - Aggregation (L76-99): `U_w = Σ(round(U_el,4) × A_el) / Σ A_el` over
    glazed elements only. Note: weights the **rounded** element U.
  - **Per-side intermediates are computed inline and discarded** — the
    single biggest gap for this feature. Phase 1 refactors the service to
    emit them (parity-locked).
- `models.py` — `ApertureElementUValue` (element_id, u, area, glazing_area,
  frame_area, warnings), `ApertureUValueResult`, list response. No names,
  no per-side data, no frame/glazing ids — report needs a richer DTO.
- `routes.py` — `GET …/versions/{vid}/apertures/u-values?source=draft|version`,
  `require_project_view_access` only (no capability gate).
- `cache.py` — SHA-256 content hash over thermally-relevant fields only
  (**names deliberately excluded**), FIFO(256). A name-bearing report DTO
  cannot reuse this cache as-is (PRD §6.11).
- MCP: `apertures_mcp/tools.py` `tool_calculate_aperture_u_values` — thin
  wrapper; a sibling report tool is a natural Phase 2/3 add.

### Data model (`features/project_document/envelope_models.py`)

- `ApertureTypeEntry`: `id, name, row_heights_mm[], column_widths_mm[],
  elements[]`; coverage invariant = every grid cell covered exactly once.
- `ApertureElement`: `id, name, kind: "glazed"|"void", row_span,
  column_span, frames{top,right,bottom,left: frame_id|None}, glazing_id,
  operation`. Void elements must carry no frames/glazing/operation.
- `ProjectFrame`: thermal fields `width_mm, u_value_w_m2k, psi_g_w_mk,
  psi_install_w_mk` (all nullable) + descriptive fields + `catalog_origin`.
- `ProjectGlazing`: `u_value_w_m2k, g_value` (= SHGC) + descriptive.
- All three tables live **in the project document** — no catalog join
  needed for the report.

## 2. The Phius example artifact, decoded

`_260701 Window Unit Detailed U-Values.xlsx` ("Window Units" sheet,
230 rows, IP units). One row per window **element**, named
`<Type>_C<col>_R<row>` (grid position within the type — element-level, not
building-instance-level; maps 1:1 to PHN's element model).

Columns: glazing SHGC + U; per edge (L/R/T/B): edge length, frame width
(in + ft), U_f, PSI-G, PSI-INST. Then live formulas per edge: interior
length (edge minus adjacent frame widths), corner area, middle area, frame
area, HL frame (U×A), HL spacer (len_int×Ψg), HL install (edge_len×Ψinst),
HL total. Then: glazing area, HL glazing, HL frames total, window area,
`U-win = (HL_glazing + HL_frames)/A_window`, window type via
`LEFT(name, FIND("_C",name)-1)`, and area-weighted rollups via
`SUMPRODUCT((type=type)×U×A)/SUMIF(type, A)`. Second sheet
"Window-Units (Summary)": pivot of type → area-weighted SHGC and U.

### Deltas vs PHN's math (drive decisions D-2/D-6 and PRD §6.9)

| Aspect | Example sheet | PHN service |
| --- | --- | --- |
| Corner areas | fully charged to top/bottom frames | 45° split, half to each adjacent frame |
| ψ-install | own HL column (`edge_len × Ψinst`), values mostly 0 | excluded entirely (uninstalled U-w) |
| SHGC rollup | area-weighted by whole window area | not computed today (new field) |
| Shared mullions | each element charges full frame width | same — convention parity |
| Units | IP | SI storage; IP is frontend display-only today |

## 3. Frontend page map

- Routing: generic `/projects/:projectId/:tab/*` → `ProjectShell`;
  sub-routing lives inside `features/apertures/routes/AperturesTab.tsx`
  (608 lines, `@size-exception`). Paths in `features/apertures/paths.ts`.
- Sub-tabs: `AppSubTabs`/`AppSubTabLink` (`shared/ui/AppSubTabs.tsx`) —
  currently Apertures | Glazings | Frames. Supports `actions` slot. Adding
  a route = path fn + `isXRoute` flag + link + render branch.
- U-value fetch: `hooks/useApertureUValues.ts` (TanStack, ad-hoc key
  `["apertures-u-values", …]`, not in `apertureQueryKeys` — inconsistency
  worth matching-or-fixing). Currently gated to the builder route
  (`builderVersionId = isBuilderRoute ? … : null`) — must extend for the
  report route. Invalidation via `affects_u_value` on the command envelope.
- Display: `components/UValueChip.tsx` (tooltip text = the de-facto spec:
  "ISO 10077-1:2006 … Uninstalled value (excludes ψ-install)");
  per-element U on canvas via `uValueByElementId`.
- Table component: **`ReportTable`** (`shared/ui/report-table/`) — CSS-grid,
  `unit?` header slot, expandable rows (`renderExpansion`), used by
  `ApertureSpecReportPanel.tsx` (Glazings/Frames). `DataTable` is the
  editable grid — wrong tool for a read-only report.
- Units: `TopbarUnitToggle` → `useUnitPreference()`; IP conversion is
  frontend-only today, with **two constants** (`format-u-value.ts` 0.1761
  vs `lib/units/thermal.ts` 0.1761101838) → decision D-9.
- Orientation: `frame-label-map.ts` — document stores exterior-canonical
  left/right; interior view swaps labels → decision D-5.

## 4. Export precedents

Backend:
- **openpyxl 3.1.5 already in `backend/pyproject.toml`** (read-only use in
  climate importers). Writing formulas = first write-use; tests already
  construct `Workbook()`.
- `features/shared/responses.py` — `json_download_response`,
  `zip_download_response`; **add `csv_download_response` /
  `xlsx_download_response` here**.
- Closest full precedent: PHPP export (`features/envelope/phpp_export.py` +
  `routes.py` L104-122): preflight endpoint, `units: UnitSystem = "SI"`
  query param, capability gate, and the "unrepresentable row still emits an
  error CSV instead of a 422" doctrine — reused for unfinished elements.
- Raw-CSV response: `features/heat_pumps/routes.py` (`format=` enum; note
  its `xlsx-paste` arm is a deliberate 501 — read before adding format
  enums). Its serializer converts to IP backend-side "because the Phius
  calc expects IP" — precedent for D-4/units handling.

Frontend:
- `shared/lib/downloadBlob.ts` — the blob-download helper to use.
- `features/apertures/components/ExportHbjsonAction.tsx` — the aperture-page
  menu-item download pattern (busy state, error → action banner, filename
  slug helper).
- `features/envelope/hooks/useEnvelopePhppExport.ts` +
  `PhppExportWarningDialog.tsx` + `confirmDraftExport` — the two-step
  guarded export controller to copy.
- CSV conventions to match (not reuse — it's DataTable-coupled):
  `shared/ui/data-table/lib/export/csv.ts` — UTF-8 BOM ("without it Excel
  mangles m²"), CRLF, minimal quoting, `sanitizeFilename()` (reusable).

## 5. Edge-case inventory (source of PRD §6)

Void elements excluded from calc; missing/incomplete frame or glazing →
element U hard-zeros **and still weights into U-w**; `_frame_data` treats
assigned-but-incomplete frames (null width/U/Ψg) as "missing" with a
misleading message; `non_positive_glazing_area` when frames ≥ element
width; `mullion_frame_at_void_boundary` warning; ψ-install never read;
full-width shared mullions double-count frame area (parity with example);
rounding: areas 6dp, U 4dp pre-weighting; draft-vs-version `source` param
everywhere; report DTO with names can't reuse the name-blind cache.

## 6. Docs & conventions touched

- `context/ui/pages/apertures-tab.md` — §2.6.2/§2.6.3 are the template for
  the new §2.6.4 (columns by name, expansion content, editor-vs-viewer);
  empty-panel copy contract at L48-61; read
  `context/ui/pages/.instructions.md` before editing.
- `backend/.instructions.md` — layers, `ty` strict typing, `uv` only,
  "all calculations live here".
- `frontend/.instructions.md` — display-only, plain CSS on tokens, TanStack.
- Prior art in archive: `planning/archive/dated/2026-06-24/`
  `apertures-glazings-frames-reports/` (the previous "add a report sub-tab
  to Apertures" feature) and `2026-07-28/aperture-void-panels/`.
