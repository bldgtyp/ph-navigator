---
DATE: 2026-06-24
TIME: 21:22 EDT
STATUS: Active - redesign reviewed; implementation plan folded into PLAN.md
AUTHOR: Codex
SCOPE: Review of the DESIGN-agent DataTable mockup and handoff.
RELATED:
  - planning/features/data-table-ui/table-redesign/Equipment Table - Handoff.md
  - planning/features/data-table-ui/table-redesign/Equipment Table.dc.html
  - planning/features/data-table-ui/table-redesign/
  - planning/features/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/DataTable.css
  - frontend/src/shared/ui/data-table/DataTable.tsx
---

# Table Redesign Review

## Summary

The redesign is a strong direction for PH-Navigator DataTables: cleaner
engineering-schedule density, cooler header treatment, softer row
separation, right-aligned numeric rhythm, compact categorical pills, and
a less noisy toolbar/footer. It should be implemented as a shared
DataTable visual-system pass, not as table-local CSS.

The mockup should not be copied literally in three areas:

- `table-layout: auto` conflicts with the existing fixed colgroup,
  persisted column widths, resize handles, sticky frozen column, and
  virtualization assumptions. Keep fixed layout and improve width seeds,
  fit-to-content, and overflow behavior instead.
- `border-radius: 14px` and the large card shadow should be translated
  to the app's tighter table surface language. Use `--radius-md` / 8px
  unless the broader design system changes.
- The mockup's single-select prefix stripping should not be global.
  Many option labels may intentionally contain numbers. Prefix hiding
  needs an explicit option-list or field-level display rule.

## Adopt Directly

- Cozy row density at about 44px, with compact retaining about 34px.
- A real vertical padding token instead of encoding density only through
  fixed row height.
- Header background around `#fafbfc`, lighter interior row dividers,
  and faint header-only column separators.
- Header typography: mono, 11px, uppercase, muted, with small field-type
  icon treatment.
- Numeric cell typography: mono, tabular numbers, right aligned, with
  muted em dash for empty numeric values.
- Softer single-select pills: smaller padding, stronger readable tint,
  no heavy border unless needed for contrast.
- Hover/selection as subtle accent tint instead of blocky blue fill.
- Add-row as a full-width ghost row rather than a bare plus button.
- Footer as a quiet summary/status strip, including read-only/editable
  state.

## Adapt

- Unit labels: use the handoff's faint badge style, but place the unit
  below the field label in a two-line header to satisfy the earlier
  requirement to preserve name space.
- Toolbar: keep existing Filter/Sort/Group/Hide machinery, restyle it
  to the mockup. Add global search only as an explicit phase because it
  changes behavior and persistence expectations.
- Field-type icons: keep the existing shared `FieldTypeIcon` component
  and tune size/color. Do not hardcode text glyphs unless we decide the
  lucide icons are too visually heavy after screenshots.
- Card shell: DataTables may have an outer table surface, but avoid
  nesting a new card inside already-carded feature panels.

## Risks

- Column layout: auto layout would break user-resized columns and sticky
  frozen-column math. Treat it as rejected unless a separate prototype
  proves parity.
- Header height: two-line unit headers must not break column drag,
  resize handles, tinting, or field-config double-click.
- Virtualization: row height changes must stay synchronized with the
  virtualizer estimate and active/fill/selection geometry.
- Add-row row: converting the footer plus into a tbody ghost row must
  preserve keyboard insertion and the first-cell edit queue.
- Solid chips: global solid chips may overpower dense tables and reduce
  category scan if every single-select becomes a loud badge.

## Implementation Position

Proceed with the redesign, but as a staged shared DataTable refactor:

1. Tokenize density/surface/type values.
2. Preserve current grid mechanics.
3. Land numeric precision/alignment behavior with tests.
4. Restyle header/body/toolbar/footer through shared components.
5. Verify against the full DataTable route matrix before closeout.
