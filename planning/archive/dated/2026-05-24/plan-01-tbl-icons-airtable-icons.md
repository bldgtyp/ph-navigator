---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. First in the 9-plan AirTable-parity polish series.
        Sequenced 1/9 (easiest, lowest risk).
SCOPE: Replace the three glyph icons (☰ / ↑↓ / ⊞) in `GridToolbar.tsx`
       with proper AirTable-equivalent SVG icons, and add the icon
       slot reserved for "Hide fields" (`EyeOff`) so plan 07 has a
       matching idiom when it lands. Library-only — zero consumer
       touches.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-ICONS-1)
RELATED:
  - frontend/src/shared/ui/data-table/components/GridToolbar.tsx
    (current icon home; see lines 87–89, 108–110, 132–134 for the
    glyph spans this plan replaces)
  - context/UI_UX.md §1.7 (table toolbar visual standard)
  - planning/archive/dated/2026-05-24/plan-07-tbl-hide-show-fields.md (consumer
    of the new `EyeOff` icon)
---

# Plan 01 — AirTable-style toolbar icons

## 1. Why this plan exists

The toolbar's three current icons are inline Unicode glyphs:

- Filter: `☰` (line 88 of `GridToolbar.tsx`)
- Sort: `↑↓` (line 109)
- Group: `⊞` (line 133)

