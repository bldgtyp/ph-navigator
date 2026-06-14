---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Deferred
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P3 current state + next step
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — CSS Structure & Discoverability (P3)

**State:** Deferred. Written up as backlog on 2026-06-14; **not started.**
Pulled out of the now-archived `css-rationalization` effort so it is not
lost. No code has been written for P3.

**Why deferred:** P0–P2 (the visible drift + correctness work) shipped and
were the priority. P3 is structure/discoverability polish — valuable for
the *next* wave of feature authors but not blocking anything today.

**Blockers:** none. Ready to pick up whenever scheduled.

**Suggested next step:** start with the zero-risk, highest-leverage piece —
write `frontend/src/styles/README.md` (token + shared-class catalog + "how
to style a new feature" recipe) and add `frontend/src/shared/ui/index.ts`.
Those alone close most of owner goal #3. See `PRD.md` §1 and the suggested
sequencing.

**Verification baseline:** standard repo gate — `make format` + `make ci`
from the repo root; browser-verify any visually non-neutral change with the
codex agent account (see `../.instructions.md` / `context/ENVIRONMENT.md`).
