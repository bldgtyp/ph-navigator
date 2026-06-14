---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Deferred
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P4 current state + next step
RELATED:
  - ./README.md
  - ./PRD.md
---

# STATUS — CSS Brand-Dependency Resilience (P4)

**State:** Deferred. Both items **decided 2026-06-14**, written up as an
execution backlog; **not built.** Pulled out of the now-archived
`css-rationalization` effort so they are not lost. No code written.

**Decisions (settled, not open):**
- Vendor + self-host the brand `tokens.css` and the Geist fonts (with a
  sync script).
- Update `UI_UX.md` §design-system + PRD §12 to the bespoke-CSS reality; no
  Tailwind/shadcn migration.

**Blockers:** none. Ready when scheduled.

**Suggested next step:** ship Item 2 first — it's a small docs-only change
(`context/UI_UX.md` §design-system + PRD §12) with no runtime risk and it
stops the shadcn ghost-token vocabulary from reappearing. Then take Item 1
(vendor tokens + self-host fonts) as a focused change to `index.html` + a
sync script.

**Verification baseline:** `make format` + `make ci` from the repo root.
For Item 1, confirm the app renders with correct brand colors + fonts
**offline** (block network / kill the brand site) and that `check-css-vars`
sources its brand allowlist from the vendored file.
