---
DATE: 2026-07-09
TIME: 12:30 EDT
STATUS: Active
AUTHOR: Ed May + Claude
SCOPE: Per-item spec for the DataTable UI-tweaks packet
RELATED: ./README.md, ./STATUS.md,
         planning/archive/2026-07-09/datatable-copy-paste-broken-when-grouped-filtered-sorted.md
---

# DataTable UI Tweaks — PRD

Each item: the complaint, the root cause (`file:line`), the target design,
the fix, blast radius, and any open decision. Grid chrome is a single shared
visual system (`DataTable.css`), so design decisions here are cross-table
contracts — keep the whole cell-state ladder coherent, not one state at a time.

---

## Item 1 — Active-cell highlight: refine the whole cell-state ladder

### Complaint
The "active" cell highlight looks bad: only the **faintest border**, plus
**weird spots on the corners**. (Ed's hunch: the corners come from a border
radius on the editor input — correct, see root cause.)

### Root cause
Two compounding issues in `frontend/src/shared/ui/data-table/DataTable.css`:

1. **Muddy double ring.** The active cell draws *two* stacked inset
   box-shadows (`:2140-2152`):
   ```css
   .data-table td.data-table-cell-active:not(.data-table-cell-selected) {
     box-shadow:
       inset 0 0 0 2px var(--accent-text),                        /* hard ring */
       inset 0 0 0 4px color-mix(in oklab, var(--accent) 10%, transparent); /* faint halo */
   }
   ```
   The 2px hard ring + a 2px near-invisible halo read as a fuzzy, low-contrast
   border rather than a crisp cursor.

2. **Corner "spots" in edit mode.** The editor `<input>` inherits the global
   input radius (`reset.css:47` → `border-radius: var(--radius-xs)` = **4px**),
   but `.data-table-cell-editor` (`DataTable.css:2321`) never resets it. The
   host `td.data-table-cell-editing` is `overflow: hidden` (`:2316`). So during
   editing, the 4px-rounded opaque input sits inside a square clipped cell over
   the box-shadow ring — the rounded corners expose the ring/background at each
   corner → the "spots."

### Current state ladder (for reference)
| State | Class | Current chrome |
|---|---|---|
| Rest | — | cell bg only |
| Row hover | `tr:hover td` | `--data-table-row-hover-bg` |
| Block-selected (range member) | `.data-table-cell-selected` + edge classes | `accent-text 5%` fill; 1px `accent-text 52%` border on block perimeter only |
| Active (cursor) | `.data-table-cell-active` | 2px hard ring + 2px faint halo |
| Active in a block | `.cell-active.cell-selected` | `accent-text 10%` fill + same double ring |
| Editing | `.data-table-cell-editing` + `.data-table-cell-editor` | double ring under a 4px-rounded input (corner spots) |
| Error / error+active | `.data-table-cell-error(.active)` | 2px danger ring (+ faint halo when active) |

### Target design (spreadsheet-convention: Excel / AirTable)
Grid cells should read as **crisp rectangles**. One coherent ladder:

- **Rest / hover:** unchanged.
- **Block-selected:** keep the fill + perimeter-only 1px border (the edge-class
  system at `:2114-2128` is good). Optionally firm the fill one step so a
  multi-cell range is obviously selected.
- **Active (cursor):** a **single crisp 2px `--accent-text` ring, square
  corners, no secondary halo.** Same ring whether standalone or anchoring a
  block; the block just adds its fill underneath. This is the core fix — drop
  the faint inner ring.
- **Editing:** the active ring must **survive edit mode with square corners**.
  Two required changes:
  1. `.data-table-cell-editor { border-radius: 0; }` — kills the corner spots.
  2. Ensure the ring is not occluded/clipped by the input. Preferred approach:
     render the active ring as a `::after` overlay pseudo-element on the active
     `td` (`position:absolute; inset:0; pointer-events:none;` z-index above the
     editor) rather than a box-shadow the opaque input can cover. This makes
     rest-active and editing-active render identically — one ring, always
     square, always on top.
- **Error:** keep the 2px danger ring; apply the same single-ring, square,
  overlay treatment so error and normal cursors are visually consistent.

Rationale: a single high-contrast ring is the universal spreadsheet cursor
(Excel green, AirTable blue). The faint halo added nothing but blur; removing
it plus squaring the corners is what makes it look intentional.

### Blast radius
All DataTable surfaces. Screenshot every state on ≥2 tables after the change.

