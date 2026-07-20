---
DATE: 2026-07-20
TIME: 17:15 EDT
STATUS: Complete — implemented + verified 2026-07-20 (see STATUS.md)
AUTHOR: Claude (Opus 4.8)
SCOPE: Product/behavior contract for applying the Claude-Design "1A Quiet List"
  redesign to the shared element sidebar (Envelope Assemblies + Apertures).
RELATED:
  - assets/1A-Quiet-List-Handoff.md   (the design source-of-truth)
  - research.md                        (code-verification map)
  - PLAN.md, decisions.md
---

# PRD — Sidebar Redesign: 1A "Quiet List"

## 1. Summary

Bring the shared element-list sidebar in line with the approved Claude-Design
**Direction 1A "Quiet List"**. The sidebar shows a project's Assemblies
(Envelope tab) and Aperture Types (Apertures tab). Today it is *loud and
low-density*: a filled segmented Order control, always-on drag handles, tall
rows, accent-tinted hover, a dark tooltip crowding the label, boxed groups, and a
dashed "New group" box. 1A's thesis is **restraint and calm** — closer to a
Linear/Things sidebar than a form.

**This is a visual + interaction refresh of one already-shared component.** It
introduces no new persisted data, no domain-document schema change, and no new
backend command (see `research.md`). Ordering, manual mode, and groups already
ship and persist. We are changing how they *look and feel*, plus a handful of
interaction details (hover-reveal grip, groups-as-dividers, native tooltips,
reduced-motion).

## 2. Goals / Non-goals

**Goals**
- Apply 1A to `shared/ui/element-sidebar/` so both pages get it at once.
- Every value expressed as a design token; `pnpm run check:all` stays green.
- Preserve all shipped behavior: A–Z/manual persistence, drag reorder, groups,
  rename/duplicate/delete, keyboard + screen-reader access, viewer/locked
  read-only rules.
- Improve accessibility: `prefers-reduced-motion`, tablist/radiogroup semantics,
  native `title`/`aria-label` on quiet actions, keep the keyboard group-assign path.

**Non-goals**
- No change to what is persisted (`user_sidebar_views.view_state` stays v1).
- No new domain commands or `Assembly`/`ApertureTypeEntry` fields.
- No collapsible-group *behavior* work (1A explicitly defers collapsible groups
  to a future "1B"; we hide the chrome but keep the `collapsed_group_ids` field).
- Not touching the assembly canvas/workbench, the Materials/Glazings/Frames
  report tables, or any non-sidebar surface.

## 3. Users & context

- **Editors** (logged-in, unlocked version): full sidebar — sort toggle, drag,
  groups, row actions. Ordering/grouping persists per-user.
- **Viewers / locked versions**: read-only. No sort toggle (persistence is
  editor-only), no drag handles, no row actions, no "New group". The list renders
  as a plain calm list. (Already the behavior; 1A must not regress it.)

## 4. Behavior contract (the 1A target, reconciled to app tokens)

Pixel/além values are in `assets/1A-Quiet-List-Handoff.md`; this section states
the *behavior* and the token mapping. Where 1A hexes differ from app tokens, the
**app token wins** (handoff §2 authorizes this) — mapping table in `research.md` §4.

### 4.1 Panel / container
- Keep the app's **docked** rail: existing `260px` width, left-rounded card,
  right hairline (`element-sidebar.css` L8-20). 1A's `320px` / `16px` radius /
  drop-shadow apply to a *floating* card and do **not** apply here (handoff §3
  allows keeping app width and dropping the shadow when docked).

### 4.2 Header (§4)
- Title "Assemblies" / "Aperture Types": weight bold, `--text-primary`.
- Right cluster = two **ghost** (borderless, transparent) icon buttons: **Add**
  (`Plus`) then **Collapse** (`PanelLeftClose`). Hover = quiet neutral wash +
  `--text-primary`. (Today they read as bordered squares.)
- Order in the DOM already matches (toggle then add, ElementSidebar L109-128);
  keep stable ids (`{idPrefix}-add`, `{idPrefix}-toggle`).

### 4.3 Order control → two-tab underline (§5) — the headline change
- Replace the filled segmented `SortModeToggle` with **two text tabs sharing a
  bottom hairline**: **"Alphabetical"** (relabel from "A–Z") and **"Manual"**.
- Active tab: semibold, `--accent-text`, 2px `--accent` underline. Inactive:
  medium, `--text-muted`, transparent underline.
- **Drop the standalone "Order" label.**
- Behavior unchanged: click sets `sort_mode`; Alphabetical = natural A–Z (no
  drag); Manual = drag + group affordances. Persisted (already is).
- ARIA: `role="tablist"`/`role="tab"` + `aria-selected` (or radiogroup) — state
  must be programmatically determinable, not color-only.

