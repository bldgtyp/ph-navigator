---
DATE: 2026-06-13
TIME: -
STATUS: Deferred — gated. Do not start until Phase 1 is merged AND a
  concrete time/season review need is named (Q-VIEW-6).
AUTHOR: Claude (for Ed)
SCOPE: Contract sketch for the sun-path time/season scrubber.
RELATED:
  - ../PRD.md
  - phase-01-static-sun-path.md
  - context/user-stories/40-model-viewer.md (Q-VIEW-6)
---

# Phase 2 — Sun-path scrubber (deferred)

## Gate

Two conditions, both required:

1. Phase 1 (static annual sun path) is merged and verified.
2. There is a **named** review workflow that needs time-of-day /
   season interaction — not "would be neat." Q-VIEW-6 deferred this
   precisely because the annual envelope is sufficient for design
   reviews and a scrubber adds UI surface without a clear payoff.

Until both hold, this phase is intentionally unwritten in detail.

## Scope sketch (when promoted)

- A time control (month + hour, or a continuous day-of-year + time
  slider) that highlights / isolates the sun position(s) for the
  selected moment against the static annual envelope.
- The envelope stays as faint context; the active analemma point or
  day-arc is emphasized.
- No backend change expected if Phase 1 ships the full annual geometry
  — the scrubber is a frontend selection over already-loaded data.
  Confirm at promotion time (a per-instant sun *vector* may want a
  small backend helper, or can be computed client-side from the
  analemma points).

## Non-goals

- Animated playback, shadow-casting studies, or radiation analysis —
  out of scope; those are WUFI/PHPP-domain, not viewer-domain.
- Any coupling to EPW hourly data (the diagram is location-only per
  D-07).

## Why this is a separate phase, not a Phase-1 stretch

The scrubber is the one piece of sun-path behavior with a genuine "is
this worth the UI?" question attached. Keeping it a gated unit avoids
shipping interaction nobody asked for, and keeps Phase 1 a clean,
mechanical wiring job.
