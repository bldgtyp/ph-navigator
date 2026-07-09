---
DATE: 2026-07-09
TIME: 11:20 EDT
STATUS: Active
AUTHOR: Ed May + Claude
SCOPE: Per-item tracker for the attachment-cell UX refactor
RELATED: README.md, PRD.md
---

# STATUS — Attachment Cell UX

**Current focus:** Item 8 done (on branch `refactor/attachment-cell-ux`).
Next: **Item 7** (chip tooltip + contrast).
**Branch:** not created yet (suggest `refactor/attachment-cell-ux`).

## Item tracker

| # | Item | Component | State | Notes |
|---|------|-----------|-------|-------|
| 1 | Drag-active highlight on drop zone | `AttachmentCell` | Not started | Pure additive; safe |
| 2 | Single-click opens preview | `AttachmentCell` | Blocked (decision) | Needs Ed's pick: A/B/C (PRD Item 2) |
| 3 | Thumbnail tile redesign | `AttachmentCell` | Not started | Invoke `frontend-design` skill |
| 4 | Persistent "+ Add" tile | `AttachmentCell` | Not started | Registry already allows 5 datasheets |
| 5 | Upload spinner + verification | `AttachmentCell` | Not started | Verification already exists; visual + thumbnail-lag |
| 6 | Border around expanded row | `ReportTable` | Not started | CSS-only preferred; also hits Apertures |
| 7 | Chip count tooltip + lighter "missing" | `AttachmentChipCell` | Not started | Parameterize noun (datasheet/photo); also Apertures |
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

- **D-1 (Item 2):** single-click-to-open scope — (A) global / (B)
  datasheets-only prop / (C) click-opens-but-keep-keyboard-select.
  Recommend **(A)**. Resolve before item 2.
- **D-2 (Item 3):** thumbnail size + whether to show a filename caption
  (card context only). Resolve during `frontend-design` pass.

## Verification log

_(append per item: what was driven in the app, result, gate status)_

- 2026-07-09 — packet created; no code changes yet.
- 2026-07-09 — Item 8: `MaterialsPanel` lambda column branches on
  `unitSystem` (IP → "Resistivity [R/inch]" via
  `formatRPerInFromConductivityWmK`; SI unchanged). Gate:
  `make frontend-dev-check` green (typecheck + lint + build). Live IP/SI
  toggle check pending in the batch app-verification pass.
</content>