### 4.4 List & rows (§6)
- Row height **40px**; no inter-row separators (already none).
- Left→right: grip slot (manual only; §4.6) · type icon · label · hover actions.
- **Hover = neutral wash** (new neutral token). **Selected = teal fill**
  (`--accent-light`) + teal text (`--accent-text`) + teal icon, and selection
  **persists regardless of hover**. This *splits* today's shared hover==selected
  background (css L126-129) so only selection carries teal — the core "quiet" win.
- Type icons: envelope keeps its lucide mapping (wall/floor/roof/other). Apertures
  is iconless today — see `decisions.md` D-3.

### 4.5 Row hover controls (§7)
- Right-aligned cluster of **borderless ghost** buttons that fade in on `:hover`
  **and `:focus-within`** (keep the focus path). Order: **Rename · Duplicate ·
  Delete**. Envelope also has **Change type** — see `decisions.md` D-2.
- **No dark tooltip.** Remove the shared `<Tooltip>` wrapper from the row actions
  and the row link; use native `title` + existing `aria-label`.
- Cluster fades in over a **left→right gradient scrim** matched to the row's
  current background (neutral on hover, teal when the hovered row is also
  selected) so the label reads cleanly. This also lets the label use full width at
  rest (today the grid reserves the actions column, compressing the label).
- Hover colors: Rename/Duplicate → white bg + `--accent-text`; Delete → white bg
  + `--phn-danger` (already wired via `.is-danger`, css L372-376).
- Clicking an action must not select/navigate (already: `stopPropagation`,
  rows L290-294).

### 4.6 Manual mode — grip + groups (§8)
- **Grip:** reserved slot at row-left in manual mode; **faint at rest
  (~0.42 opacity), full on row hover**; `cursor:grab`→`grabbing`. Reserving width
  means switching modes does not shift the icon/label. (Today the grip is
  always-on full-contrast.)
- **Groups as dividers:** a group renders as a **lightweight uppercase label +
  trailing hairline rule**, not a boxed/indented card. The `is-muted` label
  variant (css L173-179) is already uppercase — extend it with the rule and drop
  the box + indent.
- **Collapsible groups are out of scope for 1A** (handoff §8): hide the collapse
  chevron and always render expanded. **Keep** the `collapsed_group_ids` field in
  `SidebarViewState` so a future 1B can restore collapse without a migration.
- Group name editable via the group Rename affordance (already: `InlineHeaderNameEditor`,
  GroupedList L96-108). New groups → "Untitled group", immediately inline-editing.
- Group reorder: keep the existing up/down buttons for v1 (keyboard-accessible,
  already work). Drag-to-reorder groups is an optional later enhancement, not
  required for 1A (see `decisions.md` D-4).
- Item→group assignment: drag across a divider (already), **and** keep the quiet
  `MoveToGroupSelect` as the keyboard-accessible path (§10).
- **New group** = quiet ghost text button at list end (manual only), `FolderPlus`
  + "New group". Replaces the dashed box.

### 4.7 Motion & a11y (§9-10)
- All transitions short (~120-150ms); pair with `--transition-fast`/`--ease`.
- Respect `prefers-reduced-motion`: disable the fade/translate on the grip and
  action cluster.
- ARIA: tablist/tab or radiogroup on the order tabs; real `<button>`s with
  `aria-label` ("Rename EW-1" …) on every action; selected row carries
  `aria-current`/active; group-name inline input labeled (Enter commits, Esc
  cancels — already `InlineHeaderNameEditor`).

## 5. Acceptance criteria

1. Both `/projects/{id}/envelope/assemblies` and `/projects/{id}/apertures/builder`
   render the 1A look: ghost header, two-tab underline order control, 40px rows,
   neutral hover + teal-only selection, quiet ghost action cluster with no dark
   tooltip, hover-reveal grip, groups-as-dividers, ghost "New group".
2. `sort_mode` persists across reload; A–Z→Manual keeps current order; drag
   reorder and group ops persist (unchanged from today — regression-checked).
3. Viewer / locked version: calm read-only list, no editor affordances.
4. Keyboard: order tabs reachable + toggle by keyboard; action cluster reachable
   via `:focus-within`; drag via keyboard sensor; group assignment via the select.
5. `prefers-reduced-motion: reduce` disables the fade/translate transitions.
6. `pnpm run check:all` green — no raw hex, all `var()` resolve, typography within
   the token vocabulary and under the 29-variant ceiling, files ≤500 lines.
7. `make ci` green; existing `ElementSidebar`, `sidebar_views`, and aperture
   adapter tests pass (updated for DOM/aria changes); backend `test_sidebar_views`
   untouched and green.
8. Visual parity confirmed by browser smoke on both pages via
   `frontend/scripts/agent-browser.mjs` (per `context/USING_A_WEB_BROWSER.md`),
   screenshots saved to `assets/`.

## 6. Out of scope / deferred to "1B"

- Collapsible groups with counts (handoff §8 explicitly 1B).
- Drag-to-reorder whole groups (optional; up/down stays).
- Any monospace count/badge treatment (handoff marks it optional in 1A).
- Sliding-underline animation on the order tabs (nice-to-have, not required).
