---
DATE: 2026-07-29
UPDATED: 2026-07-30 — implementation and verification complete
TIME: 14:31 EDT
STATUS: Complete
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 4 — the U-Values sub-tab page: route, query hook, grouped
  ReportTable with per-edge expansions, warnings, units, empty state.
  Frontend only; display-only.
RELATED: ../PRD.md §4, ../decisions.md §D-1/§D-5/§D-7/§D-9,
  frontend/src/features/apertures/routes/AperturesTab.tsx,
  frontend/src/features/apertures/paths.ts,
  frontend/src/shared/ui/report-table/ReportTable.tsx,
  frontend/src/shared/ui/AppSubTabs.tsx,
  context/ui/pages/apertures-tab.md, context/DESIGN_SYSTEM.md
---

# Phase 4 — U-Values report page

## Goal

`/projects/:projectId/apertures/u-values` renders the full line-by-line
report for editors (draft) and viewers (saved version), visually
consistent with the Glazings/Frames report sub-tabs, with every number
backend-supplied.

## Hazards

1. **Display-only is a hard rule.** No arithmetic in components beyond
   unit conversion/formatting. If a number isn't in the report DTO, it
   goes in the DTO — not in a `useMemo`.
2. **The fetch gate.** `AperturesTab.tsx` currently nulls the u-value
   version id off `isBuilderRoute`; extending routes without extending
   invalidation wiring is the classic "mutation didn't refresh the query"
   trap — the report query must also invalidate on `affects_u_value`.
3. **Footer must equal the chip.** Same DTO field, same formatter — if a
   test can't assert literal equality of the two rendered strings,
   something recomputed.

## Work

1. **Routing**: `aperturesUValuesPath(projectId)` in `paths.ts`; extend
   `isApertureSubroute` union with `"u-values"`; in `AperturesTab.tsx` add
   `isUValuesRoute`, a fourth `<AppSubTabLink>` labeled **U-Values**
   (after Frames), and the render branch. Update the u-value fetch gate to
   include the new route.
2. **Query layer**: `useApertureUValueReport(projectId, versionId, source)`
   with its key in `apertureQueryKeys` (and fold the existing ad-hoc
   `["apertures-u-values", …]` key into `apertureQueryKeys` while there —
   the research-flagged inconsistency). Source derivation identical to the
   builder (`reportSource`: draft for editors, version for
   viewers/locked). Register invalidation alongside the existing u-values
   invalidation on `affects_u_value`.
3. **`components/UValueReportPanel.tsx`** (+ plain-CSS module on the
   3-tier tokens; reuse `report-table` styles before writing any new
   rule):
   - **Summary table** (ReportTable): aperture name, overall W × H,
     element count, area, U-w, SHGC (header: "SHGC (glazing-area-wt)"),
     warning badge per D-7 annotation.
   - **Per-aperture sections** in document order: `ReportTable` rows per
     PRD §4.2 (name, grid label, W × H, area, glazing name/U/SHGC,
     A_glazing, A_frame, Q terms, **U_element**), `renderExpansion` for
     the per-edge grid (frame name, width, U_f, Ψ-g, Ψ-install marked
     "excluded from U-w", lengths, areas, Q terms — one row per edge,
     top/right/bottom/left order), section footer totals + U-w.
   - **Unfinished rows**: status treatment + em-dashes (never `0.00`);
     section warning line "includes n unfinished element(s) as U = 0".
   - **Legend** line: "Edges as seen from outside" + the convention note
     from provenance.
   - **Empty state** per `apertures-tab.md` conventions (no aperture
     types → copy + builder link for editors).
4. **Units**: format via `lib/units/thermal.ts`; per D-9, repoint
   `format-u-value.ts`'s `0.1761` at the precise shared constant (chip
   display unchanged at 2dp — assert in its existing test). Honor the
   global `useUnitPreference()` toggle for every value + header unit.
5. **Tests** (RTL): route renders sections from a mock DTO; footer U-w
   string === chip string for same input; unfinished row shows em-dash +
   annotation; empty state; IP/SI header/value switch; expansion opens
   with four edge rows.

## Out of scope

Download actions (Phase 5); any backend change; `apertures-tab.md` §2.6.4
(Phase 6 — but capture screenshots now for it).

## Verification

`make frontend-dev-check`; `make agent-browser-ready` then
`agent-browser.mjs` screenshots of: editor draft view with expansion open,
viewer/version view, unfinished-project view, empty state, IP and SI.
Visually reconcile one element row against the builder canvas U for the
AGENT-BROWSER fixture. `make ci` before hand-off.

## Implementation ledger

- Added the route-addressable fourth **U-Values** sub-tab, centralized report
  and chip query keys, draft/version source selection, and invalidation for
  every U-value-affecting mutation and catalog refresh.
- Added grouped summary and per-aperture `ReportTable` views with four-edge
  expansion, provenance legend, unfinished annotations, row/edge warnings,
  void exclusions, and an editor-aware empty state.
- Added SI/IP formatting for dimensions, areas, U-values, linear
  transmittances, and heat-flow terms. Shared the canonical W/K conversion
  and existing unit-label helpers rather than adding report-local constants.
- Unfinished calculated cells always render em-dashes, even when the backend
  preserves a numeric zero for rollup accounting; valid input geometry
  remains visible.
- Simplify review fixed missing report/chip invalidations, duplicate unit
  contracts, suppressed warnings, and unfinished-zero presentation.
- Focused TypeScript/RTL verification: `3` files / `13` tests passed.
  `make frontend-dev-check` passed with the repository's existing Fast
  Refresh warnings only.
- Live editor draft verification used the task-isolated `AGENT-BROWSER`
  fixture: the section footer matched the builder chip at `0.78 W/m²K`;
  SI/IP switching, summary/section tables, and all four expanded edge rows
  were exercised. The empty state was also verified before restoring the
  representative draft. Viewer source selection and unfinished rendering
  are covered by RTL rather than separate live fixtures.
- `make ci` passed: backend `1741 passed, 7 skipped`; frontend `254` files /
  `2351` tests, structural guards, and production build. `graphify update .`
  rebuilt the code graph successfully.
