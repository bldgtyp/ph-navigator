---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Complete — browser-verified + squash-merged to main 2026-07-15
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Standardize tooltip hover-open delays and tooltip appearance across the
  Apertures sidebar, the Envelope sidebar, and the version-path (save-target)
  control. Single shared Tooltip primitive gains delay tiers; sidebars adopt
  consistent styling/placement.
RELATED:
  - frontend/src/shared/ui/tooltip/Tooltip.tsx (shared primitive)
  - frontend/src/features/apertures/components/ApertureSidebar.tsx (item 4 — reference look)
  - frontend/src/features/envelope/components/EnvelopeSidebar.tsx (item 10 — needs parity)
  - frontend/src/features/project_document/components/VersionControls.tsx (item 9)
  - frontend/src/features/project_document/components/VersionControlsMenus.tsx
  - planning/features/sidebar-organization/ (sibling — the two sidebars also diverge in rename UI)
---

# Tooltip hover-delays + appearance consistency

## One-liner

Tooltips across the app fire too eagerly and flicker, and the two element
sidebars style their tooltips differently. Add configurable hover-open **delay
tiers** to the shared Tooltip primitive and apply a **consistent look** so
tooltips stop getting in the way as the mouse moves.

## Items folded in

- **Item 4 — Apertures sidebar delays.** Tooltips get in the way and flicker.
  Add a **medium** delay to the aperture-name tooltip (hover over a list item)
  and a **longer** delay to the row-action tooltips (rename, duplicate, delete).
- **Item 9 — `version-path-trigger` delay.** The save-target / version breadcrumb
  tooltip is too eager. Give it a **much longer** hover-delay.
- **Item 10 — Envelope sidebar parity + delays.** Two sub-problems:
  1. **Appearance:** make Envelope sidebar tooltips match the **Apertures**
     sidebar tooltips — same font, color, size, and **top placement**.
  2. **Delays:** medium delay on the name tooltip, long delay on the action
     buttons (rename, dup, delete, etc.). They currently overlap each other and
     feel chaotic.

## Approach (proposed, not final)

1. Confirm whether `Tooltip.tsx` already exposes an `enterDelay`/`delay` prop.
   If not, add one. Define two named tiers so usage stays consistent, e.g.
   `TOOLTIP_DELAY.medium` and `TOOLTIP_DELAY.long` (exact ms TBD — start ~500ms
   medium / ~900ms long, tune by feel).
2. Apply **medium** to element-name tooltips and **long** to row-action buttons
   in both `ApertureSidebar` and `EnvelopeSidebar`; **long** to
   `version-path-trigger`.
3. Make the Envelope sidebar use the same Tooltip styling/placement as Apertures
   (the Apertures look is the reference). If the two sidebars pass different
   props/classes, converge them.

## Acceptance

- Hovering quickly across sidebar rows no longer pops/flickers tooltips.
- Name tooltips wait a medium beat; action-button tooltips wait longer.
- `version-path-trigger` tooltip only appears after a deliberate hover.
- Apertures and Envelope sidebar tooltips are visually identical (font, color,
  size, top placement).

## Implementation (2026-07-15)

Shipped on `refactor/tooltip-hover-delays`:

- Added `TOOLTIP_HOVER_DELAY = { medium: 500, long: 900 }` to the shared
  `Tooltip` primitive (`shared/ui/tooltip/Tooltip.tsx`), exported via the barrel.
  The primitive already had a `hoverDelay` prop; these are named, opt-in tiers.
- **Converged both sidebars onto the shared `<Tooltip>`.** Deleted the two
  bespoke JS-portal tooltips (`aperture-sidebar__floating-tooltip`,
  `envelope-sidebar-name-tooltip`) and their CSS, plus the now-orphaned
  `[data-sidebar-tooltip]` pure-CSS hint rules in `canvas-hint-tooltip.css`
  (toolbar variant retained). Net −247 lines.
- Applied tiers: element name = `medium`, row-action buttons (rename / duplicate
  / delete / change-type) = `long`, `version-path-trigger` = `long`. All names +
  row actions now use `placement="top"`, giving Apertures↔Envelope parity.
- Extended `long` to the version-control help tooltips at Ed's request: the
  project-actions menu items (`MenuActionButton` / `MenuActionLink`), the
  **Save Version** / **Save As** buttons, and the **Uncommitted changes** label.
- **Fixed a general lingering bug** (found in browser verification, applies to
  *every* tooltip app-wide): a hover-opened tooltip stayed on screen after the
  pointer left. Radix restores focus to the trigger when the popover closes;
  that programmatic focus fired the primitive's `onFocus` and immediately
  re-opened the tooltip. Fix: `onCloseAutoFocus={(e) => e.preventDefault()}` on
  the shared `Tooltip`'s `Popover.Content`. Browser-verified; not unit-tested
  (jsdom does not reproduce Radix focus restoration).
- Tests updated to the shared-primitive DOM (`.app-tooltip`) and to tolerate the
  hover delays (async hover asserts with bumped timeouts).

Resolved open questions: delay tiers are **named, opt-in constants** on the
primitive (not app-wide defaults), so existing intentionally-instant tooltips are
unaffected. Values 500 / 900 ms chosen by feel; retune in-browser if needed.

## Follow-ups (deferred, not blocking)

- **Shared row-action button** — both sidebars still carry a near-identical local
  `SidebarActionButton`. Extraction is deferred to
  [`sidebar-organization`](../../features/sidebar-organization/README.md) Phase 0
  (consolidation), where the two call sites converge anyway.
- **Next adopter of the constant** — `features/project_status/.../RecordStatusSummary.tsx`
  passes a raw `hoverDelay={300}`; migrate it to a named tier when next touched.

## Notes

- The sidebar work here (Envelope↔Apertures parity) overlaps the larger
  [`sidebar-organization`](../../features/sidebar-organization/README.md)
  feature, which proposes consolidating the two sidebars into one shared
  component. If that consolidation lands first, item 10's appearance-parity half
  is largely absorbed by it — do the tooltip-delay half here regardless.
