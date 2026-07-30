---
DATE: 2026-07-29
UPDATED: 2026-07-30 — Phase 05 complete and verified; Phase 06 next
TIME: 09:09 EDT
STATUS: Active — Phases 01–05 complete; Phase 06 docs closeout next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and verification ledger for the Aperture
  U-Value Detail Report feature.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./PLAN.md
---

# STATUS — Aperture U-Value Detail Report

## Current state (2026-07-30)

Phases 01–05 are implemented and verified on
`feature/aperture-u-value-report`.

- Added parity fixtures covering asymmetric edges, a mixed 2×2 grid,
  unassigned and incomplete frames, missing glazing, non-positive glazing
  geometry, mixed void coverage, and all-void apertures.
- Added the detailed calculation DTO and single-source calculation path with
  per-edge lengths, frame-area terms, Q-frame/Q-spacer terms, ψ-install
  passthrough, and incomplete-input nulls.
- The legacy endpoint still projects to the original response/cache shape;
  exact U-values, areas, content hashes, and cache identity are pinned.
- Assigned-but-incomplete frames now emit `incomplete_frame_data`; truly
  unassigned/deleted references remain `missing_frame`.
- Added an uncached REST/MCP report contract with name-bearing per-edge
  detail, exact chip-parity U-w, glazing-area-weighted SHGC, unfinished/void
  counts, provenance, and bounded aperture filtering.
- Report assembly reuses the Phase 01 calculation terms without computing a
  cache hash, and reads only the requested version's public metadata.
- Added capability-gated, saved-version CSV/XLSX exports with canonical
  SI/IP conversions, formula-neutralized user text, explicit unfinished
  rows, per-edge 45° split formulas, and summary references.
- XLSX rollups calculate once per aperture over aperture-local ranges and
  sibling rows reference the first result; multi-aperture ranges are
  regression-tested.
- Live Excel recalculation exposed `IFERROR`-masked U-w and SHGC rollup
  failures that structural openpyxl checks could not detect. The formulas
  now use text-tolerant `SUMPRODUCT` arguments without blanket error
  masking; zero-denominator SHGC is handled explicitly.
- Added the fourth, route-addressable **U-Values** sub-tab with draft/version
  source selection, summary and per-aperture tables, four-edge expansions,
  warnings, unfinished treatment, provenance, empty state, and SI/IP display.
- Centralized report/chip query keys and invalidation, canonical W/K
  conversion, unit labels, and warning contracts.
- Added capability-gated CSV/XLSX actions that export the saved version in the
  current SI/IP preference, with canonical response filenames and page-level
  error reporting.
- Editors get an explicit saved-version warning when a draft exists; unfinished
  counts come from the saved report being exported. Actions remain hidden until
  both guard inputs are ready.

## Decisions — resolved 2026-07-29

Ed accepted: **D-4** export saved version, **D-6** glazing-area-weighted
SHGC, **D-7** option (a) rollup mirrors the chip (include-as-zero, loudly
annotated), **D-8** `APERTURE_EXPORT_U_VALUE_REPORT` capability, **D-9**
consolidate IP conversion constants. D-1..D-3, D-5 stand as
recommended-accepted (presented for veto; none raised). PRD and PLAN
updated to match.

## Next step

Implement `phases/phase-06-docs-pass.md`, run the final closeout gate, and
archive the completed feature packet.

## Blockers

- None.

## Verification ledger

- 2026-07-29 — Example artifact decoded programmatically (openpyxl) from
  `_260701 Window Unit Detailed U-Values.xlsx`; formulas quoted in
  `research.md` §2 were read from the file, not inferred.
- 2026-07-29 — Pre-refactor parity snapshot: `uv run pytest
  tests/test_aperture_u_value_parity.py -q` → `7 passed`.
- 2026-07-29 — Post-refactor focused backend suite: parity + existing
  service + MCP tests → `34 passed`.
