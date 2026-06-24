---
DATE: 2026-06-14
TIME: -
STATUS: Deferred (gated) — needs a scheduled fRSI/comfort consumer + the
  D-CL-5 interior assumption. Builds on the complete Climate dataset store.
AUTHOR: Claude (for Ed)
SCOPE: Router for the per-source climate design-conditions contract — the
  source-parameterized exterior-conditions API that downstream fRSI /
  window-comfort analyses read.
RELATED:
  - PRD.md
  - STATUS.md
  - planning/archive/dated/2026-06-14/climate/ (the complete Climate feature this extends)
  - planning/archive/dated/2026-06-14/climate/phases/phase-04-design-conditions-and-metrics.md
    (the original handoff this folder supersedes)
  - planning/archive/dated/2026-06-14/climate/decisions.md (D-CL-4/5/6/7/8/11)
---

# Climate — Design conditions + metrics

> **Narrowed 2026-06-21 (D-CL-25).** The data *production* (EPW/`.stat` +
> ASHRAE) and *tab display* are now built under
> `planning/archive/dated/2026-06-22/climate-auto-populate/` (P3/P4). Only the consumer-facing
> **contract endpoint** remains here, still gated on a scheduled fRSI/comfort
> consumer + D-CL-5. See `STATUS.md`.

Expose **per-source** design conditions — the PH datasets' design columns
(already in the standardized record), EPW-derived percentiles, and ASHRAE
fetched values — as a small, **source-parameterized** contract that
downstream analyses read. This is the "use the data" layer on top of the
Climate data store (Phases 1–3, complete).

This was tracked as Climate **Phase 4** while Climate was active; it was
pulled out into its own deferred feature when Climate Phases 1–3 completed
and the feature was archived (2026-06-14).

## Why gated

Don't build a contract with no reader. This feature is gated on:

1. A **scheduled consumer** — Thermal-Bridges fRSI or Window thermal-comfort.
2. **D-CL-5** (the fRSI interior-boundary assumption) resolved — likely owned
   by the fRSI consumer, not Climate.
3. Phase 2 datasets merged (met — the PH datasets already carry the design
   columns this phase exposes).

## Read order

1. `PRD.md` — the contract shape, what's in vs. out, reproducibility.
2. `STATUS.md` — the gate and the named dependencies.

## Scope headline

A `GET /projects/{id}/climate/design-conditions?source=<…>` endpoint (+ MCP)
returning a small, explicit, versioned SI shape whose `basis` field names the
dataset + version so a reviewer can audit which source produced each value.
The **consumers** (fRSI, comfort) are separate features that *read* this —
Climate provides the conditions; it does not compute fRSI or comfort.
