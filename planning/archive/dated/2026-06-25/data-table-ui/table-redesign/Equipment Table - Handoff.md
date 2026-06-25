# Equipment Table Redesign — Implementation Handoff

Target: the data-table component in PH-Navigator (the `.data-table-*` grid). The redesign is a
styling/markup refinement, **not** a structural rewrite — it reuses the existing token system
(`--font-table` Geist, `--font-mono` Geist Mono, `--accent` #3E93AE, neutral grays, subtle
borders). Below, each change references the token or rule to touch.

---

## 1. Density & rhythm
- **Row height:** bump `--data-table-row-height` from `34px` to **`44px`** (cell uses a vertical
  padding token instead, see below). Keep a `Compact` option at the old ~34px (8px vertical pad).
- **Vertical padding:** drive row padding from a single var (e.g. `--data-table-cell-padding-y`,
  `13px` cozy / `8px` compact) rather than a fixed row height, so both densities share one rule.
- **Header height:** keep `--data-table-header-height` ~`42px`; header background `#fafbfc`
  (slightly cooler than body white), bottom border `1px solid --border-subtle`.
- **Horizontal padding:** keep `--data-table-cell-padding-x` at `~12px` (was 8px) for more
  breathing room; header pad `12px`, numeric cells get `padding-right: 14px` to sit off the edge.

## 2. Typography
- Body cells: `--font-table` (Geist) at `13px`, weight 400, `color: #374151` (slightly softer than
  pure `--text-primary` for non-key fields).
- **Primary field (Display Name):** weight **500**, `color: --text-primary (#111827)`, `13.5px`.
  Add a 3px accent left-edge (`border-left: 3px solid color-mix(in oklab, var(--accent) 38%, white)`)
  to anchor the row's identity column.
- **Headers:** `--font-mono` (Geist Mono), `11px`, weight 500, `text-transform: uppercase`,
  `letter-spacing: .06em`, `color: --text-secondary (#6b7280)`. Each header gets a small muted
  field-type glyph on the left (`T` text, `#` number, `▾` single-select) at `color: #aab0b8`.
- **Numbers & tags:** `--font-mono` with `font-variant-numeric: tabular-nums` so digits align in
  columns. Tag column also mono, `color: --text-secondary`.

## 3. Numeric columns & units
- Right-align **Qty, Size, Temp, Amps, Volts, Phase** (header label + value both flush right).
- Move units **out of the cells and into the header** as a faint badge:
  `Size [L]`, `Temp [°C]`, `Amps [A]`, `Volts [V]`. Badge = `9px`, weight 600, `color: #9aa1ab`,
  `background: #eef0f2`, `padding: 1px 5px`, `border-radius: 4px`. Values stay clean (`246.0`).
- **Empty numeric cells** render a muted em-dash (`—`, `color: #c9ced4`) instead of blank, so gaps
  read as intentional "not applicable" rather than missing data.

## 4. Single-select (Type) pills
- Replace the current pills with softer, higher-contrast tints; **drop the numeric prefix**
  (`5-`, `7-`, `1-` …) from the visible label — keep it as the stored value/sort key only.
- Pill style: `padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 500;
  white-space: nowrap;`. Tints (soft bg / readable text):
  - Heat Pump · Annex — `#e6f3ec` / `#2f7d52` (green)
  - Heat Pump · Inside — `#e2eff4` / `#2d6b80` (teal, ties to accent)
  - Electric — `#fbe9e6` / `#b5523f` (coral)
  - District — `#ece9f6` / `#5b4b9e` (violet)
  - Boiler · Gas/Oil — `#f6ecda` / `#946321` (amber)
- These map to your existing categorical intent; pull from a `typeColor` lookup keyed by the
  option's stored value.

## 5. Table layout & borders
- Use **auto table layout** (not `table-layout: fixed`) so columns size to content; wrap the table
  in an `overflow-x: auto` scroller with a `min-width` (~1392px) so it scrolls horizontally instead
  of wrapping cell text. This fixes the prior pill-overflow-into-Model and the wrapped
  "Display Name" header.
- **Lighten interior dividers:** row borders `1px solid #f0f1f3` (lighter than `--border-subtle`);
  reserve `--border-subtle (#e5e7eb)` for the header/footer separators and outer card.
- **Card shell:** wrap the grid in `border: 1px solid #e6e8eb; border-radius: 14px;
  box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 12px 32px rgba(16,24,40,.06); overflow: hidden;`.
- Vertical column separators: very faint `border-left: 1px solid #eef0f2` on header cells only
  (not body) — keeps the header scannable without caging every cell.

## 6. Row interaction
- **Hover:** row background → `color-mix(in oklab, var(--accent) 7%, white)` (a `--accent-soft`
  token). Remove the heavy selected-row blue block from the screenshot; selection can reuse the same
  soft tint with the accent left-edge thickened.
- **Row gutter:** row number in `--font-mono`, `12px`, `color: #b4b9c0`. (Checkbox can fade in on
  hover in place of the number, as today.)
- **Zebra striping:** optional; even rows `#f8f9fb`. Off by default — the lighter dividers already
  give enough row separation.

## 7. Toolbar
- Left: a two-line title block — mono eyebrow (`DOMESTIC HOT WATER · PLANT`, `10.5px`,
  `letter-spacing .12em`, `color: #9aa1ab`) above `Equipment Schedule` (`16px`, weight 600).
- Right: a `198px` search field then ghost buttons **Filter / Sort / Group / Hide fields**:
  `height: 34px; border: 1px solid #e6e8eb; border-radius: 8px; background: #fff; font 12.5px/500
  #4b5563`; hover `background: #f7f8fa; border-color: #dadde2`. Each leads with a muted glyph.
- Move the `EDITABLE` state badge **out of the top-left** into the footer (see below).

## 8. Footer
- `padding: 12px 20px; background: #fbfcfd;` flex row.
- Left: mono summary — `5 records · Qty total 5` (`11.5px`, `color: #9aa1ab`, emphasized numbers
  `#4b5563`).
- Right: `EDITABLE` with a small accent status dot (`7px`, `background: var(--accent)`).
- "Add equipment" is a full-width ghost row at the bottom of the tbody (`+ Add equipment`,
  `color: #9aa1ab`, hover `background: #fafbfc`) rather than a bare `+`.

---

## New/affected tokens
```
--data-table-row-height:        44px   (cozy)  | 34px (compact)
--data-table-cell-padding-y:    13px   (cozy)  | 8px  (compact)   [new]
--data-table-cell-padding-x:    12px
--data-table-header-bg:         #fafbfc
--data-table-row-border:        #f0f1f3                            [new, lighter than --border-subtle]
--accent-soft:   color-mix(in oklab, var(--accent) 7%, white)      [new — hover tint]
--accent-line:   color-mix(in oklab, var(--accent) 38%, white)     [new — primary-field edge]
```

## Notes
- All colors derive from accent via `color-mix`, so a theme/accent change cascades correctly.
- Tag values shown as `WH-1…WH-5` are illustrative — wire to the real tag field.
- The interactive prototype lives in `Equipment Table.dc.html` for visual reference.
