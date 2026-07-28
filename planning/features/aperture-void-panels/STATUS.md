---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Active — planning drafted; no implementation started
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, blockers, verification for aperture void panels.
RELATED: ./README.md, ./PRD.md, ./phases/
---

# STATUS — aperture void panels

## Current state

- 2026-07-28 — Feature packet drafted (PRD, decisions, phases 1–5) from a
  verified review of the aperture schema, command handlers, U-value service,
  both exports, the GH v1 client/schema, and the frontend builder surface.
  Trigger project: storefront unit S15 (doors extend below sidelite sills).
- Solid spandrel panels: deferred (decisions.md D-2, PRD §7); `kind` enum
  reserves the slot.
- No code changes yet. No branch yet.

## Next step

1. Ed reviews `PRD.md` and confirms open decisions D-1 / D-3 / D-4 (§9) and
   the D-2 deferral.
2. Start Phase 1 (`phases/phase-01-schema.md`) on a feature branch
   (`feature/aperture-void-panels`).

## Blockers

- None hard. D-1/D-3/D-4 have stated defaults; only a reversal of D-2
  (folding solid panels in now) would require re-planning.

## Verification ledger

| Phase | Gate | Result |
| --- | --- | --- |
| 1–5 | `make ci` per phase | — |
| 4 | agent-browser smoke (S15 layout build) | — |
| 5 | Route-3 → GH schema parse + Rhino visual check (Ed) | — |
