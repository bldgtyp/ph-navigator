---
DATE: 2026-06-24
TIME: 08:00 EDT
STATUS: Complete (archived) — Phases 1–4 done. Soft cells Q-A/Q-B/Q-C accepted on working defaults (Ed, 2026-06-24); real-PHPP paste alignment + Playwright walkthrough waived
AUTHOR: Ed (via Claude)
SCOPE: State tracker for the PHPP U-Value export feature.
RELATED: README.md, PRD.md, decisions.md, research.md, phases/
---

# STATUS — PHPP U-Value Export

## Current state

**Backend + frontend complete (Phases 1–3, 2026-06-24).** The feature works
end-to-end against the local stack; only Phase 4 verification remains.

Backend:
- `backend/features/envelope/phpp_export.py` — segment→section mapping,
  eligibility (≤8 rows, ≤3 consistent pathways, complete materials), full-block
  SI/IP CSV render, error CSVs, filename sanitize/dedupe, in-memory ZIP.
- `phpp_types.py` (leaf: `UnitSystem`/`ExportReason`), `zip_download_response`
  in `shared/responses.py`, `get_phpp_export_preflight` in `service.py`.
- Routes: `GET …/envelope/export/phpp/preflight` (eligibility JSON) and
  `GET …/envelope/export/phpp?units=IP|SI` (streamed ZIP), both `ProjectViewAccess`.

Frontend:
- `api.ts` (`fetchPhppPreflight`, `downloadEnvelopePhpp`), `hooks.ts` mutations,
  and a `useEnvelopePhppExport` controller hook (start→preflight→modal-or-download).
- `EnvelopePage.tsx` "Download in PHPP format" menu item + the
  `PhppExportWarningDialog` confirm/cancel modal; shared `confirmDraftExport`
  draft warning.

Tests: backend `test_phpp_export.py` + `test_envelope_phpp_routes.py`; frontend
`usePhppExport.test.tsx`, `PhppExportWarningDialog.test.tsx`, and EnvelopePage
menu/modal tests — all green. `make ci-backend` + `vitest` pass.

Design context unchanged: Q1–Q4 resolved (`decisions.md`); open details
Q-A…Q-G still carry working defaults to lock against a real PHPP paste in Phase 4.

## Next step

None — feature complete and archived. The two remaining human-in-the-loop
Phase 4 items (real-PHPP copy/paste alignment of the soft cells Q-A/Q-B/Q-C, and
the Playwright E2E walkthrough) were **waived by Ed on 2026-06-24**: the
working-default CSV column layout, IP annotation scope, and percentage precision
are accepted as shipped. If a future real-PHPP paste shows misalignment, revisit
Q-A/Q-B/Q-C in `decisions.md` and the golden CSVs.

## Blockers

None.

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
| 3 — Frontend wiring | Done (2026-06-24) |
| 4 — Verify + docs + closeout | Done (2026-06-24) — autonomous parts complete; real-PHPP paste + Playwright waived by Ed |
