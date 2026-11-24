---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Implemented
AUTHOR: Claude with Ed May
SCOPE: State ledger for aperture catalog-drift UX parity.
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Aperture catalog-drift UX parity

**Issue:** [#74](https://github.com/bldgtyp/ph-navigator/issues/74)

## Current state

`Implemented`. Aligned Apertures catalog-drift UX with Envelope materials:
- Added `frontend/src/features/apertures/drift.ts` separating review-worthy drift from customized-only (`in_local_overrides`) entries.
- Promoted shared drift flag, action, compare-card, and entry-list CSS to `frontend/src/styles/modals.css` and removed hand-rolled `.aperture-drift-modal__*` rules.
- Added collapsed-row `ApertureDriftFlag` and single consolidated `ApertureCatalogAction` in `ApertureSpecReportPanel.tsx`, removing the split header badge and bottom list.
- Updated `BuilderDriftBanner.tsx` to report project-wide + active-aperture counts honestly and use `ModalDialog` (`ApertureDriftEntriesModal`).
- Updated `RefreshDialog.tsx` to compare cards, `.modal-lede`, shared `SegmentedControl`, count-bearing submit label, and read-only disabled-primary handling for `catalog_row_missing`.

## Resolved decisions

- **Q1 (customized analogue)**: Entries whose every differing field is in `in_local_overrides` are treated as deliberate local overrides (excluded from alarm flags and banner counts, offered a secondary compare action).
- **Q2 (row-level granularity)**: Product report rows deduplicate changed field keys across use sites and report affected element counts separately; clicking the consolidated action opens `RefreshDialog` directly because refreshing updates the shared project product.
- **Q3 (shared segmented control)**: Consumed `SegmentedControl` from `shared/ui`.

## Blockers

None.

## Verification recipe

The materials work was verified against a real drifted fixture; do the same
here. Aperture drift needs a project aperture whose catalog frame/glazing row
moved after it was copied in:

1. `make agent-browser-ready` — starts :5173/:8000 and seeds `AGENT-BROWSER`
   (`codex@example.com`).
2. Add an aperture type with a catalog-origin frame and glazing via the
   `phn-local` MCP `apply_aperture_command` (pass the current `draft_etag` as
   `if_match`).
3. Create drift by editing the **catalog** row directly, then restoring it —
   drift is a field-value comparison, so the sequence matters: pick the
   material into the project *before* the catalog value differs, or edit the
   catalog after the pick.
   ```
   uv run python -c "import psycopg; ..."   # backend/, dsn postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2
   ```
4. Screenshot with `node scripts/agent-browser.mjs <route> --click 'role=button[name="Restore draft"]' --out …`
   (the fixture has a dirty draft, so the recovery modal must be dismissed first).
5. **Restore every catalog row you edited and delete the scratch aperture.**
   The local catalog is global; leaving it edited is the "dev DB stale vs seed"
   trap.

## Log

- **2026-08-03** — Packet created. Audit performed while shipping the Envelope
  materials equivalent; six concrete defects recorded in `PRD.md` (A-1…A-6),
  three open questions.
