---
DATE: 2026-07-29
UPDATED: 2026-07-29 — Phase 02 complete and verified; Phase 03 next
TIME: 21:52 EDT
STATUS: Active — Phases 01–02 complete; Phase 03 exporters next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, and verification ledger for the Aperture
  U-Value Detail Report feature.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./PLAN.md
---

# STATUS — Aperture U-Value Detail Report

## Current state (2026-07-29)

Phases 01–02 are implemented and verified on
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

## Decisions — resolved 2026-07-29

Ed accepted: **D-4** export saved version, **D-6** glazing-area-weighted
SHGC, **D-7** option (a) rollup mirrors the chip (include-as-zero, loudly
annotated), **D-8** `APERTURE_EXPORT_U_VALUE_REPORT` capability, **D-9**
consolidate IP conversion constants. D-1..D-3, D-5 stand as
recommended-accepted (presented for veto; none raised). PRD and PLAN
updated to match.

## Next step

Commit Phase 02, then implement `phases/phase-03-exporters.md`.

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
