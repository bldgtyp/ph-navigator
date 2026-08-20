---
DATE: 2026-08-19
TIME: 21:18 EDT
STATUS: Complete — implemented and verified
AUTHOR: Ed May / Codex
SCOPE: Product contract for Roadmap and Assembly status presentation
RELATED:
  - planning/archive/dated/2026-08-19/status-presentation-polish/README.md
  - planning/archive/dated/2026-08-19/status-presentation-polish/STATUS.md
---

# PRD — Status Presentation Polish

## 1. Roadmap status control

Within `.status-roadmap`:

- Replace the actual `stateSymbol()` output (`x`, `o`, and `-`) in the left rail
  with explicit state text: **Done**, **To-Do**, and **N/A**.
- Remove the duplicate `.status-badge` beside the milestone title.
- The left-rail control remains the one-click state control for editors and a
  static state label for viewers.
- Preserve the existing state-cycle behavior unless a focused test exposes an
  accessibility problem. The button's accessible name must announce the next
  action, while its visible text announces the current state.
- Use distinct state color/background/border treatments without relying on
  color alone.
- Expand the rail grid column to fit the labels and reposition the timeline
  line through the control center. Labels must not overlap titles or dates.
- Preserve current-item highlighting, drag/reorder behavior, row menu, notes,
  and date editing.
- At narrow widths, keep the state label readable; do not collapse it back to
  a single ambiguous glyph.
- **To-Do** is rail-specific display copy. Do not change the shared
  `STATUS_STATE_LABELS.todo = "To do"` vocabulary used by menus and options as
  part of this packet.

## 2. Compact Assembly moisture status

For signed-in users on Envelope → Assemblies:

- Replace `.condensation-status-chip` with a compact text status such as
  `Condensation: none predicted`.
- Remove pill background, outline, large padding, and nested-chip appearance.
- Keep the `Moisture` metric label and info tooltip.
- Align baseline, height, type scale, and spacing with Total thickness and
  Thermal.
- Keep the metric group on one flex row at desktop. At narrow widths, wrap the
  whole Moisture metric after Thermal rather than allowing its label and status
  to separate or restoring a pill.
- Keep tone as restrained text color only where it communicates success,
  warning, danger, loading, or unavailable state.
- Preserve the current detail action: every signed-in status, including loading
  and unavailable, remains a text button that opens the detail modal, with a
  clear accessible name rather than generic chip semantics.
- Preserve loading/unavailable labels and do not turn missing analysis into a
  successful value.

## 3. Temporary anonymous moisture boundary

Until the condensation feature is fully backed and tested for public use:

- anonymous users see no `Moisture` `<dt>`, info tooltip, status text, or click
  target;
- remove the entire metric wrapper so no empty layout gap remains;
- avoid starting the condensation query for anonymous Assembly views when no
  other visible public surface consumes it;
- logged-in editors, logged-in locked-Version users, and authenticated
  read-only users retain the compact status;
- the visibility decision uses actual session/auth state, not `canEdit` alone;
- derive one `showMoisture` boolean from a successfully resolved non-null
  session and pass it to both the query `enabled` condition and
  `AssemblyHeader`; session loading/error follows the anonymous-hidden path;
- record the temporary policy in `context/ui/pages/envelope-tab.md` and beside
  the explicit guard so future public enable work removes a named contract
  rather than discovering a hidden CSS rule.

## 4. Acceptance

- Roadmap never shows `x`, `o`, or `-` as status and never repeats the current
  state beside the title.
- Done, To-Do, and N/A remain visible and operable/static as appropriate.
- Timeline geometry remains continuous at desktop and narrow widths.
- Signed-in Assembly headers show a one-line compact moisture status aligned to
  the other metrics and can still open details.
- Anonymous Assembly headers contain no moisture label/status/action and no
  blank metric space.
- Thermal and Total thickness behavior remains unchanged.

## 5. Non-goals

- Changing Roadmap state values or adding a new state.
- Changing condensation calculations or result semantics.
- Enabling public condensation details.
- Redesigning the Condensation detail modal.
