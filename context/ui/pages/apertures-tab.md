> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.6 Apertures tab (`/projects/{id}/apertures`)

The Apertures tab has five route-addressable sub-tabs:

- **Builder** (`/projects/{id}/apertures/builder`) — the visual aperture-type
  editor.
- **Glazings** (`/projects/{id}/apertures/glazings`) — a report-table
  specification page for project glazing products.
- **Frames** (`/projects/{id}/apertures/frames`) — a report-table
  specification page for project frame products.
- **Installs** (`/projects/{id}/apertures/installs`) — the DataTable library
  of window-install Ψ types (`aperture_install_types`).
- **U-Values** (`/projects/{id}/apertures/u-values`) — an auditable
  line-by-line aperture U-value report with CSV and formula-XLSX downloads.

Bare `/projects/{id}/apertures` redirects to Builder.

## 2.6.1 Builder

**(Detailed in US-Builder-Apertures.)** Aperture types (doors, windows,
skylights): left-rail list of aperture-type entries; clicking an entry opens the
per-aperture-type editor (rows, columns, frames, glazings, operation).

The left rail is the shared **element sidebar**
(`frontend/src/shared/ui/element-sidebar/`), the same component behind the
Envelope Assemblies list, styled to the "1A Quiet List" direction: bold title +
ghost Sort/Collapse/Add buttons, where **Sort** is a quiet `⇅` ghost button that
opens an **Alphabetical / Manual** radio menu (the shared `AppMenu`), 40 px rows
with neutral hover and teal-only selection, a hover/`:focus-within`-revealed
ghost action cluster (`Rename · Duplicate · Delete`, no dark tooltip) over a
gradient scrim, and — in Manual mode — a hover-reveal drag grip,
groups-as-dividers with **drag-between-groups** assignment (drag a row onto
another group; empty groups show a "· · ·" drop placeholder), and an
**add-group divider** — a centered `+` hairline line at the top of the list.
Order/manual/group state persists per-user via `user_sidebar_views` view-state.
Aperture rows are **iconless** (unlike Envelope's assembly-type icons); they keep
the reserved icon slot empty so alignment matches. All editor affordances are
hidden for viewers / locked versions. See the design-system component inventory
for the shared component.

Use the shared builder shell: object browser/list on the left, visual
aperture editor in the center, computed U-w / dimension summary near
the top, and inspector/details or editable breakdown table adjacent to
the selected visual object. Catalog origins and custom overrides should
be visible without forcing the user into a separate audit page. The Builder
keeps its inline U-values for design work; the separate U-Values report adds
the full calculation depth and compliance-export path without replacing that
immediate feedback.

### Empty panels

An aperture element may be **Glazed** or **Empty**. Empty panels preserve the
rectangular grid layout but are not part of the window unit: their area is
wall, and they produce no calculation/specification element row or U-w/SHGC
contribution. Reports and exports may retain only the excluded Empty-panel
count for reconciliation. The canvas shows them as a near-transparent cell
with a dashed outline; selection, hover, element name, grid dimensions, merge,
and split affordances remain available.

The element card hides glazing, frame, operation, and U-value controls for an
Empty panel and shows the standard explanation:

> Empty panel: occupies the layout but is not part of the window unit. The area
> is wall; it is excluded from U-value, spec report, and all exports.

In that compact UI copy, "excluded from all exports" means no Empty-panel
calculation row or thermal contribution; aggregate exports may still carry the
excluded count for reconciliation.

Changing an assigned Glazed panel to Empty requires confirmation because the
command clears its glazing, operation, and four frame assignments. The dialog
also reminds the editor to re-check adjacent glazed edges as window-to-wall
junctions (jamb, sill, or head rather than mullion). The toolbar applies the
same command once to all selected elements that are not already the target
kind.

Empty panels cannot be pick/paste sources or targets. Mixed Glazed/Empty
selections cannot merge; same-kind selections can. Converting a paste target
to Empty removes its stale paste-undo entry. Paste undo restores the complete
prior assignment snapshot and remains disabled while another builder command
is running; failed restores stay retryable and surface the command error.

## 2.6.2 Glazings Report

Glazings is the aperture analog of Envelope → Materials/Specifications. It uses
the shared `frontend/src/shared/ui/report-table/` primitive and should feel
visually identical to the Materials report: same density, spacing, status chips,
datasheet evidence pattern, expandable rows, and in-scope/N/A/unused grouping.
Only the content changes.

Rows are flat `project_glazings` products, shown once per project glazing. The
main columns are Glazing, Manufacturer, U-value, g-value, Datasheet, and Status.
The expanded row shows:

- Datasheets via the shared `AttachmentCell` and datasheet attachment config.
- "Used in N elements" as a compact summary, with a View action that opens a
  right-side use-sites sheet grouped by aperture type, then aperture element.
- Catalog drift evidence, including refresh actions where the catalog row still
  exists and fields differ.

Editors can update the specification status, add/remove datasheets, refresh from
catalog, and remove unused project glazings. Locked versions and viewer mode are
read-only: evidence stays visible, while upload/delete/status-edit controls are
hidden or disabled. Viewer mode hides N/A and unused glazing rows.

## 2.6.3 Frames Report

Frames mirrors Glazings but lists flat `project_frames` products. The main
columns are Frame, Manufacturer, U-value, Psi-install, Width, Datasheet, and
Status. The use-sites sheet groups rows by aperture type, then aperture element,
and keeps the frame side (Top/Right/Bottom/Left) visible under each element,
because a frame product can be referenced by different sides of an aperture
element.

Frames uses the same report-table/status/evidence behavior as Glazings and
Envelope → Materials. Editors can update status, attach/detach datasheets,
refresh catalog drift, and remove unused project frames. Viewer and locked
version behavior is read-only with N/A/unused rows hidden in viewer mode.

## 2.6.4 Installs

Installs is the project library of **window-install Ψ types**
(`aperture_install_types`), the per-edge installation-junction psi-values
(aperture-psi-install feature). It is a standard DataTable page (TB-style
seeded FieldDefs) with Name, Ψ-install, Source, Report (Flixo/THERM PDF
attachments via `pdf_report_asset_ids`), Datasheet/Site Photos evidence, and
Status columns. Every project carries a seeded, undeletable **Default** row —
program-aware (Phius 0.052 / PHI 0.04 W/m·K) at project creation; deleting any
other type in use is blocked with a 409 listing its dependent edges.
`?focus={row_id}` deep-links (used by the Documentation page) scroll to and
highlight the row.

Assignment happens in the Builder, not on this page:

- **Per-edge slots.** Every glazed element carries four install slots
  (top/right/bottom/left). An unset slot **inherits the Default type**;
  interior (mulled) edges — where the neighboring cell on that side is glazed
  — are **derived Ψ = 0** and cannot carry an assignment. Edges next to Empty
  panels or the aperture boundary are perimeter edges.
- **FrameRow Ψ-inst column.** The element card's per-edge table shows the
  effective value per side: assigned (plain), inherited default (muted), or
  mulled (dash + derived-zero tooltip). The resolved values feed the U-Values
  report's Ψ-install column and route-3 GH exports; Ψ-install is always
  excluded from U-w.
- **Installs modal.** The builder header's `Installs` action opens a
  per-aperture modal: a read-only key-view SVG with per-edge tint overlay,
  a legend of install types (swatch, Ψ, PDF chip, live usage count), and
  pick-type-then-paint-edges interaction — click an edge to assign the armed
  type, click again to clear back to inherit; while a type is armed the key
  view takes the paint-bucket cursor, and the hovered edge takes a neutral
  2px ring plus a saturated fill. "Cleared" is never presented as an absence:
  the legend states that unpainted edges inherit the Default row *with its Ψ*,
  and each unassigned edge's tooltip repeats it. **Nothing is written until `Save`**: the
  session accumulates in `installs-draft.ts` (edge slots, new/edited types,
  copy targets) and the footer is the standard Cancel/`Save` pair, so Cancel —
  and Escape — discards the whole session. Save writes the type-library rows
  first (one create batch, one edit batch), then the edge commands; a session
  that leaves every perimeter edge on one type collapses to the single
  `applyInstallToApertures` command instead of one write per edge.
  Tools sit with what they act on, not in the footer: `Apply to all edges` is
  in the key view's paint bar (always rendered, enabled once a type is armed —
  appearing/disappearing shifted the drawing under the cursor), and
  `Copy to other apertures…` —
  replacing a target's edge assignments with this aperture's, restricted to an
  identical grid signature — is a header accessory. `+ New type…` closes the
  legend list, and each legend row carries a pencil that renames / re-values
  that type in place; both go through the same payload builders as this page
  (no forked validation). Per-type usage is a *project-wide* count, so it lives
  in that row's editor ("Used on 4 edges in this project") rather than in the
  list, where it read as a fact about the aperture on screen. Main controls
  carry the shared `<Tooltip>`; the two that can be disabled hang theirs off a
  wrapper span, so the hint still explains *why* they are disabled (most often:
  no other aperture has an identical grid). A Ψ field the user did not touch is not written back,
  so its display rounding can never quantize the stored value.

