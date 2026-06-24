---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Active — Phase 1 implemented (backend export core); Phases 2–4 pending
AUTHOR: Ed (via Claude)
SCOPE: State tracker for the PHPP U-Value export feature.
RELATED: README.md, PRD.md, decisions.md, research.md, phases/
---

# STATUS — PHPP U-Value Export

## Current state

**Phase 1 done (2026-06-24).** `backend/features/envelope/phpp_export.py` is
implemented and tested: segment→section mapping, eligibility (≤8 rows, ≤3
consistent pathways, complete materials), full-block SI CSV render, error CSVs,
filename sanitize/dedupe, in-memory ZIP, and `phpp_preflight`. The IP inch
annotation logic is wired (the route + IP golden test land in Phase 2).
`backend/tests/envelope/test_phpp_export.py` has 11 golden/logic tests green;
`make typecheck` clean. No HTTP routes or frontend yet.

Design context unchanged: codebase researched (`research.md`), Q1–Q4 resolved
(`decisions.md`), open details Q-A…Q-G still carry working defaults to lock
against a real PHPP paste in Phase 4.

## Next step

Start **Phase 2** (`phases/phase-02-backend-routes-units.md`): the preflight +
zip routes, `zip_download_response` helper, and the IP golden-CSV test variant.

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
| 1 — Backend export core | Done (2026-06-24) |
| 2 — Backend routes + units | Planned |
| 3 — Frontend wiring | Planned |
| 4 — Verify + docs + closeout | Planned |
