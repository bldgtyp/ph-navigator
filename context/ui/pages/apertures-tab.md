> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.6 Apertures tab (`/projects/{id}/apertures`)

The Apertures tab has three route-addressable sub-tabs:

- **Builder** (`/projects/{id}/apertures/builder`) — the visual aperture-type
  editor.
- **Glazings** (`/projects/{id}/apertures/glazings`) — a report-table
  specification page for project glazing products.
- **Frames** (`/projects/{id}/apertures/frames`) — a report-table
  specification page for project frame products.

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
be visible without forcing the user into a separate audit page.

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
