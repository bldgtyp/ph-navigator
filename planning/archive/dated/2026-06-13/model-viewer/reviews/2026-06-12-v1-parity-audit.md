---
DATE: 2026-06-12
TIME: -
STATUS: Complete — audit of V1 frontend affordances vs. V2 plan
AUTHOR: Claude (for Ed)
SCOPE: Component-by-component parity audit of
  ../ph-navigator/frontend/src/features/project_view/model_viewer/
  against this folder's PRD/UI_SPEC. Read from V1 SOURCE (not the
  reference doc) on Ed's request.
RELATED:
  - research/v1-3d-model-viewer-reference.md
  - planning/archive/model-viewer/UI_SPEC.md
  - planning/archive/model-viewer/decisions.md (OQ-4 added by this audit)
---

# V1 → V2 Parity Audit (frontend affordances)

Method: read every V1 UI component (`Viewer.tsx`, `World.tsx`,
`Model.tsx`, `_components/*` incl. `fieldConfigs.ts`,
`ColorByLegend`, `ModelSelector`, both menubars) plus a grep for
keyboard / double-click / wheel affordances (none exist in V1).

## Verdict

Full capability parity, with three findings folded back into the
planning docs (see "Findings" below). No V1 affordance is silently
dropped: each is carried, relocated, or retired by a recorded
decision.

## Mapping table

| # | V1 affordance (source) | V2 disposition |
|---|---|---|
| 1 | Model-date dropdown, newest-first, selected highlight (`ModelSelector.tsx`) | File chip + popover (UI_SPEC §2); richer rows (name/size/uploader/notes) |
| 2 | "(Latest)" annotation on newest row | **Was missing — added to UI_SPEC §2** (Finding F-2) |
| 3 | Per-row "Refresh from AirTable" (cache-bypass re-download) | Obsolete by architecture: immutable R2 files, no backend cache (D-I3). Residual need covered by popover "Refresh list" footer |
| 4 | Selector hidden when ≤1 model; disabled while list loads | V2 chip always visible (it is also the upload entry point) — deliberate improvement |
| 5 | 7 viz-state icon buttons + hover tooltips (`VizStateMenubar.tsx`) | 6 labeled lenses + theme menu; 1:1 capability map in PRD §4.1 (D-03) |
| 6 | Click-active-button reverts to Geometry | Dropped — segmented control has no "off" state (D-03, recorded) |
| 7 | ColorBy submenu: 6 attributes, per-item icons, divider grouping | Theme dropdown per lens; same 6 attributes; grouping preserved by lens applicability |
| 8 | Select tool: arm → click-pick, hover highlight, 5 px drag-vs-click (`ToolStateMenubar`, `selectObject/selectMesh`) | Always-on selection (D-04); 5 px tolerance kept |
| 9 | Measure tool: vertex snap, accumulating dimension lines, CSS2D labels, clear-on-exit (`modeMeasurement`) | Measure mode (UI_SPEC §7); labels scoped to canvas (V1 body-leak fixed) |
| 10 | Comments placeholder button (no behavior) | Retired (US-Viewer arch decision 4, Ed 2026-05-10) |
| 11 | Info panel: per-type field configs, identifier row under header, ⓘ field tooltips, IP/SI conversion (`ElementInfoPanel`, `InfoField`, `fieldConfigs.ts`) | Inspector (UI_SPEC §6); pipe fields extended per Q-VIEW-4; duct gains Supply/Exhaust type; copy-ID added |
| 12 | Info panel fallback for unknown userData types ("Element" + Type + ID) | **Was missing — added to UI_SPEC §6** (Finding F-3) |
| 13 | Empty/null fields: row is hidden (not `--`) | V2 renders `--` deliberately (US-VIEW-6 crit. 9 mischaracterized V1; noted in UI_SPEC §6) |
| 14 | U-Factor / R-Factor tooltips: "**including** … air films" (honeybee `u_factor`) | **Semantic conflict with planned "U-Value excludes films" labels — OQ-4 opened** (Finding F-1) |
| 15 | Legend: title per attribute, static maps drop `default`, dynamic items sorted alphabetically (`ColorByLegend.tsx`) | Legend card (UI_SPEC §4) same rules + counts (D-11) |
| 16 | Pipe/duct hover + select highlight via thick-line raycast (`modePipes`, `selectLineSegment2`) | Ventilation / Hot Water lens selectability; raycast threshold note added to PLAN Phase 4 |
| 17 | Viz-state switch clears selection (`World.tsx` effect) | Lens switch clears selection (UI_SPEC §6) |
| 18 | Blocking loading dialog; `alert()` on error (`Model.tsx`) | Progress chip + in-canvas error/Retry (D-06) |
| 19 | Z-up camera, FOV 45, orbit rotate 0.9 / zoom 3.0, shadows, ground + grid (`SceneSetup`) | Preserved values; dressing modernized (D-08, recorded) |
| 20 | Window-resize handling (`onResize`) | R3F handles automatically |
| 21 | Default entry state: Geometry-equivalent view, no tool armed | Building lens + live selection — strictly more capable |

## Not ported (inactive / dead in V1 — no parity owed)

- Disabled troika aperture text labels (`load_faces`, TODO'd off).
- `SAOPass` instantiated but never added to composer.
- `showModel` prop (hardcoded `true`, vestigial).
- Note: V1-reference §13.1 claims `VizStateMenubar` is unmounted;
  current V1 source mounts it via `BottomMenubar`. Reference doc is
  stale on that point only — no V2 impact.

## Findings folded back

- **F-1 (semantic, important):** V1 displays honeybee `u_factor`
  (films INCLUDED). US-VIEW-6 crit. 7 plans "U-Value" labels with an
  "excludes films" tooltip — a different quantity. → `decisions.md`
  OQ-4; must resolve before Phase 2 schema work.
- **F-2:** "(Latest)" marker on newest file → UI_SPEC §2.
- **F-3:** unknown-element fallback inspector card → UI_SPEC §6.
