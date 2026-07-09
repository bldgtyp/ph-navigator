# STATUS — data-table-ui-tweaks

**State:** 🟡 Active — packet documented, **no code started**. Running list;
Ed is still adding items from a live grid review (2026-07-09).

**Branch:** not yet created. When work starts, one shared feature branch,
one commit per item (precedent: `attachment-cell-ux`).

## Item tracker

| # | Item | State | Next step |
|---|------|-------|-----------|
| 1 | Active-cell highlight ladder (crisp single ring, square corners, kill editor-radius corner spots) | 📋 Specced | Confirm overlay-pseudo vs. box-shadow approach + ring token, then implement |
| 2 | Toolbar Filter/Sort/Group white-pill on active | 📋 Specced, no open decision | Extend `.data-table-toolbar-button span` reset (transparent bg + no pad/radius); verify status chips unaffected |
| 3 | Copy/paste feedback: marching ants + Esc-clear + paste flash | 📋 Specced | Decide sequencing vs. the copy/paste bug (share the view-aware cell-resolution helper); build `copiedRange` (row-id/field-id) overlay |

## Cross-links

- Item 3 shares the copy/paste subsystem with the now-**resolved** bug
  `planning/archive/2026-07-09/datatable-copy-paste-broken-when-grouped-filtered-sorted.md`.
  That bug was a stray group-only paste guard, **not** a cell-resolution
  desync — copy/paste/fill already track view-resolved rows, so there is no
  bug to fix first. The `copiedRange` overlay must still track stable
  row/field identity (not visual index) or it will desync under
  group/filter/sort; that is a fresh requirement for the new overlay, not a
  carry-over.

## Verification (per item)

Grid chrome is visual — verify in the running app, not just CSS:

1. Screenshot each cell state on ≥2 tables (Spaces/Rooms + a catalog):
   rest / row-hover / block-selected / active / active-editing / error.
2. Toolbar: inactive / hover / active for Filter, Sort, Group, Hide-fields.
3. Copy/paste: ⌘C shows ants; Esc clears; ⌘V flashes target; ants track
   correctly after applying a group AND a sort AND a filter.
4. Closeout gate per item/merge: `simplify` → `docs-pass` → `make format`
   → `make ci`.

## Checklist

- [x] Document items 1–3 (this packet).
- [ ] Item 2 (no open decisions — smallest, do first).
- [ ] Item 1 (confirm ring approach with Ed).
- [ ] Copy/paste bug fix (prereq/co-req for item 3).
- [ ] Item 3 (marching ants + paste flash).
- [ ] Append further review items as Ed reports them.
