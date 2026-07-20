# Assemblies Sidebar — Redesign Handoff (Direction 1A "Quiet List")

Engineering spec to bring the existing **Assemblies** sidebar in line with the approved 1A
"Quiet list" design. Fonts and colors are the current app standards — do not introduce new
brand colors or type families. Everything else (density, controls, placement, behavior) is
changing. All pixel values below are exact; treat them as the target, not suggestions.

---

## 1. Design intent (read first)

The current sidebar is loud and low-density: a chunky segmented Order control, a persistent
double-dot drag handle on every row in manual mode, tall rows, and hover controls that crowd
the label under a heavy dark tooltip. 1A's thesis is **restraint and calm**:

1. **Strip chrome.** The Order control becomes a pair of understated text tabs, not a filled
   segmented button. Header icon buttons lose their borders (ghost buttons).
2. **No persistent drag clutter.** Drag handles do not sit on every row. They **fade in on
   hover only**, and occupy reserved space so nothing shifts.
3. **Quiet hover controls.** Rename / Duplicate / Delete appear as a right-aligned cluster of
   borderless ghost icon buttons that fade in over a short gradient scrim — no dark tooltip
   bubble; use native `title`/`aria-label` for labels.
4. **Groups as dividers.** In manual mode, a group is a lightweight uppercase label with a
   hairline rule — not a boxed card. "New group" is a quiet ghost text button, not a dashed box.
5. **Selection stays obvious, everything else recedes.** Only the selected row carries the
   teal fill; hover is a barely-there neutral wash.

The net effect should feel closer to a Linear/Things sidebar than a form.

---

## 2. Design tokens (use existing app tokens where they exist)

| Token | Value | Usage |
|---|---|---|
| Font — UI | `Inter` (400/500/600/700) | Everything except codes/counts |
| Font — mono | `JetBrains Mono` (500) | Group counts, any numeric badge (optional in 1A) |
| Text / primary | `#161616` | Title, active tab, row label |
| Text / row default | `#242424` | Unselected row code |
| Text / secondary | `#5F5F5B` | Header icon buttons (rest) |
| Text / muted | `#9C9C97` | Inactive tab, group label |
| Text / faint | `#8A8A85` | — |
| Accent / teal | `#2C7A8C` | Active-tab underline, selected icon |
| Accent / teal-ink | `#1D5F6E` | Selected row text, hover on ghost action buttons |
| Accent / teal-fill | `#E7F1F4` | Selected row background |
| Neutral hover wash | `#F3F3F1` | Row hover background |
| Header btn hover bg | `#F1F1EE` | Ghost icon button hover |
| Icon / rest | `#828F95` | Row type icon (unselected) |
| Grip color | `#B6B6B1` | Drag handle dots |
| Danger | `#C0492F` | Delete icon on hover only |
| Border / hairline | `#EAEAE6` | Panel border |
| Divider | `#EFEFEB` / `#EEEEEA` | Tab underline track, group rule |
| Panel radius | `16px` | Outer card |
| Row radius | `10px` | List rows |
| Icon-button radius | `8px` (header), `7px` (row actions) | — |
| Panel shadow | `0 1px 2px rgba(20,20,20,.045), 0 14px 34px rgba(20,20,20,.055)` | Only if the panel floats; omit if docked flush |

> If the app already defines these as CSS variables/theme tokens, map to those names rather
> than hard-coding. The hexes above are the source-of-truth values sampled from the mockup.

---

## 3. Container / panel

- **Width:** the list content column is **320px** (the mock panel is `width:320px`). Keep the
  app's existing sidebar width if it already differs; the internals below are what matter.
- **Panel padding:** `18px 15px` (top/bottom 18, left/right 15).
- **Background:** `#FFFFFF`. **Border:** `1px solid #EAEAE6`. **Radius:** `16px`.
- Shadow only if the panel is a floating card (as in the screenshot). If it becomes a docked
  rail, drop the shadow and use a single right hairline border instead.
