---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Active — Phases 1–2 implemented (backend complete); Phases 3–4 pending
AUTHOR: Ed (via Claude)
SCOPE: State tracker for the PHPP U-Value export feature.
RELATED: README.md, PRD.md, decisions.md, research.md, phases/
---

# STATUS — PHPP U-Value Export

## Current state

**Backend complete (Phases 1–2, 2026-06-24).** The whole server side is
implemented and tested:

- `backend/features/envelope/phpp_export.py` — segment→section mapping,
  eligibility (≤8 rows, ≤3 consistent pathways, complete materials), full-block
  SI/IP CSV render, error CSVs, filename sanitize/dedupe, in-memory ZIP.
- `phpp_types.py` (leaf: `UnitSystem`/`ExportReason`), `zip_download_response`
  in `shared/responses.py`, `get_phpp_export_preflight` in `service.py`.
- Routes: `GET …/envelope/export/phpp/preflight` (eligibility JSON) and
  `GET …/envelope/export/phpp?units=IP|SI` (streamed ZIP), both `ProjectViewAccess`.

Tests: `test_phpp_export.py` (pure logic + SI/IP goldens) and
`test_envelope_phpp_routes.py` (route-level) green; `make ci-backend` passes.
**No frontend yet.**

Design context unchanged: codebase researched (`research.md`), Q1–Q4 resolved
(`decisions.md`), open details Q-A…Q-G still carry working defaults to lock
against a real PHPP paste in Phase 4.

## Next step

Start **Phase 3** (`phases/phase-03-frontend-wiring.md`): the `api.ts` calls,
export + preflight hooks, the new menu item, draft-version warning, and the
confirm/cancel error modal.

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
| 2 — Backend routes + units | Done (2026-06-24) |
| 3 — Frontend wiring | Planned |
| 4 — Verify + docs + closeout | Planned |
