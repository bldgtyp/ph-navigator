> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.8 Spaces and Equipment tabs

**Spaces (`/projects/{id}/spaces`).** The Spaces tab groups
project-local occupancy/program tables. It contains Space-Types and
Rooms sub-tabs. Space-Types is the setup table for project-specific
labels such as Apartment, Corridor, Restroom, or other local program
types; Rooms links to exactly one Space-Type and remains the
PHN-first source-of-truth consumed by downstream Rhino/HBJSON
workflows. Legacy `/projects/{id}/rooms` URLs redirect to
`/projects/{id}/spaces/rooms`.

**Equipment (`/projects/{id}/equipment`).** Detailed in
US-Builder-Equipment. Equipment keeps MEP/equipment schedules such as
Ventilators, Heat Pumps, Pumps, Fans, hot-water equipment, electric
heaters, Appliances, and future equipment catalog-backed tables.
Thermal Bridges is a top-level project tab, not an Equipment sub-tab.

Spaces and Equipment surfaces should use dense, filterable tables with
status / evidence badges that follow §1.8. When row detail becomes too
wide for the grid, use a selected-row details/evidence panel rather
than forcing long manufacturer/model/spec strings into cramped cells.
Preserve fast scan/edit/copy behavior; avoid pagination as the primary
way to manage project-scale tables unless performance requires it.

