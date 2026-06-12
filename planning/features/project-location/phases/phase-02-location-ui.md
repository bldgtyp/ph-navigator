---
DATE: 2026-06-12
TIME: 17:19 EDT
STATUS: Complete — implementation, browser smoke, format, CI, and graph update passed.
AUTHOR: Claude (for Ed)
SCOPE: Frontend "Location" section in Project Settings — editor edit /
  viewer read-only, wired to GET/PUT /location with SI↔display unit
  conversion and client-side validation.
RELATED:
  - planning/features/project-location/PRD.md §5,§7,§8,§9
  - planning/features/project-location/phases/phase-01-location-backbone.md
  - frontend/src/features/projects/components/ProjectSettingsModal.tsx
  - frontend/src/features/projects/{types,hooks,api}.ts
  - frontend/src/lib/units/ (unit helpers)
  - context/UI_UX.md, context/CODING_STANDARDS.md (load before FE work)
---

# Phase 2 — Location UI (frontend)

## 1. Goal

A "Location" section in the Project Settings modal where editors set
latitude / longitude / elevation / time zone / true-north /
address-city-state and viewers read the same data. Wired to Phase 1's
`GET/PUT /api/v1/projects/{id}/location` via TanStack Query, SI on the
wire, with elevation the only IP/SI-converted field.

## 2. Required reading (in order)

1. `frontend/src/features/projects/components/ProjectSettingsModal.tsx`
   — the metadata-section + viewer-branch + save/change-detection
   pattern to mirror.
2. `frontend/src/features/projects/{types,hooks,api}.ts` — the
   query/mutation + types pattern.
3. `frontend/src/lib/units/` — IP/SI conversion helpers and the toggle
   source; how length/elevation is formatted elsewhere.
4. PRD §7 (UI), §8 (validation), §9 (units). `context/UI_UX.md` for
   section styling conventions.

## 3. Work breakdown

### 3.1 Types + data layer
- [x] Add `ProjectLocation` (+ `EpwDescriptor | null`, present now, used in
  Phase 3) to a location types module under
  `frontend/src/features/projects/` (or a small
  `features/project-location/` FE folder mirroring backend — pick the
  convention already used for sibling project sub-resources).
- [x] `useProjectLocationQuery(projectId)` and
  `useUpdateProjectLocationMutation(projectId)` mirroring
  `hooks.ts`; mutation `onSuccess` updates the query cache and surfaces
  `warnings[]`.

### 3.2 Location section in `ProjectSettingsModal`
- [x] New `<section className="settings-section">` after metadata, before
  MCP tokens, matching the existing markup/labels.
- [x] **Editor:** controlled inputs for coordinates (decimal degrees),
  elevation (display-unit aware), time zone (text or select of common
  IANA zones), true-north (degrees), address/city/state. Save through
  the location mutation; reuse the modal's existing dirty-tracking /
  save-button pattern (a `changedLocationFields` helper analogous to
  the metadata one).
- [x] **Viewer:** read-only rendering (no inputs), matching the modal's
  existing viewer branch.
- [x] **Empty state:** "No location set" hint when `is_set` is false.
- [x] Render any `warnings[]` from the PUT response as a non-blocking
  banner (the slot Phase 3's EPW-mismatch warning will fill).

### 3.3 Units (PRD §9)
- [x] Elevation: store/send metres; display/edit in m or ft per the IP/SI
  toggle using `frontend/src/lib/units/` helpers; round-trip safely
  (convert display→m on save).
- [x] Latitude / longitude / true-north: angular degrees — render as-is in
  both unit systems (no conversion). Document this inline so a future
  editor doesn't "helpfully" convert them.

### 3.4 Client-side validation
- [x] Mirror PRD §8 ranges for instant feedback; the server remains
authoritative. Block save on hard-invalid input; never block on the
EPW-mismatch warning (Phase 3).

## 4. Out of scope

EPW upload / parse / apply (Phase 3). Status-tab card (optional
nice-to-have; only if cheap and requested). Map / geocoding.

## 5. Verification gate

1. [x] **Vitest**: elevation m↔ft round-trip; coordinate/north invariance
   across the IP/SI toggle; client validation accept/reject; dirty-
   tracking + save payload shape (partial PUT, explicit-null clears);
   viewer renders read-only with no write affordances.
2. [x] **Playwright/MCP** (codex@example.com, port 5173): editor sets a
   location and reloads to confirm persistence; logged-out viewer sees
   read-only values and no inputs.
3. [x] **Closeout**: `make frontend-dev-check` during iteration; full
   `make format` + `make ci` green before done. `graphify update .`.

## 6. Exit criteria

Editors set/edit/clear location and see it persist; viewers see it
read-only; elevation toggles units while coordinates/north stay
stable; the warnings banner slot is in place for Phase 3.
