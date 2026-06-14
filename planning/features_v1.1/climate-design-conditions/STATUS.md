---
DATE: 2026-06-14
TIME: -
STATUS: Deferred (gated) — blocked on a scheduled fRSI/comfort consumer +
  D-CL-5. Lags well behind the Climate data store (Phases 1–3, complete).
AUTHOR: Claude (for Ed)
SCOPE: Status + gate for the design-conditions contract.
RELATED:
  - README.md
  - PRD.md
---

# Design conditions + metrics — Status

## Current state

**Deferred (gated).** Pulled out of the (now archived, complete) Climate
feature as its own v1.1 candidate on 2026-06-14. No code written. The PH
datasets already carry the design columns this would expose; the contract
itself, the EPW-metrics derivation, and the tab views are unbuilt.

## Gate / depends on

- A **scheduled consumer** (Thermal-Bridges fRSI or Window thermal-comfort) —
  don't build a contract with no reader.
- **D-CL-5** (fRSI interior-boundary assumption) resolved — likely owned by
  the fRSI consumer.
- Phase 2 datasets merged (met).

## Next step

Hold until an fRSI or window-comfort feature is scheduled. When one is, scope
this contract jointly with that consumer so the exterior/interior split
(D-CL-5) is settled before building. See PRD §Scope.

## Blockers

- **Gated by design** on the named consumer + D-CL-5. This is intentional
  sequencing, not an unexpected blocker.
