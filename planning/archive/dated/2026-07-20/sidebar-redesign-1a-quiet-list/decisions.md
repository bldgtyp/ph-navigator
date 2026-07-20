---
DATE: 2026-07-20
TIME: 17:20 EDT
STATUS: Complete — all decisions resolved + implemented 2026-07-20
AUTHOR: Claude (Opus 4.8)
SCOPE: Decisions where 1A diverges from shipped behavior. Each has a
  recommendation; the ones marked ★ genuinely change scope and want Ed's call.
RELATED: PRD.md, research.md
---

# Decisions

## D-1 — Neutral hover wash vs. today's accent-tinted hover  (recommend: follow 1A)
Today row hover and selection share one accent-tinted background
(`color-mix(--accent 10%)`, css L126-129). 1A's whole "quiet" thesis is: **hover
is a barely-there neutral wash; only selection carries teal.** Split them.
- **Recommendation:** follow 1A. Add a neutral `--sidebar-row-hover` token (or
  reuse a neutral surface); keep teal for `.is-active` only.
- Not a product question — it's the point of the redesign. Proceeding unless Ed
  objects.

## D-2 — Envelope "Change type" row action  (RESOLVED 2026-07-20: keep in row)
**Ed chose (a): keep `change-type` as a 4th quiet ghost button in the row cluster.**
No feature relocates; the scrim sizes for 4 buttons. Details below for context.

1A's cluster is Rename/Duplicate/Delete (3). Envelope has a **4th** action,
`change-type` (`Shapes` icon, `EnvelopeSidebar.tsx` L60-65) — change an assembly's
wall/floor/roof type. Apertures has no such action. The handoff §7/§11 says "drop
the extra group/convert icon from the row" — but that referred to a *grouping*
icon, not change-type.
- **Options:** (a) **Keep** change-type as a 4th quiet ghost button (cluster still
  reads calm); (b) relocate it into the assembly canvas `⋯` overflow and drop it
  from the row.
- **Recommendation:** (a) keep it. Least disruption, no feature lost; the scrim
  just sizes for 4 buttons. Cheap to revisit.
- ★ Ed: confirm keep-in-row vs relocate.

## D-3 — Aperture type icons  (RESOLVED 2026-07-20: iconless for v1)
**Ed chose (a): leave aperture rows iconless for 1A.** Rows keep the reserved
icon slot empty so alignment matches envelope; revisit adding aperture-type icons
later. Details below for context.

1A row spec (§6) shows a leading type icon per row. Envelope has one; **apertures
rows are iconless today** (`ApertureSidebar.tsx` passes no `leadingIcon`).
- **Options:** (a) leave apertures iconless (rows align via the same reserved
  slot; perfectly calm); (b) add aperture-type icons (e.g. window/door/skylight)
  — requires a stable type signal on `ApertureTypeEntry` and an icon mapping.
- **Recommendation:** (a) for 1A — ship the restyle without inventing an aperture
  taxonomy. Add icons later if Ed wants visual parity with envelope.
- ★ Ed: iconless apertures OK for v1, or add aperture-type icons?

## D-4 — Group reorder: keep up/down buttons vs. drag  (recommend: keep up/down)
1A §8 mentions "dragging a group header moves the whole group." Current code uses
up/down buttons (`GroupedList.tsx` L75-82) — deliberately avoiding a nested drag
context.
- **Recommendation:** keep up/down for 1A (keyboard-accessible, robust, already
  works). Drag-group-reorder is an optional later enhancement. Not blocking.

## D-5 — Collapsible groups  (recommend: hide chrome, keep data)
1A defers collapsible groups to 1B ("always-open plain dividers"). Current code
has collapse chevrons + persists `collapsed_group_ids`.
- **Recommendation:** hide the collapse chevron and render groups always-expanded
  for 1A, but **keep** `collapsed_group_ids` in `SidebarViewState` (no schema
  change) so 1B can restore collapse with zero migration. Any rows currently in a
  collapsed group just render expanded — no data loss.

## D-6 — Action cluster: absolute + scrim vs. today's grid column  (recommend: adopt 1A)
Today actions live in a grid `auto` column (css L119) — they reserve width even at
rest, compressing the label. 1A absolutely-positions the cluster and fades it in
over a gradient scrim, freeing the label to full width at rest.
- **Recommendation:** adopt 1A's absolute + scrim. Real legibility win; the scrim
  color is a `color-mix`/token, not a raw hex. Keep `:focus-within` reveal.

## D-7 — Tooltip removal scope  (recommend: row actions + row-link only)
Remove the dark `<Tooltip>` from the **row action buttons** and the **row-link**
(rows.tsx L244, L283) → native `title`. **Keep** the `<Tooltip>` on the header
Add/Collapse buttons (ElementSidebar L87, L110) — those are icon-only chrome where
a short tooltip is still the right affordance and 1A §4 doesn't object.
- Confirm during implementation; low-risk either way.
