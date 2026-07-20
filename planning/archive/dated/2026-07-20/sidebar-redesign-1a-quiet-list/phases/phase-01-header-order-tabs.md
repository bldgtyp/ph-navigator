---
DATE: 2026-07-20
TIME: 17:32 EDT
STATUS: DONE (implemented + verified 2026-07-20)
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 01 — ghost header buttons + the two-tab underline Order control.
RELATED: ../PRD.md §4.2/§4.3, ../assets/1A-Quiet-List-Handoff.md §4/§5
DEPENDS-ON: phase-00
---

# Phase 01 — Header Ghost Buttons + Two-Tab Order Control

**Goal:** the two highest-visibility "quiet" wins — borderless ghost header
buttons and the segmented Order control replaced by two understated text tabs.

## Tasks

### A. Header ghost buttons (§4)
- File: `ElementSidebar.tsx` L86-128 (add + collapse buttons) and
  `element-sidebar.css` L50-59.
- Make the Add (`Plus`) and Collapse (`PanelLeftClose`/`PanelLeftOpen`) buttons
  borderless/transparent (ghost) with a quiet neutral hover wash + `--text-primary`
  on hover. Keep 30px hit area, `--radius-md`, stable ids
  (`{idPrefix}-add`/`-toggle`), and the existing `<Tooltip>` (D-7: header keeps
  tooltip).
- If `.icon-button` (base.css L1366, global) must stay bordered for other
  callers, scope the ghost treatment to `.element-sidebar__tools .icon-button`
  rather than editing the global class.

### B. Two-tab underline Order control (§5) — headline change
- File: `SortModeToggle` in `ElementSidebar.tsx` L165-206; CSS
  `.element-sidebar__sortbar*` in `element-sidebar.css` L61-103.
- Replace the segmented toggle with two tabs sharing a bottom hairline
  (`--border-subtle`). Relabel **"A–Z" → "Alphabetical"**; keep **"Manual"**.
  Drop the standalone "Order" `<span>` label (L177) and its `.element-sidebar__sortbar-label`.
- Active tab: `--fw-semibold`, `--accent-text`, 2px `--accent` bottom border.
  Inactive: `--fw-medium`, `--text-muted`, transparent bottom border. Sizes from
  `--fs-*` only; transitions `--transition-fast`/`--ease`.
- Optionally drop the leading `ArrowDownAZ`/`GripVertical` glyphs (1A tabs are
  text-only) — or keep them small; text-only is closer to 1A.
- Behavior unchanged: each tab calls `onToggleSortMode()` only when switching
  (guard already present L184-186/L196-198). Persistence untouched.
- **ARIA:** convert to `role="tablist"` + `role="tab"` + `aria-selected`
  (replacing `aria-pressed`), OR a labeled radiogroup. Keep the group
  `aria-label` ("{title} order").

## Verification
- Render both routes: header buttons read as ghost; order control is two tabs with
  the active underline; "Order" label gone.
- Keyboard: tabs focusable and toggle sort mode; `aria-selected` reflects state.
- Update `ElementSidebar.test.tsx` assertions (label text "Alphabetical", role
  changes, "Order" label removed).
- `pnpm run check:all`; `make frontend-dev-check`; `make format`.
- Run the `simplify` skill on the diff.

## Done when
Header + order control match 1A, persistence/behavior unchanged, ARIA correct,
guards + focused tests green.