- Internal vertical rhythm is controlled by margins on each block (header → tabs → list →
  footer), described below. Do **not** add row separators between items.

---

## 4. Header row

```
[ Assemblies ...................................  (+)  (▣) ]
```

- Layout: `display:flex; align-items:center; justify-content:space-between;`
- **Title** "Assemblies": `font-size:17px; font-weight:700; letter-spacing:-0.02em; color:#161616`.
- **Right cluster:** `display:flex; gap:2px;` containing two **ghost** icon buttons:
  - **Add assembly** (`+` / plus icon) then **Collapse panel** (panel icon), in that order.
  - Each button: `width:30px; height:30px; display:grid; place-items:center; border:none;
    background:transparent; border-radius:8px; color:#5F5F5B; cursor:pointer;
    transition:background .12s, color .12s`.
  - Hover: `background:#F1F1EE; color:#161616`.
  - Icons at `17×17`, stroke `1.7–1.9`, `stroke-linecap/linejoin:round`.
    - Plus icon path: `M12 5v14 M5 12h14`.
    - Collapse/panel icon: `rect x=3 y=4 w=18 h=16 rx=2.5` + `M9 4v16`.
- **Change from today:** the current bordered square buttons become borderless ghost buttons.

---

## 5. Order control — the headline change

Replace the filled segmented "A–Z / Manual" control with **two understated text tabs sharing
a bottom hairline**, sitting directly under the header.

- Container: `display:flex; align-items:center; gap:20px; margin:16px 2px 2px;
  border-bottom:1px solid #EEEEEA;`
