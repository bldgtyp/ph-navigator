---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Deferred
AUTHOR: Claude with Ed May
SCOPE: State ledger for the shared segmented-control extraction.
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Shared segmented control

## Current state

`Deferred`. Scoped 2026-08-03 while shipping the materials catalog-drift
rework, which added the fourth implementation (`.drift-choice`) and triggered
two independent "reuse before inventing" review findings.

No shared primitive exists yet. The four implementations in `PRD.md` were read
off the code at that date and are accurate.

## Next step

Resolve PRD Q1 (does `.pill-tab` belong?) and Q2 (does the sliding indicator
survive?). Both are 30-minute decisions that determine whether the primitive
has one variant or two. Then execute migration step 1 — build the primitive
and move `.drift-choice` onto it.

## Blockers

None.

## Sequencing note

`planning/refactor/aperture-catalog-drift-ux-parity/` will want a segmented
control for its refresh dialog. If both are scheduled, land this one first so
apertures consumes the primitive instead of copying `.drift-choice` and making
a fifth implementation.

## Verification recipe

Every migration step is a pure visual refactor, so the bar is "no unintended
pixel change":

1. Screenshot each affected control **before** touching it —
   `cd frontend && node scripts/agent-browser.mjs <route> --out /tmp/before-<n>.png`
   (see `context/USING_A_WEB_BROWSER.md`; `make agent-browser-ready` first).
2. Migrate one implementation.
3. Screenshot the same routes and diff by eye.
4. `make ci` — `check:typography` and `check:css-vars` catch off-system values
   the eye misses; `make typography-eval` covers the rendered sweep for the
   topbar toggle, which appears on every page.

## Log

- **2026-08-03** — Packet created. Four implementations inventoried; API,
  migration order, and three open questions recorded in `PRD.md`.
