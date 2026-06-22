---
DATE: 2026-06-22
TIME: -
STATUS: **DONE** (2026-06-22). All three decorative maps adopted the shared
  `<ClimateMap>`: Location-page big map, sidebar mini-map (static), and the
  Set-Location pin-drop (writes lat/long back). O4 closed app-wide. vitest +
  build + guards green; verified live in-browser. See **Outcome — P3** below.
AUTHOR: Ed (via Claude)
SCOPE: P3 — adopt the picker's `<ClimateMap>` for the app's other decorative
  climate maps (Location page, sidebar, Set Location pin-drop), closing O4
  app-wide.
RELATED:
  - ../PRD.md §6; ../decisions.md D-DP-5, O-DP-1
  - planning/archive/climate-auto-populate/ (O4; D-CL-15 MapTiler choice)
  - frontend/src/features/climate/ (climate-map-surface placeholders)
  - frontend/src/features/climate/components/SetLocationModal.tsx (.set-location-map)
---

# Phase 3 — App-wide map retrofit (closes O4)

> **Update (D-DP-6, 2026-06-21):** the basemap is **vanilla Leaflet + keyless
> OSM raster**, not MapLibre/MapTiler, and **O4 is dissolved** (no key/proxy/
> secret). Read "MapLibre/MapTiler tiles" below as "Leaflet/OSM tiles"; "verify
> no MapTiler key is committed" is moot (there is none to commit). The
> Set-Location pin-drop is now `map.on('click', …)` writing lat/long back.

## Goal

The basemap is introduced in P2 (the picker). P3 **spreads the same
`<ClimateMap>` component** to the remaining decorative `climate-map-surface`
placeholders so the whole app shares one real map, closing O4 everywhere.

## Preconditions

P2 shipped `<ClimateMap>` (MapLibre/MapTiler tiles + project/station pins + the
key-less fallback) and the O4 key/dep/proxy are in place.

## Work

Replace the decorative placeholders with `<ClimateMap>`:

- **Location page** (`.climate-big-map`) — project pin on a real basemap.
- **Sidebar location card** (`.climate-mini-map`) — small static basemap, project
  pin (no interaction).
- **Set Location modal** (`.set-location-map`) — interactive **pin-drop** that
  writes back lat/long (today the modal notes "interactive pin-drop arrives with
  map tiles" — this fulfills it).

Each keeps the key-less fallback so CI/tests/no-key dev still render.

**Controller seam to generalize (noted during P2b review).** P2b's
`createClimateLeafletMap` exposes a single station-picker-shaped callback
(`handlers.onSelect(stationId)`). The Set-Location pin-drop is a *different*
interaction — click empty map → emit a coordinate — which can't ride on
`onSelect`. When P3 lands the pin-drop, **generalize the handler surface**
(e.g. `{ onSelectStation?, onPickPoint? }`) rather than bolting a second
callback onto the picker's bag. Likewise the mini-map / Location cases are
project-pin-only: let the station layer become an *optional* capability instead
of special-casing an empty `stations: []` inside `setData`. The `live?` decision
(today the module-level `import.meta.env.MODE` gate) may also want to become a
per-surface prop if any consumer needs to force the fallback in dev.

## Tests

- vitest: each surface renders `<ClimateMap>` with the right pins; the
  Set-Location pin-drop updates the coordinate fields (fallback mode).
- Playwright MCP (keyed env): Location/sidebar show the basemap; Set-Location
  pin-drop moves the pin and updates coordinates.
- `make ci` green; verify no MapTiler key is committed (public repo).

## Exit criteria

The Location page, sidebar card, and Set Location modal all render the shared
`<ClimateMap>`; Set-Location pin-drop is interactive; key-less envs degrade
gracefully; no secret is committed; CI green. **O4 is closed app-wide.**

## Outcome — P3 (2026-06-22)

`<ClimateMap>` became the app's **one shared map** and now backs all four
surfaces; O4 is closed everywhere.

- **Generalized `<ClimateMap>` + controller.** The component's props went from
  picker-specific to a coherent shared surface: `stations` / `selectedId` /
  `onSelectStation` are optional (project-pin-only consumers omit them),
  `onPickPoint(lat, lon)` is the pin-drop, `interactive={false}` is a static
  basemap (no pan/zoom/controls), and `className` / `ariaLabel` / `ariaHidden`
  size and label the frame. `createClimateLeafletMap` gained
  `{ interactive, onSelectStation?, onPickPoint? }` — the picker's single
  `onSelect` no longer leaks into every consumer (the seam flagged in P2b). A
  `framed` flag preserves the user's zoom when a single-point map re-centres on
  a pin-drop. Shared map chrome moved to `climate-map.css`
  (`.climate-map` + `.climate-map-canvas`), imported by the component so every
  consumer gets it.
- **Location page** (`ClimateTab` `.climate-big-map`) — the project pin on the
  real basemap when the location is set, else the decorative empty surface.
- **Sidebar mini-map** (`ClimateSourceSidebar` `.climate-mini-map`) — a static,
  non-interactive, `aria-hidden` thumbnail. The `LocationCard` changed from a
  `<button>` to a `role="button"` div (Enter/Space handled) so the map `<div>`
  can nest legally; the mini-map is `pointer-events: none` so clicks reach the
  card.
- **Set-Location pin-drop** (`SetLocationModal` `.set-location-map`) — once
  coordinates exist (typed or geocoded), the map is interactive and a click
  writes the picked point back into the lat/long fields via `onPickPoint`
  (6-decimal precision). Replaces the old "interactive pin-drop arrives with map
  tiles" placeholder note.
- **Tests + verification:** `__tests__/ClimateMapFallback.test.tsx` covers the
  generalized fallback (project-pin-only renders no station pins; station mode
  reports the clicked id; `ariaHidden`; `className`); the existing 45 climate
  tests stay green. Verified **live in-browser** (Playwright MCP): the Location
  big map + static sidebar thumbnail render with OSM tiles + attribution, and a
  Set-Location map click moves lat/long SW as expected. The pin-drop is a
  live-mode capability — the `placePins` fallback has no projection, so vitest
  asserts the fallback render and the modal's text-input path instead.