- Each tab is a `<button>`: `border:none; background:none; padding:0 0 9px; font-size:13px;
  letter-spacing:-0.01em; cursor:pointer; margin-bottom:-1px;` (the `-1px` overlaps the
  container's hairline so the active underline sits on the same baseline).
- **Active tab:** `font-weight:600; color:#1D5F6E; border-bottom:2px solid #2C7A8C`.
- **Inactive tab:** `font-weight:500; color:#9C9C97; border-bottom:2px solid transparent`.
- **Labels:** use **"Alphabetical"** and **"Manual"** (the word "Alphabetical" reads clearer
  than "A–Z" at this size; keep "Manual").
- Drop the standalone "Order" label entirely — the two tabs are self-explanatory and the
  removed row is part of the density win.
- Animate the underline color/weight on switch (`transition: color .12s`); a sliding underline
  is a nice-to-have, not required.

**Behavior:** clicking a tab sets the sort mode. `Alphabetical` = automatic A–Z sort
(rows are not draggable). `Manual` = user order, drag-to-reorder enabled, group affordances
appear (see §8). Persist the selected mode per view (localStorage or user setting) so it
survives reloads.

---

## 6. List & row spec (default / alphabetical)

- List wrapper: `margin-top:6px`. No dividers between rows.
- **Row height:** `40px`. Row is a flex container:
  `position:relative; display:flex; align-items:center; gap:9px; padding:0 8px;
  border-radius:10px; cursor:pointer; user-select:none; transition:background .12s ease`.
- **Row contents, left → right:**
  1. **Grip slot** (drag handle) — see §8. In alphabetical mode `width:0; opacity:0` (renders
     nothing, reserves nothing).
  2. **Type icon** — `17×17`, stroke `1.7`, round caps. `flex:none`.
     Color `#828F95` (unselected) / `#2C7A8C` (selected).
     Icon by assembly type (match current mapping):
     - Wall (EW/IW): grid — `M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18`
     - Floor/Ceiling (FC): layers — `M12 2 3 7l9 5 9-5-9-5z M3 12l9 5 9-5 M3 17l9 5 9-5`
     - Roof (RC): home — `M3 9.5 12 3l9 6.5 M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9`
  3. **Label** (assembly code): `font-size:14px; letter-spacing:-0.01em`.
     Weight `500` default / `600` selected. Color `#242424` default / `#1D5F6E` selected.
  4. **Actions cluster** — absolutely positioned right, see §7.
- **States:**
  - **Default:** `background:transparent`.
  - **Hover:** `background:#F3F3F1`.
  - **Selected:** `background:#E7F1F4`, teal text + teal icon (persists regardless of hover).
- **Change from today:** rows are tighter (40px), the neutral hover is much softer, and there
  is no leading drag handle in alphabetical mode.

---

## 7. Row hover controls (Rename / Duplicate / Delete)

A right-aligned cluster that fades in on row hover. **No dark tooltip bubble** — use
`title` + `aria-label` on each button.

- Cluster wrapper: `position:absolute; right:5px; top:4px; bottom:4px; display:flex;
  align-items:center; gap:1px; padding-left:30px; border-radius:8px;`
- **Reveal:** default `opacity:0; pointer-events:none; transform:translateX(6px)`.
  On row hover → `opacity:1; pointer-events:auto; transform:translateX(0)`.
  `transition:opacity .13s ease, transform .13s ease`.
- **Scrim:** the wrapper has a left-to-right gradient so the label reads cleanly underneath:
  `background:linear-gradient(90deg, rgba(255,255,255,0), <rowBg> 30%)` where `<rowBg>` is the
  row's current background (`#F3F3F1` on hover, `#E7F1F4` when the hovered row is also selected).
- **Buttons:** three borderless ghost buttons, each `27×27; display:grid; place-items:center;
  border:none; background:transparent; border-radius:7px; color:#5C6C72; cursor:pointer;
  transition:background .12s, color .12s`.
  - Hover (Rename, Duplicate): `background:#FFFFFF; color:#1D5F6E`.
  - Hover (Delete): `background:#FFFFFF; color:#C0492F`.
  - Icons `14×14`, stroke `1.8`, round caps:
    - Rename (pencil): `M12 20h9` + `M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z`
    - Duplicate (copy): `rect x=9 y=9 w=12 h=12 rx=2.4` + `M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1`
    - Delete (trash): `M3 6h18` + `M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2` + `M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14`
- Order of buttons: **Rename, Duplicate, Delete.**
- Clicking an action must **not** select/navigate the row — stop propagation on the button.
- **Keyboard/focus:** the cluster must also become visible on row keyboard-focus
  (`:focus-within`), not hover alone, so it's reachable without a mouse.
- **Change from today:** removes the dark "Rename assembly" tooltip and the extra
  group/convert icon; the cluster no longer overlaps the label because of the gradient scrim.

---

## 8. Manual mode (drag handles + groups)

When **Manual** is active:

### Drag handles
- The grip slot reserves `width:13px` and sits at row-left (before the type icon).
- **Faint by default, full on hover:** `opacity:0.42` at rest, `opacity:1` when the row is
  hovered. `color:#B6B6B1`. `cursor:grab` (→ `grabbing` while dragging).
- Glyph: two columns × three dots, `12×15` viewBox `0 0 12 16`, `fill:currentColor`,
  circles at `cx 3.5/8.5`, `cy 4/8/12`, `r 1.05`.
- The whole row is the drag target; the grip is the visual affordance. Reserving its width in
  manual mode means switching modes does **not** shift the icon/label horizontally.
- **Change from today:** removes the always-on, high-contrast double-dot handle on every row.

### Group dividers (semantic sections)
- A group renders as a **label + hairline rule**, not a container/card:
  `display:flex; align-items:center; gap:7px; height:28px; padding:0 6px; margin-top:8px`.
  - Label: `font-size:11px; font-weight:600; letter-spacing:0.07em; text-transform:uppercase;
    color:#9A9A95`.
  - Trailing rule: `flex:1; height:1px; background:#EFEFEB`.
- Group **name is editable** (double-click, or via the row Rename affordance on the group
  header). New groups are created as **"Untitled group"** and immediately put into inline-edit.
- Items belong to a group; dragging a row across a divider reassigns it. Dragging a group
  header moves the whole group.
- (Collapsible groups are intentionally **out of scope for 1A** — keep them always-open plain
  dividers. Collapse/counts belong to direction 1B.)

### New group
- A quiet ghost text button at the **end of the list**, shown only in manual mode:
  `display:flex; align-items:center; gap:8px; margin-top:6px; padding:9px 8px; width:100%;
  border:none; background:none; color:#7C8A90; font-size:13px; font-weight:500;
  border-radius:9px; cursor:pointer`.
  - Hover: `color:#1D5F6E; background:#F5F5F2`.
  - Icon: folder-plus `16×16`, stroke `1.7`:
    `M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4.4l2 3H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z` + `M12 11v6 M9 14h6`.
  - Label: "New group".
- **Change from today:** replaces the large dashed-border "New group" box with a quiet inline
  ghost button that matches the calm aesthetic.

---

## 9. Interaction & behavior summary

- **Mode toggle** drives sortability: Alphabetical = read-only order, sorted A–Z by code;
  Manual = drag-to-reorder + groups. Persist per view.
- **Switching Alphabetical → Manual** should keep the current visible order as the initial
  manual order (don't reshuffle), then enable dragging.
- **Selection** is independent of hover and survives mode switches.
- **Hover controls** reveal on `:hover` and `:focus-within`; actions stop propagation.
- **Drag:** grip cursor `grab`/`grabbing`; on drop, reorder within/between groups. Provide a
  thin insertion indicator line during drag (2px, `#2C7A8C` at ~40% or a neutral line — match
  the app's existing DnD indicator if one exists).
- **Reduced motion:** respect `prefers-reduced-motion` — disable the fade/translate transitions.
- All transitions are short (`.12s–.13s`); do not exceed ~150ms anywhere in this component.

---

## 10. Accessibility

- Order tabs: `role="tablist"` / `role="tab"` with `aria-selected`, or a radiogroup — either
  is fine; make the active state programmatically determinable, not color-only (the weight
  change already helps).
- Row action buttons: real `<button>`s with `aria-label` ("Rename EW-1", "Duplicate EW-1",
  "Delete EW-1"). Do not rely on the removed tooltip for the accessible name.
- Ensure the hover-reveal cluster is keyboard reachable (`:focus-within`) and not
  `pointer-events:none` when focused.
- Selected row: `aria-current="true"` (or `aria-selected`), plus the teal fill.
- Group name edit: label the inline input; Enter commits, Esc cancels.

---

## 11. Migration checklist (what to change in the existing component)

- [ ] Remove the filled segmented "Order" control; remove the "Order" label row.
- [ ] Add the two-tab "Alphabetical / Manual" underline control under the header (§5).
- [ ] Convert header `+` and collapse buttons from bordered squares to 30px ghost buttons (§4).
- [ ] Reduce row height to 40px; remove any inter-row separators; apply the softer hover wash
      (`#F3F3F1`) and keep the teal selected fill (`#E7F1F4`).
- [ ] Remove the always-on drag handle; add the hover-reveal grip in manual mode with reserved
      13px width (§8).
- [ ] Rebuild the hover controls as a right-aligned ghost cluster with gradient scrim; delete
      the dark tooltip; keep Rename / Duplicate / Delete (drop the extra group/convert icon
      from the row — grouping is handled by drag + New group) (§7).
- [ ] Convert group rendering to label + hairline dividers; make group names inline-editable (§8).
- [ ] Replace the dashed "New group" box with the quiet ghost text button (§8).
- [ ] Wire mode persistence, `:focus-within` reveal, `prefers-reduced-motion`, and ARIA (§9–10).

---

## 12. Reference

The interactive reference is option **1a** in `Sidebar Redesign.dc.html` (canvas). Flip its
Order tabs and hover rows to see every state described here. Values in this doc were taken
directly from that source.
