---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned — Ed-triggered production phase
AUTHOR: Codex with Ed May
SCOPE: Deploy Canonical B and verify it without crossing the persistent v8
  write boundary.
RELATED:
  - ./phase-04-production-preflight.md
  - ../../../../context/PRODUCTION_DEPLOYMENT.md
---

# Phase 05 — Canonical deploy and no-write smoke

## Goal

Bring both production services to the audited candidate SHA and prove safe reads
before normal editing resumes.

## Authority

Only Ed triggers `.github/workflows/deploy.yml`. Agents may monitor and execute
approved read-only checks; they do not deploy or mutate production implicitly.

## Ordered steps

1. Reconfirm Phase 04 GO, write freeze, backup timestamp, candidate/main tip SHA,
   and no corpus drift.
2. Ed triggers Deploy Production from the approved tip of `main`.
3. Monitor required CI and both Render deploys. Poll the API version endpoint
   and the cache-safe frontend build marker added in Phase 01 until both report
   the candidate SHA.
4. Run public readiness/version checks from `PRODUCTION_DEPLOYMENT.md`.
5. Confirm both frontend and API serve the candidate before authenticated app
   navigation.
6. Use saved-document endpoints for project smoke. Use a Viewer/read-only UI
   route only after its network trace proves it does not call the draft-summary
   endpoint. Do not mount the normal editor ProjectShell while writes are
   frozen: its draft-summary request can rewrite a stale draft before the UI
   reveals it.
7. Inspect saved/read-only surfaces for Production Project 1, then Project 2:
   - project opens without read-safe recovery;
   - Materials/Glazings/Frames show Needed;
   - Documentation and Status counts load;
   - Equipment/TB status labels remain correct;
   - raw JSON download returns the historical stored semantic value.
8. Recheck the DB inventory after smoke. Any draft row or metadata/hash change
   means the no-write guarantee failed; stop and update rollback mode.
9. Record whether any v8 row was persisted. Expected result for this phase is
   none.

## Rollback gate

App-only rollback to the previous SHA is permitted only if no v8 draft/version
has been persisted **and** Phase 04 proved that SHA compatible with the
candidate Alembic head, relational schema, and production config. Otherwise,
switch to the roll-forward runbook or restore/repair the DB/config under
explicit authorization. Render startup migrations do not roll back when code
does.

## Exit gate

- API and web both report/serve the audited candidate.
- Public checks pass.
- Both projects pass authenticated read-only smoke.
- No v8 persistent write occurred, or any unexpected write is fully understood
  and the rollback mode is updated.

## Stop conditions

- API/web SHAs differ from the candidate after deploy completion.
- Either project enters read-safe recovery.
- Status values/counts diverge from the preflight preview.
- A stale draft rewrites unexpectedly.
- Anyone resumes editing before Phase 06 GO.
