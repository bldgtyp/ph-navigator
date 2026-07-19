> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.8b Climate tab (`/projects/{id}/climate`)

**Purpose:** The project's location plus the weather/climate reference
datasets it draws on. A shipped top-level workspace tab
(`features/climate/`, `ClimateTab.tsx`).

## Layout — master/detail source browser

Two panes (`climate-workspace`):

- **Left sidebar** (`ClimateSourceSidebar`): a list of selectable entries —
  the site **Location** entry first, then one row per canonical climate
  **type**. Each type is either attached (a real source) or an empty "slot"
  (`slot:<kind>`) that acts as its own empty-state page. Editor rows expose a
  "set from nearest" / attach affordance.
- **Right main pane** (`climate-main`): renders the page for the current
  selection — the Location page, an attached source's detail page
  (`ClimateSourceDetailPage`), or a `MissingSourcePage` empty state for an
  unattached type.

Selection is local component state; changing it swaps the right pane. The tab
is editable when `project.access_mode === "editor"`; viewers see the same
pages read-only (no attach/upload/set-location affordances).

## Location page

Read-first: a large site map (`ClimateMap`, a Leaflet map) plus a facts list
— coordinates, county · state, elevation (unit-aware via the IP/SI toggle),
and IECC climate zone. Editors open `SetLocationModal` to set/adjust the
project location.

## Climate sources

Sources come in canonical kinds. Two attach paths are hoisted to the tab as
modals so the sidebar, a source's detail header, and the empty-state pages
can all open them:

- **PH dataset picker** (`ClimateDatasetPickerModal`) for the PH
  (Phius / PHI) design-climate datasets — keyed by `PhClimateKind`. Picking
  attaches a dataset as the source for that type; if no location is set it can
  route the user back to the Location page first.
- **Weather-file picker** (`WeatherStationPickerModal`) for the hourly
  weather file (EPW-style). It can hand off to `ClimateUploadModal` for a
  user-supplied upload.

Attaching from any of these selects the new source in the sidebar. A source's
detail page (`ClimateSourceDetailPage`) shows the dataset's record — tabular
monthly/annual values (`ClimateRecordTable`) and charts
(`ClimateRecordCharts`), unit-aware.

## Notes

- Climate data is project-level reference material browsed here; it is not the
  versioned DATA-TABLE document content.
- The Model tab's site-sun lens (§2.9) depends on the project location set
  here.
