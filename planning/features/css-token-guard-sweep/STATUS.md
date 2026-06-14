---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Deferred
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: current state + next step
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — Token sweep + guard extension + scale pass

**State:** Deferred. Written up 2026-06-14 while implementing P3
(`css-structure-discoverability`); **not started.** No code written.

**Why deferred:** P3 was a deliberately visually-neutral structural sweep.
This work is the opposite — it changes pixels (new color tokens, snapped
shadows, tightened scales) and needs per-literal browser verification plus
Ed's design eye. Folding it into P3 would have made P3 un-reviewable as
"neutral." Carved out so P3 could ship clean.

**Blockers:** none technical. Wants Ed's design review for §1 (scrim/shadow
values) and §3 (scale tightening).

**Suggested next step:** start with PRD §1 (tokenize the ~24 color literals,
browser-verify each), because §2's guard flip only goes green once §1 clears
the CSS literals. Do §2 (`.ts` + rgb/hsl guard) second, §3 (scales) last with
Ed.

**Verification baseline:** `make format` + `make ci` from the repo root;
browser-verify every non-neutral surface with the codex agent account (see
`context/ENVIRONMENT.md`).
