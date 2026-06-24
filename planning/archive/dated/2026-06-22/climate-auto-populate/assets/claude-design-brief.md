---
DATE: 2026-06-21
TIME: -
STATUS: Reference — design brief to feed a wireframe-generation tool
AUTHOR: Ed (via Claude)
SCOPE: Self-contained prompt for generating 2–3 wireframe variants of the
  reshaped Climate tab. Paste the fenced block below into the design tool.
RELATED:
  - ../PRD.md §7 (UI intent), ../phases/phase-04-roster-visualization-redesign.md
---

# Claude Design brief — Climate tab wireframes

Paste everything inside the fence below into the design tool. It is written
to stand alone (no codebase context required).

---

```
You are a senior product designer. Produce 2–3 distinct, annotated
LOW-FIDELITY WIREFRAMES (layout and structure, not final visual styling) for
one screen of a web application. Compare the variants; explain the trade-offs.

## Product

"PH-Navigator" — a web app that Passive House building consultants use to
manage a building project's climate/weather data basis during design. It is a
dense, technical, data-tool interface (think Linear / Notion / Airtable
density and restraint — NOT a marketing page). Light theme. Desktop-first,
should degrade gracefully on a narrow viewport.

Two audiences for the same screen:
- EDITOR — a signed-in energy modeler/consultant who sets and edits everything.
- VIEWER — a public, read-only audience (the building owner or architect).
  Privacy rule: the building's spelled-out street address is shown ONLY to the
  editor. Everyone else sees coarse location only (coordinates, county, state,
  climate zone) — never the street address.

## The screen: the "Climate" tab

Its job: establish and inspect a project's climate-data basis, starting from
the site address. The whole screen is driven by one action — entering the
site address — after which the app auto-derives and attaches everything else.

## Primary workflow this layout must support

1. Editor enters the SITE ADDRESS in a modal (the address is private).
2. The app auto-derives and displays: latitude/longitude, county + state,
   site elevation, and the IECC climate zone (e.g. "5A").
3. The app auto-finds and attaches several CLIMATE SOURCES: the nearest
   "Phius" dataset, the nearest "PHI" dataset, the nearest "ASHRAE" design-
   conditions station, and the nearest "EPW" weather file.
4. Each source shows a CERTIFICATION STATUS as a colored chip:
   - green "OK" / amber "Check" / red "Fail",
   - plus distance to the station and the elevation difference.
   - Example failure: "No Phius set within 50 mi / 400 ft — custom data
     required." This red state must be impossible to miss.
5. The editor can EXPAND/INSPECT any source to see its data, shown two ways
   via a Table/Charts toggle:
   - Table: monthly air/dewpoint/sky/ground temperatures (12 columns),
     monthly solar radiation by orientation (N/E/S/W/Global), and a few
     "design condition" rows.
   - Charts: monthly line graphs of temperature and of radiation.
   - A COMPARE mode to view two sources together (overlaid or side-by-side).
6. A SUN-PATH diagram for the location (a circular compass-style diagram).
7. A secondary, demoted REFERENCE-DATASET BROWSER for manually searching and
   attaching a source by hand (search by country/region or "nearest to site").
   This is an override path — keep it visually subordinate to the auto path.

## Content blocks to lay out

- A. Location card: coordinates, county/state/country, elevation, climate
  zone; an "Edit location" button (editor only) that opens the address modal.
- B. Climate sources roster: one row per attached source with a type badge
  (Phius / PHI / ASHRAE / EPW / Custom), the location name, the certification
  status chip (status + distance + Δelevation), a small "fetched on / version"
  note, and an expand/view control. A "Populate / Refresh climate data" action
  lives here.
- C. Source detail (when a row is expanded/selected): the Table/Charts toggle
  and the compare affordance.
- D. Sun-path diagram.
- E. Reference-dataset browser (secondary/collapsed).

## States to depict (at least these)

- FIRST-RUN EMPTY: no address set yet → a prominent, friendly "Set the site
  address to begin" call to action; the rest of the screen is empty/disabled.
- POPULATED (editor): address set, sources attached, one flagged red.
- PUBLIC/VIEWER: read-only, no street address, no edit/populate controls.

## Constraints

- Dense and scannable; minimal chrome; technical audience.
- Communicate status with chips/badges (green/amber/red), not prose.
- Include a unit toggle (°F / °C) somewhere sensible.
- The address modal is a separate overlay — sketch it too.

## Deliverable

2–3 clearly different wireframe LAYOUTS, each annotated, exploring structures
such as:
- Variant A — single column: stacked sections (location → sources → detail →
  sun-path → browser).
- Variant B — two columns: left = sticky location card + sun-path; right =
  sources roster with inline expandable detail.
- Variant C — a first-run setup flow (address → review derived data → confirm
  attached sources) that then settles into a dashboard layout for return
  visits.
For each variant, annotate the key layout decisions and show how it handles
(a) the editor-vs-public difference and (b) the red "Fail" certification flag.
```
