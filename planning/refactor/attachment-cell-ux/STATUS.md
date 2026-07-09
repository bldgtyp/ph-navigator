---
DATE: 2026-07-09
TIME: 11:20 EDT
STATUS: Active
AUTHOR: Ed May + Claude
SCOPE: Per-item tracker for the attachment-cell UX refactor
RELATED: README.md, PRD.md
---

# STATUS — Attachment Cell UX

**Current focus:** ALL 8 items implemented on branch `refactor/attachment-cell-ux`.
Remaining before "Complete": (1) live visual-verification pass (app
screenshots — the changes are heavily visual), and (2) merge-to-main
decision (Ed's call per project norms). Full frontend suite green
(2070 tests); `make frontend-dev-check` green.
**Branch:** not created yet (suggest `refactor/attachment-cell-ux`).

## Item tracker

| # | Item | Component | State | Notes |
|---|------|-----------|-------|-------|
| 1 | Drag-active highlight on drop zone | `AttachmentCell` | Implemented on branch | `dragActive` via enter/leave depth counter → `.drag-active` (accent ring + intensified drop button) |
| 2 | Single-click opens preview | `AttachmentCell` | Implemented on branch | D-1 = A (global). Click opens modal; removed select model (state/arrow-nav/Delete/tabIndex/`.selected` CSS); detach via modal. Contract §A4.2/§A4.6 synced; 8 equipment tests updated |
| 3 | Thumbnail tile redesign | `AttachmentCell` | Implemented on branch | `variant` prop (cell 32px / card 44px); unified tile frame; removed hand-drawn dog-ear/bar → clean type badge; card variant wired at Materials/Apertures/UseSite |
| 4 | Persistent "+ Add" tile | `AttachmentCell` | Implemented on branch | Tail tile on populated strip when `value+pending < maxCount`; reuses file picker; empty-state button kept for zero case |
| 5 | Upload spinner + verification | `AttachmentCell` | Implemented on branch | Spinner tile (Loader2) during pending; `useAssetUrls` polls while thumbnail pending; inline error tile per failed file (toast deferred — no Toaster mounted) |
| 6 | Border around expanded row | `ReportTable` | Implemented on branch | CSS-only via split `inset` box-shadows (row=top+sides, expansion=bottom+sides); no layout shift; also Apertures |
| 7 | Chip count tooltip + lighter "missing" | `AttachmentChipCell` | Implemented on branch | `noun` prop → `title`/`aria-label` count; "missing" glyph faded via color-mix; noun wired at 3 call sites |
| 8 | IP → Resistivity [R/inch] column | `MaterialsPanel` | Implemented on branch | Reused `formatRPerInFromConductivityWmK`; header/unit/render branch on `unitSystem` |

State vocabulary: Not started · In progress · Blocked · In review ·
Implemented on branch · Merged to main · Complete · Deferred.

## Suggested sequence

Cheapest, no-decision wins first (8, 7, 6), then the `AttachmentCell`
cluster, then the click-semantics change last.

1. **Item 8** (IP resistivity column) — tiny, self-contained, reuses an
   existing helper; no attachment dependency.
2. **Item 7** (chip tooltip + contrast) — tiny, self-contained.
3. **Item 6** (expanded-row border) — CSS-only, self-contained.
4. **Item 1** (drag highlight) — warms up `AttachmentCell` + CSS.
5. **Item 4** (+ Add tile) — pairs with item 1's drop-target work.
6. **Item 3** (thumbnail redesign) — visual, gates on `frontend-design`.
7. **Item 5** (spinner) — reuses the item-3 tile sizing.
8. **Item 2** (single-click) — last, after D-1 is resolved; touches click
   semantics everywhere.

## Open decisions

- **D-1 (Item 2):** RESOLVED (Ed, 2026-07-09) = **(A) global**. Single click
  opens the preview on every attachment surface; the in-strip select model is
  gone; detach happens in the modal. Contract §A4.2/§A4.6 updated.
- **D-2 (Item 3):** RESOLVED — context-aware sizing via a `variant` prop
  (`cell` 32px for dense tables, `card` 44px for spec-card/expansion). No
  filename caption added (kept clean; caption is a possible later add).

## Verification log

_(append per item: what was driven in the app, result, gate status)_

- 2026-07-09 — packet created; no code changes yet.
- 2026-07-09 — Item 8: `MaterialsPanel` lambda column branches on
  `unitSystem` (IP → "Resistivity [R/inch]" via
  `formatRPerInFromConductivityWmK`; SI unchanged). Gate:
  `make frontend-dev-check` green (typecheck + lint + build). Live IP/SI
  toggle check pending in the batch app-verification pass.
- 2026-07-09 — Item 7: `AttachmentChipCell` gained a `noun` prop feeding a
  `title`/`aria-label` count tooltip ("3 datasheets" / "No photos"); wired
  at the 3 call sites (Materials datasheets/photos, Apertures datasheets).
  Missing-state glyph faded (`color-mix(--text-muted 55%, --bg-card)`) for
  stronger have-vs-missing contrast. Gate green. Hover-tooltip + contrast
  check pending in the batch app-verification pass.
- 2026-07-09 — Item 6: `ReportTable` expanded row + expansion now framed by
  a 2px accent outline, split across the two siblings via `inset`
  box-shadows (no layout shift, no DOM/ARIA change). Applies to Materials
  and Apertures. Gate green. Visual check pending in the batch pass.
- 2026-07-09 — Item 1: `AttachmentCell` now tracks a drag state via an
  enter/leave depth counter and renders a `.drag-active` accent ring +
  intensified "Drop files here" button while a valid file is dragged over
  the cell. Shared across all attachment surfaces. Gate green. Live
  drag-hover check pending in the batch pass.
- 2026-07-09 — Item 4: populated `AttachmentCell` strips now end with a
  persistent "+ Add" tile (hidden at `max_count`), so 2nd–5th datasheets
  are addable by click or drop; empty-state button unchanged. Gate green;
  affected suites pass (`EnvelopePage.test.tsx` 48, `columns.test.tsx` 12).
- 2026-07-09 — Item 3: thumbnail redesign. New `variant` prop on
  `AttachmentCell` (`cell` 32px / `card` 44px via `--attachment-tile-size`);
  every tile (image/badge/add) now shares one frame; removed the hand-drawn
  dog-ear + underline glyph (the "weird right border") for a clean type
  badge. `variant="card"` wired at Materials datasheets, Apertures
  datasheets, and UseSiteRow site photos; equipment/dense stay compact.
  Synced contract `attachments.md §A4.1`. Also fixed an Item-7 aria-label
  regression in `ApertureSpecReportPanel.test.tsx` (old "Attached"/"Missing"
  → count labels). Full affected suites green (1277 tests).
- 2026-07-09 — Item 5: in-flight uploads now render a spinner tile (Loader2)
  instead of "uploading…" text; `useAssetUrls` gained a bounded
  `refetchInterval` that polls while any `thumbnail_status === "pending"`, so
  the real thumbnail swaps in without a manual refresh. Per-file failures now
  surface a dismissible danger tile (Sonner toast from the PRD deferred — no
  global Toaster is mounted app-wide). The 3-step upload already verifies
  bytes landed in R2 (complete-upload MIME-sniff), so no new Cloudflare
  signal was needed. Gate + envelope/assets suites green (66 tests).
- 2026-07-09 — Item 2 (D-1=A): single click on a thumbnail now opens the
  preview modal on every attachment surface. Removed the whole in-strip
  select model — `selected` state, arrow-key nav, Enter/Space/Delete cell
  handler, `tabIndex`, and the dead `.attachment-thumb.selected` CSS —
  relying on the tiles being native focusable `<button>`s. Detach is
  modal-only. Synced contract §A4.2/§A4.6. Updated 8 equipment
  detach-via-Delete tests to detach through the modal. Full frontend suite
  green (2070 tests).
