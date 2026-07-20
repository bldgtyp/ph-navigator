---
DATE: 2026-07-20
TIME: 17:50 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: Router for the cross-cutting modal/dialog visual-consistency refactor.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./CATALOG.md
---

# Modal Consistency Refactor

Cross-cutting cleanup so every modal/dialog in the PHN frontend follows one
visual + interaction contract: consistent box/spacing, a single canonical
dismiss (footer **Cancel**), styled action buttons, and predictable
backdrop/overflow behavior. Driven by a 2026-07-20 static audit of all ~50
modal components (58 modal instances), not by a product story.

Read in this order:

1. **`PRD.md`** — problem, the ratified modal contract (the acceptance spec),
   defect analysis, non-goals.
2. **`PLAN.md`** — phased implementation sequence (00 shared-components →
   01 dismiss sweep → 02 RowEditModal cluster → 03 partial conversions →
   04 multi-action footers → 05 apertures rogue → 06 data-table Radix rogue).
3. **`CATALOG.md`** — full per-modal evidence: tier, dismiss affordances, footer
   buttons, box handling, and concrete issues, ranked by severity.
4. **`decisions.md`** — accepted decisions (contract, `extraActions` slot, keep-Radix).
5. **`STATUS.md`** — current state, next step, blockers.

## Snapshot

- 58 modal instances: gold 10 · partial 34 files · rogue 8 files.
- Top defects: 34 double-dismiss, 32 hand-rolled footers, 20 unstyled primary
  buttons, 25 inconsistent backdrop-dismiss.
- Highest leverage: fixing shared `ModalDialog` / `DialogActions` /
  `row-edit.tsx` cascades across most of the set.

## Contract (one line each; full text in `PRD.md`)

- **Dismiss:** footer `Cancel` only; drop top-right Close (keep it just for
  read-only viewers).
- **Footer:** always `DialogActions`; Cancel left + styled primary right; no
  bare buttons; destructive → `danger-button`.
- **Labels:** literal "Cancel"; specific primary verb; standard busy ellipsis.
- **Box:** shared `.modal-panel`; oversized (scrolling) modals get a lower-right
  resize handle.
- **Backdrop-click:** off for forms, on for read-only viewers.

Status: **In progress on `refactor/modal-consistency`. Phases 00–05 DONE;
Phase 06 pending.** Contract ratified by Ed 2026-07-20; both former open
questions decided (see `decisions.md`). See `STATUS.md` for detail.
