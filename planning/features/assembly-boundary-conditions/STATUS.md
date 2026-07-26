---
DATE: 2026-07-26
TIME: 11:05 EDT
STATUS: Draft — not started
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers.
RELATED: ./README.md, ./PRD.md, ../assembly-condensation-risk/STATUS.md
---

# Status

## State

**PRD drafted. No code written.** Raised by Ed on 2026-07-26 while resolving
`assembly-condensation-risk` Q-5 (floors on grade), on the observation that the
interior/exterior model doesn't handle ground, ventilated, or surface films.
Investigation confirmed the gap is wider than the original question.

Verified against the codebase, not assumed:
- `thermal.py` adds no Rsi/Rse — the calculation is construction-only by
  construction, so the header's "Effective U-Value" is `1/R_construction`.
- `Assembly.type` is consumed only by `hbjson_export.py`, `hbjson_import.py`, and
  the sidebar icon — it drives no physics.
- No "adjacent to" axis exists; ground, ventilated, and unconditioned assemblies
  are indistinguishable from outdoor-air ones.
- The `air_*` categories are air **cavities** (180 of 408 seeded rows, 1 mm
  thickness increments with an equivalent λ), not surface films.
- ISO 6946 resistance values recovered from the PHI workbook's `Data` sheet;
  ASHRAE equivalents still need extraction and private-DB routing.

Reviewed with Ed 2026-07-26, after reading the honeybee-energy source:
- Confirmed honeybee `OpaqueConstruction` carries no type/direction; films are
  ISO 10292 (glazing), reporting-only; E+ computes its own at runtime.
  PHN's assembly-level type is a deliberate and necessary divergence. (`PRD.md` §1a)
- **Q-B1 resolved: fold films into the thermal calculation.** Every displayed
  U-value moves.
- **Q-B3 resolved: four exterior options.** Initially cut to three on the
  grounds that ISO 6946 gives `unconditioned_space` the same `Rse = Rsi` as
  `ventilated`; **reversed the same day** — identical output today does not
  justify collapsing two different meanings, and the distinction cannot be
  recovered by migration once assemblies have been mislabelled. Ft math deferred
  to `assembly-condensation-risk`.
- **Q-B2 resolved: `other` → horizontal (Rsi 0.13)** — the mid-value and the
  least-wrong default when direction is unknown.
- **Q-B4 resolved: `air_*` cavity materials unchanged.**
- **Q-B5 resolved: the `#assembly-thermal-metric` tooltip is the announcement.**
- **Correction to an earlier claim in this folder:** the header metric does *not*
  overclaim today. `AssemblyHeader.tsx` labels it "Thermal" (not "Effective
  U-Value" — that string is from a stale ASCII mockup in
  `context/ui/pages/envelope-tab.md`) and its tooltip already states films are
  excluded. Phase 2 is therefore a change of convention, not a correctness fix.
- Two wrinkles found in that file: the metric **changes kind by unit system**
  (IP → R-value, SI → U-value), so both branches move and the tooltip title
  ("Effective Thermal Resistance") is IP-only; and the tooltip cites ASHRAE
  Ch. 27 where `thermal.py` cites Ch. 25 — reconcile in the same pass.
- **`thermal_standard` is an independent project setting, default ISO 6946.**
  The earlier "derive from `cert_programs`" idea is withdrawn — projects can be
  both PHI and Phius, or neither.
- Settings consolidated into one versioned `assumptions` block shared with
  `assembly-condensation-risk`.
- UI: the existing `exterior`/`interior` labels become the control.

## Next step

**Phase 1** — add `exterior_condition` (default `outdoor_air`, a faithful no-op
for every existing assembly) and `assumptions.thermal_standard` (default
`iso_6946`), plus the ISO 6946 resistance table and heat-flow direction derived
from `Assembly.type`. Backend only, no UI change, **no displayed number moves**.
This alone unblocks the condensation engine.

Phase 2 must not be bundled into it — that one changes numbers users have
reported and deserves its own diff, its own tests (including the PHPP
double-count regression), and its own release note.

## Dependencies

- **Blocks:** `assembly-condensation-risk` Phase 2 (the engine), alongside
  `assembly-membrane-layers` Phases 1–2.
- **Independent of** `assembly-membrane-layers` — the two can proceed in
  parallel; they touch different parts of the assembly model.

## Blockers

**None.** All design questions resolved 2026-07-26; only a deploy-time
communication detail is open.

| # | Question | Resolution |
| --- | --- | --- |
| ~~Q-B1~~ | Header U-value includes films? | ✅ yes |
| ~~Q-B2~~ | What does `type: "other"` resolve to? | ✅ horizontal, Rsi 0.13 — mid-value, least-wrong default; flagged visibly |
| ~~Q-B3~~ | `unconditioned_space` in the enum? | ✅ **yes, model it; defer Ft** — reverses the earlier same-day "no" |
| ~~Q-B4~~ | Do the `air_*` cavity materials change? | ✅ no — leave unchanged |
| ~~Q-B5~~ | How is the change communicated at Phase 2 deploy? | ✅ rewrite the `#assembly-thermal-metric` tooltip in `AssemblyHeader.tsx`; no in-app banner |

## Verification

Phase 1 gate: `(type, exterior_condition, standard)` resolves a deterministic
`(Rsi, Rse, heat_flow_direction)` triple for every combination, unit-tested
against the ISO 6946 table, **and no existing assembly's displayed thermal result
changes** (`PRD.md` §8, criteria 1–2).
