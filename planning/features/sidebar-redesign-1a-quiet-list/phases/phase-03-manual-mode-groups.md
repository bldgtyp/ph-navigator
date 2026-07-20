---
DATE: 2026-07-20
TIME: 17:36 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 03 — hover-reveal grip, groups-as-dividers, ghost "New group",
  reduced-motion.
RELATED: ../PRD.md §4.6/§4.7, ../decisions.md D-4/D-5, ../assets/1A-Quiet-List-Handoff.md §8/§9
DEPENDS-ON: phase-00, phase-01, phase-02
---

# Phase 03 — Manual Mode: Grip, Group Dividers, New Group

**Goal:** manual mode becomes calm — the grip is a hover-reveal affordance, groups
are lightweight dividers (not boxes), and "New group" is a quiet ghost text button.

## Tasks

### A. Hover-reveal grip (§8) — D-4
- File: `rows.tsx` `SortableRow` L109-118; CSS `.element-sidebar__row-handle`
  L251-275 + `.element-sidebar__row--draggable` grid L241-243.
- Grip slot stays reserved (grid `auto` col) so switching modes never shifts the
  icon/label. Grip is **faint at rest (~0.42 opacity)** and **full on row hover**
  (`.element-sidebar__row:hover .element-sidebar__row-handle`). Color
  `--sidebar-grip`/`--text-muted`. Keep `cursor:grab`→`grabbing`, `touch-action:none`,
  the keyboard focus ring, and the dnd-kit listeners (do not change drag behavior).

### B. Groups as dividers (§8) — D-5
- File: `GroupedList.tsx` `GroupSection` L84-158; CSS `.element-sidebar__group*`
  L135-207.
- Render each group header as a **lightweight uppercase label + trailing hairline
  rule** (extend the existing `.is-muted` label, css L173-179, with a
  `flex:1;height:1px;background:var(--border-subtle)` rule element). Drop the boxed
  look and the child-row indent (css L195-199) — 1A groups are dividers, not
  containers.
- **Hide collapse chrome:** remove/skip the `ChevronDown/Right` collapse button
  (GroupedList L87-95) from the rendered header; always render members expanded
  (drop the `group.collapsed ? null : …` gate at L146). **Keep** the
  `collapsed_group_ids` field + `onToggleGroupCollapsed` plumbing untouched in
  `sidebar_views` so a future 1B restores collapse with no migration (D-5).
- Group actions (up/down/rename/delete) stay as quiet ghost buttons revealed on
  header hover/focus (css L181-193) — restyle to match Phase 02's ghost look.
  Keep up/down for reorder (D-4).
- Keep the `MoveToGroupSelect` (rows L192-219) as the keyboard group-assign path;
  restyle `.element-sidebar__row-move` (css L231-238) to be quiet/borderless so it
  doesn't reintroduce chrome.
- "Ungrouped" remainder (GroupedList L38-50) uses the same divider style.

### C. Ghost "New group" button (§8)
- File: `ElementSidebar.tsx` L147-157; CSS `.element-sidebar__new-group` L209-229.
- Replace the **dashed box** with a quiet ghost text button: `FolderPlus` +
  "New group", `--text-secondary`, transparent bg, hover → `--accent-text` + quiet
  wash. Full-width, left-aligned per 1A (or centered — match 1A §8; left-aligned
  reads calmer).
- New group already creates + inline-edits (via `onAddGroup` → `useSidebarOrganization`).
  Confirm the new-group default label ("Untitled"/"Untitled group") and that it
  opens in inline edit; adjust the default string if needed to match 1A.

### D. Reduced motion + motion budget (§9)
- CSS: add `@media (prefers-reduced-motion: reduce)` that disables the grip fade,
  the action-cluster fade/translate, and any tab-underline transition. Keep all
  transitions ≤150ms (`--transition-fast` is 160ms — trim the sidebar ones to
  ~120-130ms if strictly honoring 1A's ceiling, or accept 160ms as the app
  standard; note the choice).

## Verification
- Manual mode: grip faint→full on hover; groups are label+rule dividers with no
  box/indent; no collapse chevron; New group is a ghost text button.
- Drag reorder within/between sections still persists (regression); keyboard
  group-assign via the select still works.
- Reduced-motion emulation: fades/translates disabled.
- `pnpm run check:all`; `make ci`; update `ElementSidebar.test.tsx` +
  `sidebar_views` tests for the DOM changes (no collapse button, divider markup).
- Run `simplify`; `make format`.

## Done when
Manual mode matches 1A, drag/group persistence intact, collapse data preserved,
reduced-motion honored, `make ci` green.
