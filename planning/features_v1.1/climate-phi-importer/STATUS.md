---
DATE: 2026-06-14
TIME: -
STATUS: Deferred — independent of any other deferred work; can be picked up
  whenever a second reference provider is wanted.
AUTHOR: Claude (for Ed)
SCOPE: Status + gate for the PHI/PHPP importer.
RELATED:
  - README.md
  - PRD.md
---

# PHI/PHPP reference importer — Status

## Current state

**Deferred.** Pulled out of the (now archived, complete) Climate feature as
its own v1.1 candidate on 2026-06-14. No code written. The provider-agnostic
storage / read endpoints / MCP / seed CLI from Climate Phase 2 are live and
waiting; only `importers/phi.py` + its column-map validation are missing.

## Gate / depends on

- **Independent.** The seed seam (`seed_dataset(...)` + `--provider` CLI) is
  ready. No decision blocks it; it is purely a scheduling call.
- The real workbook is on disk (gitignored) at
  `planning/archive/climate/example_data/phi_phpp_10_6_climate_data/phi_phpp_10_6_climate_data.xlsx`.

## Next step

When promoted: `uv add openpyxl`, then the column-map recovery session
(anchor the library columns to the active-climate display block; validate on
≥3 spot-checked datasets) before writing the parser. See PRD §Scope.

## Blockers

- None. Deferred by priority, not by a blocker. The only risk is correctness
  of the ~130-column map — mitigated by the anchor-and-validate approach.
