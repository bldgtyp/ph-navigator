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
- "Used in N elements" with aperture type and element names.
- Catalog drift evidence, including refresh actions where the catalog row still
  exists and fields differ.

Editors can update the specification status, add/remove datasheets, refresh from
catalog, and remove unused project glazings. Locked versions and viewer mode are
read-only: evidence stays visible, while upload/delete/status-edit controls are
hidden or disabled. Viewer mode hides N/A and unused glazing rows.

## 2.6.3 Frames Report

Frames mirrors Glazings but lists flat `project_frames` products. The main
columns are Frame, Manufacturer, U-value, Psi-install, Width, Datasheet, and
Status. The expanded use-site rows include aperture type, element name, and the
frame side (Top/Right/Bottom/Left), because a frame product can be referenced by
different sides of an aperture element.

Frames uses the same report-table/status/evidence behavior as Glazings and
Envelope → Materials. Editors can update status, attach/detach datasheets,
refresh catalog drift, and remove unused project frames. Viewer and locked
version behavior is read-only with N/A/unused rows hidden in viewer mode.