## 2.6.5 U-Values Report

U-Values is a display-only audit page for the ISO 10077-1 composite aperture
calculation. Editors see the current document view—their draft when one exists,
otherwise the saved version; viewers and locked versions read the saved
version. The page follows the global SI/IP preference and performs no
calculation beyond unit conversion and formatting.

The summary table lists Aperture, Overall W × H, Elements (**glazed** — it must
equal the rows in that aperture's element table, so it reports
`glazed_element_count`, not the Empty-inclusive `element_count`), Area, U-w,
SHGC (glazing-area-weighted), and Completeness (the shared read-only
`StatusPill`, not plain text). Each aperture then has an element table with
Element, Grid, W × H, Area, Glazing, U-g, g-value, A-glazing, A-frame,
Q-glazing, Q-frame, Q-spacer, and U-element — one value per column; the glazing
name, its U and its g-value are **not** combined into one cell. Expanding an
element shows exactly four exterior-view edge rows in Top / Right / Bottom /
Left order with Frame, Width, U-f, Ψ-g, Ψ-install (explicitly excluded from
U-w), edge and interior lengths, center/corner/frame areas, and
Q-frame/Q-spacer.

Each aperture's footer restates that aperture's summary row (Total area, U-w)
and so must use the **same formatters as the summary columns** — reaching for
the Builder's `formatWindowUValue` chip helper instead printed a 2-decimal U-w
under a 3-decimal one for the same aperture. Unit labels come from
`features/catalogs/components/unit-labels.ts` (`m2`, `W/m2-K`), never
hand-written superscripts.

