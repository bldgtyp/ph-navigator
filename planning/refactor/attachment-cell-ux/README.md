---
DATE: 2026-07-09
TIME: 11:20 EDT
STATUS: Active
AUTHOR: Ed May + Claude
SCOPE: Envelope/Materials attachment UX — the shared `<AttachmentCell>`
       (drag feedback, open-on-click, thumbnail redesign, persistent add
       affordance, upload spinner) plus the Materials `ReportTable` row
       chrome and shared `AttachmentChipCell` (expanded-row border,
       collapsed-row chip tooltip + contrast)
RELATED: context/technical-requirements/attachments.md (§A4 UX contract),
         context/ui/pages/envelope-tab.md §2.7.3 (Materials sub-tab),
         frontend/src/features/assets/components/AttachmentCell.tsx,
         frontend/src/shared/ui/attachments/attachments.css,
         frontend/src/shared/ui/report-table/ReportTable.tsx (+.css),
         frontend/src/shared/ui/report-table/AttachmentChipCell.tsx
---

# Refactor — Attachment Cell UX

Cross-cutting UX cleanup of the shared `<AttachmentCell>` component,
driven by hands-on review of the **Envelope → Materials** datasheet
surface (2026-07-09). The complaints originate on material datasheets,
but the component is shared, so the fixes land everywhere attachments
render.

## Why this is a `refactor/`, not a feature

No new product capability — this is polish and correctness on an existing
shared component (`planning/.instructions.md` rule 3). One component, one
stylesheet, five discrete UX items.

## Read order

1. `PRD.md` — the five items, each with root-cause (file:line), the fix,
   blast radius, and any open decision.
2. `STATUS.md` — per-item phase tracker; current focus and next step.

## The seven items (summary)

| # | Item | Component | Type | Root cause | Open decision? |
|---|------|-----------|------|-----------|----------------|
| 1 | Drop zone doesn't highlight on file-drag | `AttachmentCell` | Bug/UX | No drag-state tracking; `onDragOver` only `preventDefault`s | No |
| 2 | Full-screen preview should be single-click, not double | `AttachmentCell` | UX change | `onClick`=select, `onDoubleClick`=open (`:138-139`) | **Yes** — conflicts with select/detach model + §A4.2 contract |
| 3 | Thumbnail tile too small / odd border / radius | `AttachmentCell` | Redesign | 30px tile + hand-drawn `::after` dog-ear + `::before` bar glyph | Design direction |
| 4 | "Drop files here" vanishes after first upload | `AttachmentCell` | Missing affordance | Empty-only button; no persistent "+ Add"; NOT a 1-file limit (max 5) | No |
| 5 | Add a real upload spinner + completion verification | `AttachmentCell` | UX | `pending` renders `"uploading..."` text, no spinner; thumbnail lags | No |
| 6 | Primary-color border around the whole expanded row | `ReportTable` | UX | Row + expansion are sibling divs, no wrapper, no border on expand | No |
| 7 | Collapsed-row chip: count tooltip + lighter "missing" icon | `AttachmentChipCell` | UX | No `title`; "missing" uses `--text-muted` (low contrast vs has-files) | No |
| 8 | IP mode: show Resistivity [R/inch], not conductivity | `MaterialsPanel` | Units display | Lambda column always shows conductivity; ignores IP resistivity convention | No |

> **Note:** Item 8 is a units-display fix (building-science convention),
> not attachment-related. It's batched into this packet only because it's
> the same Materials-page work session. Helper + precedent already exist.

## Shared-component blast radius

`AttachmentCell.tsx` + `attachments.css` render on:

- Material datasheets (`envelope/materials`)
- Glazing / frame datasheets (`apertures`)
- Equipment datasheets (`spaces-equipment`)
- Segment **site photos** (`envelope/materials`, `envelope/site-photos`)

Items 1, 3, 5 improve all of these uniformly (desired). Item 2 changes
click semantics for **all** of them — see the PRD open decision. Item 4's
"+ Add" tile also appears on every populated attachment cell.

Items 6–7 touch the shared **`ReportTable`** / **`AttachmentChipCell`**,
which also render the **Apertures** spec-report tab. The expanded-row
border (6) and the chip tooltip + contrast (7) therefore also improve
Apertures — consistent and desirable, but verify there too.

## Working discipline

One item at a time, each on its own commit off a shared feature branch.
Closeout gate (`simplify` → `docs-pass` → `make format` → `make ci`)
runs per item or per merge, not per keystroke.
</content>