They render but they don't look like AirTable, and the visual jump
between glyph and surrounding shadcn UI reads as "homemade." Ed's
2026-05-24 review (image #3, AirTable's actual toolbar) calls for
distinct, recognizable icons that match the AirTable mental model so
users coming from AirTable land on muscle memory.

This is the smallest possible visual polish — pure SVG swap. No
state, no behavior change, no tests beyond a render snapshot. It also
sets up the icon slot for the next plan to come — plan 07 introduces
"Hide fields" and wants the same `EyeOff` Lucide icon AirTable uses.

## 2. Binding constraints

1. **Library-only.** All changes land in
   `frontend/src/shared/ui/data-table/components/GridToolbar.tsx` and
   (if needed) `frontend/src/App.css`. Zero touches to consumers.
2. **No new top-level npm dependencies.** Use `lucide-react`, already
   present in the frontend's `package.json` (verify on Step 1).
   If it is not present, install via `pnpm add lucide-react`.
3. **Icon size + stroke weight matches existing toolbar text.** The
   icon container's CSS class (`data-table-toolbar-button-icon`)
   already sets the visual scale; the SVG should inherit `1em` width
   + height from the parent so swapping doesn't shift button heights.
4. **Active-state coloring already works** via the existing
   `[data-axis-active="true"]` attribute selector — Lucide icons
   render `currentColor` for stroke, so they pick up the active
   accent for free.
5. **No tooltip changes.** The existing `aria-label` on each button
   is already the AirTable-equivalent string ("Filter" / "Sort" /
   "Group" or "Filtered by X"). Plan 07 will add "Hide fields."

## 3. Acceptance criteria

1. **Filter button** renders `<Filter />` from `lucide-react` (a
   funnel icon).
2. **Sort button** renders `<ArrowUpDown />`.
3. **Group button** renders `<Group />` (or `<Rows3 />` if `Group`
   doesn't exist in the installed Lucide version — confirm during
   Step 1).
4. **Icons inherit `currentColor`** so the active-state accent tint
   continues to work unchanged.
5. **Button height + horizontal alignment** within the toolbar
   matches the prior glyph rendering within ±2 px (visual check via
   side-by-side screenshot).
6. **`aria-hidden="true"`** stays on the icon `<span>` wrapper so
   the icon doesn't double-announce.
7. **The reusable `EyeOff` import is in place** even though plan 07
   adds the actual button — leaves the icon set documented in one
   place.
8. **No regressions** in `pnpm test`, `pnpm run build`, or the
   existing Rooms / EquipmentTab walkthrough.

## 4. Target architecture

### 4.1 File changes

**`frontend/src/shared/ui/data-table/components/GridToolbar.tsx`** —
replace the three glyph `<span>`s with Lucide components.

```tsx
import { Filter, ArrowUpDown, Group } from "lucide-react";
// ...
// inside the FilterPopover trigger:
<span className="data-table-toolbar-button-icon" aria-hidden>
  <Filter />
</span>
// (and analogously for Sort / Group)
```

**`frontend/src/App.css`** — confirm the
`.data-table-toolbar-button-icon` class sets a deterministic SVG
size. If it currently doesn't, add:

```css
.data-table-toolbar-button-icon svg {
  width: 1em;
  height: 1em;
  display: block;
}
```

### 4.2 Lucide name confirmation

`lucide-react` exports vary by version. Verify at Step 1:

```bash
cd frontend
pnpm list lucide-react
# if missing: pnpm add lucide-react
```

Then `grep -l "Group\|ArrowUpDown\|Filter\|EyeOff" node_modules/lucide-react/dist/esm/icons/`
to confirm the four icon names. If `Group` is unavailable, fall back
to `Rows3` (a stacked-rows icon that visually reads as grouping).

## 5. Execution order

Three steps. Tree green after each.

### Step 1 — Verify Lucide availability

- Check `frontend/package.json` for `lucide-react`. Install if
  missing: `cd frontend && pnpm add lucide-react`.
- Verify the four icon names exist (`Filter`, `ArrowUpDown`,
  `Group` (or `Rows3`), `EyeOff`).
- No commit if `lucide-react` was already present; otherwise commit
  the `pnpm add` separately:
  `chore(frontend): add lucide-react for data-table icons`.

### Step 2 — Replace toolbar glyphs

- Edit `GridToolbar.tsx`: import the three icons, replace the three
  inline glyphs.
- Add (if not present) the SVG sizing rule in `App.css`.
- Run `pnpm test --filter data-table` to confirm no snapshot drift
  beyond expected icon nodes. Update any snapshot tests inline.
- Commit:
  `feat(data-table): replace toolbar glyphs with Lucide icons`.

### Step 3 — Visual verification + Playwright check

- `make dev` → open Rooms in the browser.
- Toggle a filter, a sort, a group. Confirm the active-state accent
  color still applies (icons should switch from neutral foreground
  to accent).
- Take a Playwright MCP screenshot for the record.
- No commit unless Step 2 needed a follow-up tweak.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `lucide-react` isn't installed; adding it is a supply-chain decision the rest of the codebase hasn't made. | Quick: it's already a transitive dep of shadcn-ui components used by `SortPopover` and friends — verify in Step 1 by `pnpm list lucide-react`. If it shows as direct, no install needed. If transitive only, add as direct dep so the import path is stable. |
| Icon vertical-align differs from glyph baseline, shifting button text by 1–2 px. | The `display: block` rule in §4.1 removes the line-height baseline gap. Manual visual check in Step 3 catches anything remaining. |
| `Group` icon name doesn't exist in the installed Lucide version. | Fallback to `Rows3` is documented in §4.2. Both read as "grouping" semantically. |
| Bundle size grows because importing from `lucide-react` pulls more than three icons. | `lucide-react` is tree-shakable when imported by name (`import { Filter } from "lucide-react"`). No change vs. existing usage in shadcn. |

## 7. What this plan explicitly does not do

- Does not add the "Hide fields" button — that's plan 07.
- Does not change tooltip / aria-label text.
- Does not change the active-state visual (color, count badge,
  shape) — only the icon glyph.
- Does not flip the Sort icon direction based on ascending /
  descending sort state (per Q-ICONS-2: AirTable does not).
- Does not add an animated transition on icon switch.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — verify Lucide availability       | 0.1 | 0.3 |
| 2 — replace toolbar glyphs           | 0.3 | 0.5 |
| 3 — visual verification              | 0.2 | 0.3 |
| **Total**                            | **0.6** | **1.1** |

Well under one workday. Lowest-risk plan in the series.

## 9. Commit plan

1. `chore(frontend): add lucide-react for data-table icons` (only
   if Step 1 needed an install)
2. `feat(data-table): replace toolbar glyphs with Lucide icons`

## 10. Demo script

1. `make dev`, open Rooms.
2. Confirm the three toolbar buttons show funnel / up-down-arrows /
   group icons instead of the prior `☰ / ↑↓ / ⊞` glyphs.
3. Apply a filter → the Filter button tints accent color; the icon
   inside tints with it (same `currentColor`).
4. Apply a sort → Sort button tints accent.
5. Apply a group → Group button tints accent.
6. Reset view → all three icons return to neutral foreground.
7. Take a Playwright screenshot for the record.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — verify Lucide availability       | | | |
| 2 — replace toolbar glyphs           | | | |
| 3 — visual verification              | | | |
| Plan 01 overall                      | | | |