The element tables are wider than the workspace: they scroll horizontally
inside the shared `ReportTable`, which freezes the expand gutter and the
Element column so a scrolled row keeps its identity. The report sub-tabs let
the `.apertures-body` card grow with their content; only the Builder is
clamped to the viewport (`.apertures-body--workspace`).

The report convention is explicit above the tables:

- U-w is the **uninstalled** whole-unit value; Ψ-install is displayed for
  reference but excluded.
- Frame corners use a **45° corner split**: each adjacent edge receives half
  of the shared corner area.
- Edge names are read **as seen from outside**.
- Aperture SHGC is glazing-area-weighted.

Empty panels produce no element rows and do not enter U-w or SHGC; their
excluded count remains visible for reconciliation, and this page says
"**Empty panel**" — `kind: "void"` is the wire term only (see `GLOSSARY.md`).
An incomplete glazed
element remains visible with warning styling/text and renders unavailable
calculated cells as em dashes. The aperture rollup includes each unfinished
element as U = 0 and presents a warning stating that treatment. A missing
glazing g-value is a non-unfinished warning: that element is excluded from both
the SHGC numerator and denominator. A project with no aperture types shows the
shared `.empty-state`; editors get a link back to the Builder, while viewers get
explanatory copy only.

The U-value report action menu is hidden without
`apertures.export.u_value_report`. Authorized users can download:

- **CSV (raw data)** — UTF-8 BOM/CRLF tabular values in the active unit system.
- **XLSX (with formulas)** — `Window Units` and `Summary` sheets with live
  formulas that mirror PHN's calculation.

Both downloads always use the saved version. If an editor has a draft, the
confirmation dialog states that unsaved changes are excluded. The same dialog
reports any unfinished elements from the saved report being exported.
