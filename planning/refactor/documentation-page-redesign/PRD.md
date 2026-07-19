---
DATE: 2026-07-18
TIME: 22:50 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Product and behavior contract for the Documentation tab Option 1A redesign.
RELATED:
  - planning/refactor/documentation-page-redesign/README.md
  - planning/refactor/documentation-page-redesign/PLAN.md
  - planning/refactor/documentation-page-redesign/STATUS.md
  - planning/refactor/documentation-page-redesign/research.md
  - frontend/src/features/documentation/
  - context/ui/pages/documentation-tab.md
---

# Documentation Page Redesign PRD

## Problem

The shipped Documentation tab exposes the right data but opens as a dense
evidence grid. In projects with many records, users see every expanded row,
attachment strip, status control, waiver checkbox, and action affordance at
once. That is useful for audit completeness, but it is too noisy for scanning
which documentation areas need attention.

Option 1A changes the page from a wall of controls to an overview-first QA
surface: section progress first, then group/assembly drill-down, then per-record
evidence controls only when the user expands the record.

## Requirements

### R1 - Redesign Only The Documentation Tab Body

The implementation must stay inside the Documentation tab body:

- do not alter the project topbar;
- do not alter the project tabbar;
- do not rename the route;
- keep `/projects/{id}/documentation`;
- keep the legacy `/projects/{id}/envelope/site-photos` redirect behavior.

Use PH-Navigator design-system tokens and established app CSS variables for
fonts, colors, spacing, borders, focus rings, and status colors. Do not copy the
mockup's inline style values literally unless they already match app tokens.

### R2 - Replace Rollup Chips With A Plain Page Header

The top of `.documentation-page` must show:

- `h1`: `Documentation status`;
- subtitle: "Spec sign-off, datasheets, and site photos for every material and
  piece of equipment in the model.";
- one muted attention line: `N specs, N datasheets and N photos still need
  attention.`

The existing three header rollup chips (`Spec N/M`, `Datasheets N/M`,
`Photos N/M`) should be removed from the page header. Counts remain derived
from the backend documentation summary.

The existing filter bar concept may remain below the attention line. Option 1A
does not require the later 1C chip styling.

### R3 - Use Three-Tier Progressive Disclosure

The visible hierarchy must be:

1. Section: Envelope, Equipment, Apertures, Thermal Bridges.
2. Group or assembly: e.g. `WALL-2X4-STUD`, Ventilators, Pumps.
3. Record: material, equipment item, aperture product, or thermal bridge.

Sections and groups are collapsible card-like rows with full-width button
headers. Expansion state is local UI state and must not be persisted
server-side.

Default load behavior:

- show section headers first, with bodies collapsed;
- if a hash route targets a section, expand and scroll to that section;
- if active filters hide all records in a closed section, preserve the section
  header and progress state rather than rendering an empty page.

### R4 - Show Mini Progress Meters In Section And Group Headers

Each section and group header must show three compact meters:

- Spec;
- Data or Datasheet;
- Photo.

Each meter shows label, `done/total`, and a slim progress bar. The bar fill is
the app accent color by default and success green at 100 percent. A zero-done
meter should make the `done/total` text use the app highlight/danger family.

Remove separate "N to do" badges. The meters and attention line are the status
signals.

### R5 - Make Record Rows Compact Until Expanded

Collapsed record rows must use a stable grid:

- identity cell: caret, record name, optional metadata/sub-label;
- Spec status cell;
- Datasheet status cell;
- Photo status cell.

Clicking the caret or the record name expands the row. Expanded content moves
the detailed evidence controls out of the always-visible grid and into a panel:

- `Open owner` link;
- Datasheet drop/upload zone;
- Photos drop/upload zone.

Keep the existing record detail modal. The expanded row panel owns quick owner
link + upload/drop-zone actions; the modal remains the deeper record detail
view. Avoid duplicate always-open controls in the collapsed grid.

### R6 - Preserve How-To-Photograph Modals

