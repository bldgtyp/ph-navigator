---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Active — research/design complete, implementation not started
AUTHOR: Ed (via Claude)
SCOPE: State tracker for the PHPP U-Value export feature.
RELATED: README.md, PRD.md, decisions.md, research.md, phases/
---

# STATUS — PHPP U-Value Export

## Current state

Design complete. Codebase fully researched (`research.md`), the four pivotal
design questions resolved by Ed (`decisions.md` Q1–Q4), and the work broken
into four phases. **No code written yet.**

## Next step

Confirm the open details in `decisions.md` (**Q-A…Q-G** — all have working
defaults, so Phase 1 can begin even if some are deferred to the Phase-4 PHPP
paste check), then start **Phase 1** (`phases/phase-01-backend-export-core.md`):
the pure `phpp_export.py` module + golden CSV tests.

## Blockers

None hard. Soft: the exact CSV cell columns (Q-A) and IP annotation scope (Q-B)
won't be fully locked until a real PHPP copy/paste test in Phase 4.

## Verification plan

- Phase 1–2: `uv run pytest` (golden CSVs + route tests).
- Phase 3: `make frontend-dev-check` + Vitest.
- Phase 4: Playwright walkthrough, real PHPP paste, full `make ci`, closeout
  skills (simplify, docs-pass), docs fold-back.

## Phase ledger

| Phase | Status |
| --- | --- |
| 1 — Backend export core | Planned |
| 2 — Backend routes + units | Planned |
| 3 — Frontend wiring | Planned |
| 4 — Verify + docs + closeout | Planned |
