---
DATE: 2026-07-15
TIME: 15:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Integrated verification, browser acceptance, graph update, and docs closeout.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
  - ./phase-01-backend-locality-candidates.md
  - ./phase-02-modal-town-search.md
---

# Phase 03 - Verification and Docs

## Result

Complete. Both search modes passed the mounted Climate route, downstream
Climate pickers, public projection, focused suites, simplify/docs-pass, and the
full repository gate. Browser testing found indistinguishable same-name County
Subdivision labels; the final backend now adds county, then Census geography
type, then GEOID only when needed to make every returned label unique.

## Goal

Prove both search modes through the mounted Climate route and reconcile durable
API/privacy documentation before feature closeout.

## Automated Verification

1. Re-run focused backend project-location tests.
2. Re-run focused frontend location-form and modal tests.
3. Run `make frontend-dev-check`.
4. After `simplify` and `docs-pass`, run `make format` and `make ci` from the
   repository root. Re-run `make ci` if formatting changes files.

## Browser Matrix

Before localhost browser work, run:

```bash
make agent-browser-ready
```

Use the printed sign-in URL and a fresh tab. Verify:

1. Full address -> candidate -> map -> save -> reopen.
2. Without any MapTiler configuration: town + state + ZIP -> locality candidate
   -> town-level map -> save -> reopen.
3. Existing full address -> town-only replacement -> old street absent.
4. Locality selection -> elevation auto-fill -> manual elevation override.
5. Locality selection -> pin refinement without adding a street; confirm the UI
   warns that the refined point is saved/shown and no longer calls it town-level.
6. Public/viewer location response and rendered page contain no street address.
7. Climate dataset/weather pickers still load from the saved town coordinates.
8. Verify an ambiguous locality and a no-match query render deterministic,
   accurate candidate/copy behavior.

Do not use an old browser tab that has shown a network or internal `data:` URL
error.

## Durable Docs

- Reconcile `context/technical-requirements/api.md` with the bundled Census
  Gazetteer locality path, live Census address path, and additive candidate
  metadata.
- Remove stale `MAPTILER_API_KEY` deployment/configuration guidance if the
  dormant code path is removed in Phase 01.
- Clarify locality-only address composition if needed in
  `context/technical-requirements/data-model.md`.
- Keep provider-specific implementation details out of stable product docs
  unless they are operationally required.
- Update this packet's `STATUS.md`, `PLAN.md`, and phase ledger with actual
  commands/results.
- Update `planning/STATUS.md`.

## Closeout

1. Run `graphify update .` after code changes.
2. Run the `simplify` skill and fix in-scope issues.
3. Run the `docs-pass` skill and fold durable decisions into `context/`.
4. Record browser evidence and exact focused/full gate results.
5. Archive only after implementation is landed and verified.

## Exit Criteria

- Both address and locality flows pass automated and live-route verification.
- The Phase 01 automated public/viewer locality regression is re-run and remains
  green.
- Public/viewer privacy behavior is verified.
- Census address-geocoder and Gazetteer locality boundaries are documented
  honestly.
- Graphify, simplify, docs-pass, and the final repository gate are complete.
- Planning status accurately distinguishes implemented, merged, and complete.

## Completed Evidence

Automated on 2026-07-15:

- backend importer/project-location suite: `47 passed`; focused Ruff and ty
  passed;
- frontend location-form/modal/presentation suite: `31 passed`; TypeScript
  passed;
- `make frontend-dev-check`: passed with the 14 existing Fast Refresh warnings
  and existing Vite chunk-size warning;
- `graphify update .`: rebuilt 24,281 nodes / 58,413 edges;
- simplify: shared the county-reference loader, reduced cached locality FIPS
  state, closed duplicate-label edge cases, and normalized reference failures
  to the locality-index 503 contract;
- docs-pass: reconciled `context/technical-requirements/api.md` and
  `context/technical-requirements/data-model.md`;
- `make format && git diff --check && make ci`: passed; backend `1373 passed,
  7 skipped`, frontend `2165 passed`, production build passed.

Mounted Climate route using the isolated `AGENT-BROWSER` fixture:

- full address searched, selected, mapped, saved, and reopened;
- `West Stockbridge, MA 01266` searched keylessly, selected as Town, replaced
  the old street, saved, and reopened as locality-only;
- locality elevation auto-filled from USGS, accepted a manual `500 m` override,
  and a map pin refinement switched to the custom-point privacy warning;
- anonymous `GET /location` returned `street_address: null` and
  `full_site_address: "West Stockbridge, MA 01266"`;
- `Washington, PA` rendered five deterministic, county-qualified candidates;
  no-match input rendered the address-or-town alert;
- the saved town coordinates loaded 15 Phius Massachusetts stations and 38
  hourly-weather files.