- 2026-07-29 — Phase 01 `make check-backend` passed: Ruff, backend
  boundaries, Ty, Alembic, `1726 passed, 7 skipped`.
- 2026-07-29 — Phase 01 `make ci` passed: backend results above; frontend
  `253` files / `2346` tests, structural guards, and production build.
- 2026-07-29 — Phase 02 focused report/parity/service/MCP suite: `41 passed`;
  Ty passed for all touched backend slices; MCP schema/source regression:
  `1 passed`.
- 2026-07-29 — Phase 02 `make check-backend` passed: Ruff, backend
  boundaries, Ty, Alembic, `1733 passed, 7 skipped`.
- 2026-07-29 — Registered `phn-local` stdio smoke returned the report
  provenance from the `AGENT-BROWSER` fixture with `source=draft`.
- 2026-07-29 — Phase 02 `make ci` passed: backend results above; frontend
  `253` files / `2346` tests, structural guards, and production build.
- 2026-07-29 — `graphify update .` rebuilt the code graph successfully.
- 2026-07-29 — Phase 03 exporter/access/auth/envelope focused backend suite:
  `93 passed`; focused frontend unit suite: `27 passed`.
- 2026-07-29 — Phase 03 simplify review fixed formula injection, hidden
  valid inputs on unfinished rows, duplicated contracts/helpers, and
  O(N²) repeated rollup formulas. Exporter regression suite: `8 passed`.
- 2026-07-29 — Phase 03 `make check-backend` and `make ci` passed:
  `1741 passed, 7 skipped`; frontend `253` files / `2346` tests,
  structural guards, and production build. `graphify update .` passed.
- 2026-07-29 — Recalculation artifact generated at
  `working/aperture-u-value-report/synthetic-aperture-u-values-IP.xlsx`.
- 2026-07-30 — An isolated `xlwings` run opened a copy in Microsoft Excel
  and exposed U-w `0` / blank SHGC results hidden by blanket `IFERROR`.
  Regressions now pin text-tolerant rollups without blanket masking.
- 2026-07-30 — Final Excel recalc after the fix: `44` formulas, zero formula
  errors; Element U `0.17367986326355997`, Aperture U-w and Summary U-w
  `0.09472966786602`, SHGC `0.45000000000000007`, one unfinished element.
- 2026-07-30 — Final simplify pass also localized each aperture's rollup
  ranges (removing cross-aperture O(N²) scans) and consolidated HTTP header
  filename sanitization.
- 2026-07-30 — Phase 04 focused TypeScript/RTL suite: `3` files / `13`
  tests. `make frontend-dev-check` passed with existing warnings only.
- 2026-07-30 — Live editor draft verification exercised SI/IP units and all
  four expanded edge rows; the report footer matched the builder chip at
  `0.78 W/m²K`. Empty state was verified live; viewer source selection and
  unfinished rendering were verified in RTL.
- 2026-07-30 — Phase 04 `make ci` passed: backend `1741 passed, 7 skipped`;
  frontend `254` files / `2351` tests, structural guards, and production
  build. `graphify update .` passed.
- 2026-07-30 — Phase 05 focused exporter route suite: `8 passed`; focused
  TypeScript/RTL suite: `4` files / `24` tests. `make frontend-dev-check`
  passed with existing warnings only.
- 2026-07-30 — Live browser verification exercised the dirty-draft consent
  path and downloaded BOM/CRLF CSV plus a valid two-sheet XLSX in IP units.
  The saved version was empty while the draft held the representative
  aperture, directly confirming that downloads exclude unsaved changes.
- 2026-07-30 — The Phase 05 simplify pass centralized capability and
  download-header contracts, aligned unfinished warnings with the saved report,
  gated pending guard queries, exposed `Content-Disposition` through CORS, and
  added request cancellation on unmount.
- 2026-07-30 — Phase 05 `make ci` passed: backend `1741 passed, 7 skipped`;
  frontend `256` files / `2365` tests, structural guards, and production build.
