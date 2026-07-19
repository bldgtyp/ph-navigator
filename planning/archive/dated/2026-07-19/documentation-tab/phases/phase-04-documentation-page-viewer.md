---
DATE: 2026-07-18
TIME: 20:12
STATUS: Done (implemented + verified 2026-07-18)
AUTHOR: Ed May (with Claude)
SCOPE: Documentation page — route, tab, sections, grid, rollup, filters, record modal — viewer-first
RELATED: ../PRD.md §D2 (final), ../assets/wireframe.html (visual contract),
         context/ui/pages/status-tab.md (projection precedent), context/UI_UX.md §1 + §1.8
---

# Phase 04 — Frontend: Documentation page (viewer-first)

## Goal

`/projects/{id}/documentation` renders the full read-only experience for
anonymous viewers (contractor/certifier) and signed-in editors alike —
**no write affordances yet** (Phase 05). Build viewer-first so the primary
audience's rendering is never an afterthought.

## Work

1. **Feature scaffold** `frontend/src/features/documentation/` following
   the feature-folder conventions (routes/, components/, hooks/lib as the
   codebase does elsewhere). `App.tsx` stays composition-only.
2. **Routing:** project tab `Documentation` (last position, per wireframe)
   → `/projects/:projectId/documentation`; legacy
   `/projects/:projectId/envelope/site-photos` route → redirect to
   `../documentation#envelope`. Locked-version banner behavior identical
   to other tabs (project-workspace doc).
3. **Data:** `useDocumentationSummaryQuery` — editors read the draft
   endpoint, viewers the saved endpoint (status-summary hook is the
   template, including query-key + invalidation strategy). One
   `useAssetUrls` call for all visible asset ids (photos + datasheet
   previews); rely on its built-in thumbnail polling.
4. **Page composition per wireframe v2.1:**
   - Header: three-chip rollup; per-axis filter chips (client-side
     filtering of the summary — no extra requests); version line.
   - Sections in PRD order; sticky headers with counts, 📖 button
     (placeholder modal shell this phase — content lands in Phase 05),
     anchor 🔗 copy-link (`#walls`, `#ventilators`, …) with
     scroll-to-anchor on load.
   - Unified grid rows; envelope assembly cards with mini cross-section
     strip (reuse the assembly SVG render scaled down if cheap — else
     colored-band strip as in wireframe, noted as acceptable v1).
   - States: photo strip / "Photo needed" / "not required ✓" / spec-na
     muted row — colors and text per §1.8 (missing ≠ error styling; use
     the report-status-chip pattern for the filter chips).
   - Fully-complete sections render as collapsed stubs with expand.
   - Record-detail modal: read-only attributes + datasheets + photos.
     Attribute lists per table: Display Name, manufacturer/model fields
     where present, the table's headline spec fields (pick per table at
     implementation; keep to ≤8 rows), notes. Lightbox reuses the
     existing `AttachmentCell` modal or its extracted viewer.
   - Empty state per US-ENV-15 criterion 2 (viewer variant without CTA).
5. **Plain CSS on the 3-tier tokens; typography per the consolidated
   variants; phone-width usable** (cards stack; grid columns collapse
   gracefully below ~700px — photos wrap under the record label).
6. **Accessibility:** section headers are landmarks; chips have text (not
   color-only); modal focus-trap + Escape per existing ModalDialog
   conventions.

## Verification

- Implemented top-level `Documentation` project tab at
  `/projects/:id/documentation`, with legacy
  `/projects/:id/envelope/site-photos` redirecting to
  `/projects/:id/documentation#envelope`.
- Added `frontend/src/features/documentation/` viewer-first scaffold:
  draft-vs-saved summary query, one bulk asset-url pass, header rollups,
  per-axis filters, section anchors/copy links, complete-section collapse,
  read-only record rows, record-detail modal, and empty state.
- Added shared summary invalidation after accepted project-document table
  slices and after in-scope Envelope/Apertures attachment or report writes.
- Simplify pass fixed accessible filter toggles (`aria-pressed`), removed
  no-op collapse controls from incomplete sections, filtered zero-record
  groups, replaced row-level upload-capable `AttachmentCell` instances with
  static read-only strips, and removed dead modal row slicing. The
  feature-level `query-keys.ts` wrapper remains because the repo shape guard
  requires it.
- Focused frontend verification:
  `pnpm exec tsc -b --pretty false` -> passed;
  `pnpm exec vitest run
  src/features/documentation/__tests__/DocumentationSummaryView.test.tsx
  src/App.test.tsx` -> 2 files / 34 tests passed.
- Frontend gate before docs-pass:
  `make frontend-dev-check` -> passed with pre-existing Fast Refresh warnings
  and Vite chunk-size warnings only.
- Browser smoke after `make agent-browser-ready`:
  desktop and 390px routes rendered the Documentation tab empty state with
  rollup `Spec 0/0`, `Datasheets 0/0`, `Photos 0/0`; legacy site-photos
  route redirected to `/documentation#envelope`; no upload affordances were
  present. The AGENT-BROWSER fixture had zero documentation records, so row,
  filter, and modal behavior are covered by the focused Vitest fixture rather
  than live seeded rows in this phase.
- Graphify: `graphify update .` completed and updated `graphify-out/`.
- Full closeout gate: `make ci` -> backend 1419 passed, 7 skipped, 1 existing
  `HTTP_413_REQUEST_ENTITY_TOO_LARGE` deprecation warning; frontend 242 test
  files / 2237 tests passed; build passed with existing warning classes.