Keep the existing section-level "How to photograph" directions modals. They
were omitted from the Claude Design mockup but remain part of the product
contract.

The redesign must preserve:

- section-level access to `DirectionsModal`;
- existing static directions content from
  `frontend/src/features/documentation/directions/`;
- viewer access to directions;
- editor access to directions;
- phone-width usability for contractor photo guidance.

The directions affordance may move visually to fit the 1A section-card header,
but it must remain discoverable and must not be dropped during the accordion
redesign.

### R7 - Represent Spec, Datasheet, And Photo Status As Select Pills

The accepted axis values are:

- Spec: `Complete`, `Question`, `Needed`, `NA`;
- Datasheet: `Complete`, `Needed`, `NA`;
- Photo: `Complete`, `Needed`, `NA`.

Spec continues to write the existing cross-table `Specification Status` field.
Datasheet and Photo need persisted per-axis evidence status, not purely derived
status, because a user may attach one or more files and still set that axis
back to `Needed` when more evidence is required.

Datasheet/Photo write behavior:

- Uploading a datasheet or photo auto-sets that axis to `Complete`.
- Selecting `Complete` marks that axis complete.
- Selecting `Needed` marks that axis incomplete even when attachments are
  already present.
- Selecting `NA` marks that axis not applicable and counts it as complete for
  rollups.
- Datasheet/Photo do not expose `Question`.

Migration/backfill should preserve current semantics:

- existing N/A waiver -> axis status `NA`;
- at least one attachment and no waiver -> axis status `Complete`;
- no attachment and no waiver -> axis status `Needed`.

### R8 - Preserve Existing Evidence Backbone

Do not introduce new upload primitives. Reuse:

- `DATASHEET_ATTACHMENT_CONFIG` for datasheets;
- `SITE_PHOTO_ATTACHMENT_CONFIG` for photos;
- existing attachment attach/detach endpoints;
- existing draft etag chaining and document write invalidation.

Datasheet upload from the Documentation page is new behavior relative to the
current page and must follow the owning record write path. Photo upload keeps
the current Documentation page behavior but moves into the expanded panel.
Both upload paths must auto-set their axis status to `Complete`.

### R9 - Preserve Access And Version Invariants

Viewer and locked-version surfaces remain read-only:

- no enabled selects;
- no upload/drop zones;
- no delete controls;
- no waiver-only affordances.

Editors see draft data and writes continue to mark the local draft touched so
the standard workspace Save Version affordance remains the publishing path.

### R10 - Accessibility And Responsive Behavior

Accordion buttons must expose accurate `aria-expanded` state and useful labels.
Keyboard users must be able to expand/collapse sections, groups, and records.
Selects must retain native keyboard behavior.

Desktop layout should scan as a compact table. Phone-width layout must stack
without text overlap, clipped controls, hidden owner links, or unusable upload
targets.

## Non-Goals

- No topbar or project-tab redesign.
- No replacement of the asset service or upload pipeline.
- No production deployment.
- No contributor-auth changes.
- No broad redesign of Equipment, Envelope, Apertures, or Thermal Bridges
  owner pages.
- No new global design tokens unless the Documentation page exposes a reusable
  status pattern that belongs in shared UI docs.

## Acceptance Criteria

- On initial load, the page reads as an overview: header, attention line,
  filters, and section cards with meters.
- Users can drill down section -> group -> record without losing filter state.
- Editing a Spec/Datasheet/Photo status updates the visible pill color and
  recomputes local rollups immediately or after the accepted mutation response.
- Datasheet and Photo uploads still save through draft document writes and show
  in the owner table surfaces.
- Viewer/locked-version surfaces expose no edit affordances.
- Focused RTL tests cover section/group/record expansion, select mapping,
  filter behavior, read-only behavior, directions-modal access, and rollup
  recomputation.
- A browser smoke checks the Documentation route at desktop and phone widths
  after `make agent-browser-ready`.
