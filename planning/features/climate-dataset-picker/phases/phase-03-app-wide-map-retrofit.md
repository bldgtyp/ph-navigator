---
DATE: 2026-06-21
TIME: -
STATUS: Draft — planned, not started. Depends on P2.
AUTHOR: Ed (via Claude)
SCOPE: P3 — adopt the picker's `<ClimateMap>` for the app's other decorative
  climate maps (Location page, sidebar, Set Location pin-drop), closing O4
  app-wide.
RELATED:
  - ../PRD.md §6; ../decisions.md D-DP-5, O-DP-1
  - planning/features/climate-auto-populate/ (O4; D-CL-15 MapTiler choice)
  - frontend/src/features/climate/ (climate-map-surface placeholders)
  - frontend/src/features/climate/components/SetLocationModal.tsx (.set-location-map)
---

# Phase 3 — App-wide map retrofit (closes O4)

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
