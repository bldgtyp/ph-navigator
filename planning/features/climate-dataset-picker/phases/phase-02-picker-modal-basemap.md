---
DATE: 2026-06-21
TIME: -
STATUS: Draft — planned, not started. Depends on P1 + O4 (MapTiler key + vetted dep).
AUTHOR: Ed (via Claude)
SCOPE: P2 — the generic ClimateDatasetPickerModal(kind) with a real
  MapLibre/MapTiler basemap, state filter, nearest-first list, and select→attach;
  wire its entry points from the Phius and PHI pages; retire the browser for
  phius/phi.
RELATED:
  - ../PRD.md §3, §5, §6, §8; ../decisions.md D-DP-1, D-DP-4, D-DP-5
  - planning/features/climate-auto-populate/ (O4; D-CL-15 MapTiler choice)
  - backend/config.py (settings.maptiler_api_key)
  - frontend/src/features/climate/components/ (ClimateAtoms, ClimateSourceDetailPage,
    ClimateSourceSidebar, ClimateDatasetBrowser, ClimateSourcesSection)
  - frontend/src/features/climate/routes/ClimateTab.tsx
  - frontend/src/shared/ui/ModalDialog
---

# Phase 2 — Picker modal + MapLibre/MapTiler basemap

## Goal

Ship the full interaction the user asked for, from both the Phius and PHI pages,
using one shared component and a **real MapLibre/MapTiler basemap** (Ed's choice,
O-DP-1 / D-DP-5).

## Precondition — O4 (now on the critical path)

Because the map is a real basemap, O4 must land before this phase ships:

- **MapTiler key** provisioned for tile usage (already in backend `Settings` for
  geocoding — confirm tile terms + budget). Serve tiles via a **backend proxy or
  referrer-scoped key** so **no key is committed** (public repo).
- **Map dependency** (MapLibre GL JS / `@maptiler/sdk`) through the pnpm
  supply-chain gate (24 h `minimumReleaseAge`, strict min-age,
  `blockExoticSubdeps`).

## `<ClimateMap>` (new shared component)

- Renders MapLibre tiles with: the **project pin**, **station pins** colored by
  `proximity.status` (pass=success, fail/warn=danger/warning), and the **50 mi
  Phius limit ring** as a GeoJSON circle. Selection highlights a pin ↔ its row.
- **Key-less fallback (engineering, not a product downgrade):** when no key is
  configured, degrade to a plain positioned-pin backdrop that reuses the same
  pure pin-placement helper — so CI, vitest, and key-less dev render and tests
  assert deterministically. Pin placement is display geometry from lat/long; all
  distances/verdicts come from the backend, never recomputed.

## Component

`ClimateDatasetPickerModal({ projectId, kind, onClose })` in `ModalDialog`:

- **State filter:** `<select>` defaulting to the project's derived state; a
  "Nearest to project (any state)" option (O-DP-3). Refetches the P1 roster
  endpoint on change (TanStack Query, keyed by `[projectId, kind, region]`).
- **Map:** `<ClimateMap>` (above), fed the project + roster stations.
- **List:** nearest-first rows — name · `distance_mi` · `Δelevation_ft` · climate
  zone · status chip. Reuse `ClimateStatusChip` / `ClimateTypeBadge`.
- **Select → attach:** selecting previews the verdict; **Attach** (or **Replace
  current dataset**) calls `useCreateClimateSourceMutation` with `{kind,
  ref=location_id, label}` (backend computes `data`, P1), invalidates the
  sources query, closes. For a failing **Phius** pick, show the explicit warning
  (O-DP-2) and attach with `status:"fail"` → the page routes to the custom-set
  CTA. **Cancel** discards.
- **Guards:** no project location → "Set the project location first" + open Set
  Location modal; unseeded kind (`dataset:null`) → "No {PHI|Phius} dataset
  available yet" (O-DP-5).
- **Access:** editor-only; mounted from editor-only buttons.

Keep the pin-placement + list/row helpers as small pure functions (testable
without a DOM / without tiles); the modal stays a thin shell.

## Entry points

- **Phius/PHI page header:** a **Select dataset** / **Change dataset** button in
  `SourceHeader` that opens the modal with the page's `kind`.
- **Missing-source sidebar card:** the "Not set" card's `add →` opens the picker
  pre-filtered to that kind instead of routing to the generic add page.
- **Fail page:** point the existing "Browse datasets to override" link at the
  picker (`kind="phius"`).

## Retire the browser for phius/phi (D-DP-4)

Remove the Phius/PHI path from `ClimateDatasetBrowser`; the "＋ Add source" page
keeps ASHRAE / EPW / custom attach (`ClimateSourcesSection`). If nothing else
uses the browser afterward, retire the component (clean up only the orphans this
change creates).

## Tests

- **vitest** (against the key-less fallback): default state filter = project
  state; list sorted nearest-first with correct chips (Phius pass/fail vs PHI
  advisory); changing state refetches; "any state" mode; select→attach posts
  `{kind, ref}` and closes; failing-Phius warning path (O-DP-2); no-location
  guard; unseeded-kind empty state; viewer sees no picker button. Mount once with
  `kind="phius"` and once with `kind="phi"` to prove the shared component drives
  both. Assert no key is referenced in client bundles.
- **Playwright MCP** (live, keyed env): from the Phius page open the picker,
  filter MA, see the project + stations on the basemap with the 50 mi ring,
  attach the nearest; repeat from the PHI page (against a seeded PHI dataset if
  available, else assert the empty state). Screenshots for both.
- `make ci` green.

## Exit criteria

From both PH pages the editor can open the picker, filter by state (default +
any-state), see project + stations on the MapLibre/MapTiler basemap with
proximity-keyed pins and the 50 mi ring, pick one, and attach it (replacing any
current one; failing-Phius allowed with warning); the old browser no longer
handles phius/phi; no key is committed; the key-less fallback keeps CI green;
gating holds; CI green.
