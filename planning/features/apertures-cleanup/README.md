---
DATE: 2026-06-05
TIME: 21:45 EDT
STATUS: Active — backlog only
AUTHOR: Claude
SCOPE: Followup cleanup items deferred during the 13-phase Apertures
       build-out (`planning/archive/apertures/`). One folder per
       follow-up item or one consolidated phase plan, depending on
       what ships next.
RELATED:
  - planning/archive/apertures/STATUS.md (final state of the
    13-phase build)
  - planning/archive/apertures/PRD.md (canonical product contract)
---

# Apertures — Cleanup follow-ups

The 13-phase Apertures feature shipped behind a tracer-bullet
coexistence pattern — V2 `Aperture*` types and the `tables.apertures[]`
slice live **side-by-side** with the legacy `Window*` / `tables.window_types[]`
surface. The TB-09 Windows tab is still mounted; nothing has been
deleted. This folder collects every item that was knowingly deferred
during the 13 phases so a future cleanup phase has one place to start
from.

See `PRD.md` for the consolidated item list. `STATUS.md` tracks which
items have shipped.

## Read order

1. `PRD.md` — the consolidated backlog.
2. `STATUS.md` — what's done, what's next.
3. The archived feature docs at `planning/archive/apertures/` for
   per-phase context.
