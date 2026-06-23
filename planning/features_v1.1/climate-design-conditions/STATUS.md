---
DATE: 2026-06-14
TIME: -
STATUS: Deferred (gated, narrowed 2026-06-21) — the data PRODUCTION + tab
  DISPLAY are now built under climate-auto-populate (P3/P4); only the
  consumer-facing CONTRACT remains, still gated on fRSI/comfort + D-CL-5.
AUTHOR: Claude (for Ed)
SCOPE: Status + gate for the design-conditions contract.
RELATED:
  - README.md
  - PRD.md
---

# Design conditions + metrics — Status

## Current state

**Deferred (gated) — narrowed 2026-06-21 (D-CL-25).** The EPW-metrics
derivation, ASHRAE fetch, per-source design-condition caching, and the tab
display are now **built under `climate-auto-populate` (P3/P4)** — so the
production + display half of this feature is absorbed there (avoids a second
EPW parser). What **remains here**: the consumer-facing
**source-parameterized contract endpoint** (`GET …/design-conditions?source=`)
+ MCP that fRSI / window-comfort read. That stays deferred — still gated on a
scheduled consumer + D-CL-5 (don't build a contract with no reader). Once a
consumer is scheduled it's a thin exposure layer over the data P3 caches.

**Update 2026-06-22 (`climate-weather-file` P1):** the cached design-condition
*shape* is now complete and lives on the single `weather` source (the old
`epw`/`ashrae` source kinds merged). The cooling 0.4%/2% DB+MCWB percentiles now
parse from the `.stat`, so the contract's canonical field set is settled. This
advances the production layer but does **not** change the gate below — there is
still no scheduled fRSI/comfort consumer.

## Gate / depends on

- A **scheduled consumer** (Thermal-Bridges fRSI or Window thermal-comfort) —
  don't build a contract with no reader.
- **D-CL-5** (fRSI interior-boundary assumption) resolved — likely owned by
  the fRSI consumer.
- Phase 2 datasets merged (met).

## Next step

Hold until an fRSI or window-comfort feature is scheduled. When one is, scope
the contract jointly with that consumer (the D-CL-5 split) — building it as a
thin read-layer over the per-source design conditions `climate-auto-populate`
P3 already caches. See PRD §Scope (its production/display items are now built
under `climate-auto-populate`, not here).

## Blockers

- **Gated by design** on the named consumer + D-CL-5. This is intentional
  sequencing, not an unexpected blocker.
