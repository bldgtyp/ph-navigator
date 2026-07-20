---
DATE: 2026-07-20
TIME: 17:34 EDT
STATUS: DONE (implemented + verified 2026-07-20)
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 02 — row density, neutral-hover/teal-selection split, quiet ghost
  action cluster with gradient scrim, remove the dark tooltip.
RELATED: ../PRD.md §4.4/§4.5, ../decisions.md D-1/D-2/D-6/D-7, ../assets/1A-Quiet-List-Handoff.md §6/§7
DEPENDS-ON: phase-00, phase-01
---

# Phase 02 — Rows & Quiet Hover Controls

**Goal:** the row itself goes quiet — tighter, neutral hover, teal only on
selection, and a borderless action cluster that fades in over a scrim with no dark
tooltip.

## Tasks

### A. Row shell + density (§6)
- File: `element-sidebar.css` L114-133.
- Row min-height 38px → **40px**. Keep `--phn-control-radius` (or move to
  `--radius-lg` 10px to match 1A row radius — pick one and tokenize).
- **Split hover vs. selected** (today both are `color-mix(--accent 10%)`, L126-129):
  - Hover: `background: var(--sidebar-row-hover)` (neutral, from Phase 00).
  - `.is-active`: `background: var(--accent-light)` (teal fill) +
    `color: var(--accent-text)` on label + teal icon (icon already handled
    L311-314). Selection wins over hover (order the selectors so `.is-active`
    background is not overridden by `:hover`).
- Label: `--fs-md`, `--fw-medium` default / `--fw-semibold` selected.

### B. Quiet action cluster + scrim (§7) — D-6
- File: `rows.tsx` `ElementSidebarRowBody` L124-185; CSS
  `.element-sidebar__row-actions*` L328-380 and the row grid L119.
- Move the action cluster from the grid `auto` column to an **absolutely
  positioned** right-aligned cluster (so the label uses full width at rest). Fade
  in on `:hover` **and keep `:focus-within`** (css L338-347). Add a left→right
  **gradient scrim** behind the cluster matched to the row's current bg
  (transparent → `var(--sidebar-row-hover)`; teal variant → `var(--accent-light)`
  when the row is also selected).
- Buttons stay borderless ghost (`SidebarActionButton`, rows L267-300). Hover:
  Rename/Duplicate → `--bg-card` + `--accent-text`; Delete → keeps `.is-danger`
  (`--phn-danger-bg`/`--phn-danger`, css L372-376). Change-type (envelope, D-2):
  keep as a 4th ghost button unless Ed relocates it.

### C. Remove the dark tooltip (§7) — D-7
- `rows.tsx`: remove the `<Tooltip>` wrapper on the **row actions**
  (`SidebarActionButton`, L283) and the **row link** (`ElementSidebarRowLink`,
  L244). Replace with native `title={label}` on the `<button>` (keep the existing
  `aria-label`). The row-link keeps `aria-label`/visible text; add `title` only if
  truncation warrants.
- Keep `<Tooltip>` on the header buttons (Phase 01 / D-7).
- Update the CSS comment block L325-326 accordingly.

## Verification
- Render: hover is a soft neutral wash; only the selected row is teal; label reads
  full-width at rest; actions fade in over the scrim; no dark bubble.
- Keyboard: Tab into a row reveals actions (`:focus-within`); actions don't
  navigate (stopPropagation intact).
- `make typography-eval` (no new size variant); `pnpm run check:all`; `make ci`.
- Update `ElementSidebar.test.tsx` (tooltip→title/aria; selected vs hover bg).
- Run `simplify` on the diff; `make format`.

## Done when
Rows read "quiet", selection is unmistakable, actions are a borderless scrim
cluster, no dark tooltip, a11y intact, `make ci` green.