### Open decision
Overlay-pseudo vs. keeping box-shadow-on-`td` (with the editor inset by the
ring width so it doesn't cover the ring). Overlay is cleaner and recommended;
box-shadow is a smaller diff. Ed to confirm the ring color stays `--accent-text`
(teal) vs. moving to a dedicated cursor token.

---

## Item 2 — Toolbar Filter/Sort/Group active button shows a white pill

### Complaint
When a Filter / Sort / Group button is **active**, the whole button gets its
axis tint color, but the icon + text label sit on their own **white background**
inside that color. The entire element (icon + label + button) should be one
flat color — no white behind the icon or label.

### Root cause
`frontend/src/shared/ui/data-table/DataTable.css` — an over-broad descendant
rule paints every toolbar span white:
```css
.data-table-toolbar span {          /* :113 */
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  padding: 4px 7px;
  background: var(--bg-card);        /* ← the white pill */
}
```
The button-scoped reset only removes the border, **not the background**:
```css
.data-table-toolbar-button span { border: 0; }   /* :166 — incomplete reset */
```
So each button's icon span (`.data-table-toolbar-button-icon`) and label span
keep `background: var(--bg-card)`. When the button goes active
(`[data-axis-active="true"]` → `background: var(--data-table-tint-*-body)`,
`:197-207`), the tinted button surrounds two white spans → the pill effect.

### Fix
Extend the button-span reset so the icon+label spans are fully transparent and
un-boxed, letting the button's own background show through:
```css
.data-table-toolbar-button span {
  border: 0;
  background: transparent;
  padding: 0;
  border-radius: 0;
}
```
(Equivalently, scope the broad `.data-table-toolbar span` rule to only the
status-chip spans it was meant for — but the targeted reset is the smaller,
safer diff. Confirm which spans the `:113` rule legitimately styles first.
Note: the old "Ungroup to paste" status hint that once lived in this row was
removed when grouped paste was fixed, so it is no longer an example span.)

### Blast radius
All DataTable toolbars. Verify inactive, hover, and active states of Filter /
Sort / Group / Hide-fields; confirm the status-hint chips still look right.

### Open decision
None.

---

## Item 3 — Copy/paste has no visual feedback (marching ants + paste flash)

### Complaint
When the user selects a cell and ⌘C copies, there is **no indication** anything
was copied. It should behave like Excel / AirTable:
- **On ⌘C:** a **marching-ants** animated dashed border around the copied
  cell(s) showing the value is on the clipboard.
- **Esc:** clears the copied state (like Excel).
- **On ⌘V paste:** a brief transient indication on the written cells (temporary
  background highlight / font color / border pulse) confirming the paste landed.

### Root cause
`frontend/src/shared/ui/data-table/hooks/useGridClipboard.ts` — `copy()`
(`:52-54`) writes TSV+HTML to the system clipboard and returns; the only signal
is an `onAnnounce(...)` screen-reader string. There is **no `copiedRange`
state**, no marching-ants class, and no post-paste flash anywhere in the grid.
It's a missing affordance, not a broken one.

### Target design (Excel / AirTable convention)
1. **Copied state.** On copy, capture the copied range as a `copiedRange` and
   render a **marching-ants** dashed accent border around its perimeter (an
   animated dashed outline — CSS `@keyframes` animating a
   `repeating-linear-gradient` border/background on a `pointer-events:none`
   overlay, drawn on the range perimeter like the existing block-edge system).
2. **Persistence / dismissal (match Excel):** the marching ants stay until —
   Esc is pressed, a new copy replaces it, or the copied values are pasted /
   the source is edited. Moving the active cell does *not* clear it (Excel keeps
   the ants during range-paste navigation).
3. **Paste flash.** On paste, briefly (~500–700ms) flash the written target
   cells — e.g. `data-just-pasted="true"` for the duration, with a CSS
   transition fading an accent tint (background + border) back to rest.
4. **Reduced motion.** Under `prefers-reduced-motion`, replace the animated ants
   with a static dashed border and drop the flash animation (or make it a
   single static frame).

### ⚠️ Cross-reference — track the range by stable identity, not visual index
This item shares the copy/paste subsystem with the now-**resolved** bug
**`planning/archive/2026-07-09/datatable-copy-paste-broken-when-grouped-filtered-sorted.md`**.
That bug's original hypothesis — "⌘V no-ops because the keyboard path resolves
cells against underlying data indices" — was **wrong**: paste already resolves
through the view-resolved visible rows (same substrate as copy and fill), and
the real cause was a stray group-only paste guard, now removed. So there is no
bug to sequence first. The design rule for this item still stands on its own
merits, though: the `copiedRange` for the marching ants **must** be stored as
row-id + field-id (stable identity) and re-projected onto the current rendered
rows each frame — otherwise the ants will desync the moment a group/filter/sort
reorders rows. That is a property the *new* overlay must build in, not a defect
inherited from the paste path.

### Blast radius
All DataTable surfaces with clipboard enabled. New state + overlay + one
`useEffect` timer for the flash; no change to the write path itself.

### Open decision
- Marching-ants implementation: animated CSS gradient overlay vs. an SVG
  `stroke-dasharray` + `stroke-dashoffset` animation on a perimeter rect. CSS
  gradient is lighter and matches the existing pseudo-overlay pattern;
  recommended.
- Whether to also show the ants when the copy came from an external app (we
  only own the state when *we* initiate the copy — external copies can't be
  detected, so ants appear only on our own ⌘C; acceptable and matches AirTable).
