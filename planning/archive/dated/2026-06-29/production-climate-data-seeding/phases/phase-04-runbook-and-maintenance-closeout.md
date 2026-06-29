---
DATE: 2026-06-29
TIME: 17:55 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Close out production climate-data seeding with durable evidence and rerun guidance.
RELATED:
  - ../README.md
  - ../STATUS.md
  - ../decisions.md
  - context/PRODUCTION_DEPLOYMENT.md
  - context/ENVIRONMENT.md
---

# Phase 04 - Runbook And Maintenance Closeout

## Goal

Convert the production seed run from a one-off operation into durable project
knowledge: what was run, what counts landed, how to verify it, and how to rerun
it safely.

## Outcome

Complete on 2026-06-29.

- Final production evidence is recorded in `../STATUS.md`.
- R2 object keys, processing counts, Render one-off job id, SQL counts, and
  manual production smoke outcome are preserved in the packet.
- Stable rerun guidance already exists in `context/PRODUCTION_DEPLOYMENT.md`
  and `context/ENVIRONMENT.md`; no durable context patch was required.
- No production Climate blocker remains.
- No production secrets or licensed source data were committed.

## Preconditions

- P03 success gate passed.
- Operator has command output, SQL counts, and live smoke notes.

## Updates

1. Update `../STATUS.md`:
   - Seed date/time.
   - Operator.
   - Commands run.
   - R2 object keys.
   - DB counts by provider/version.
   - Project used for live smoke.
   - PHIUS, PHI, and Hourly smoke result.
   - Any cleanup performed.

2. Review `context/PRODUCTION_DEPLOYMENT.md` and `context/ENVIRONMENT.md`.
   - If current runbook was sufficient, note "no durable context update
     required" in `STATUS.md`.
   - If execution discovered missing details, patch the relevant context doc.

3. Record rerun policy:
   - New provider/version bundle: publish bundle, then run `--all --no-replace`.
   - Intentional same-version replacement: publish corrected bundle, run plain
     `--all` or provider-specific seed, then smoke affected project sources.
   - No-op audit: run SQL counts and optionally `--all --no-replace`.

4. Record future source checklist:
   - PHIUS source version/date.
   - PHI/PHPP workbook version.
   - Expected record counts.
   - Who approved publishing to production.

## Success gate

This feature can be marked `Complete` when:

- `STATUS.md` contains the final production evidence.
- Durable context docs are updated or explicitly deemed current.
- There is no unresolved production Climate blocker.
- Any temporary DB inbound IP rule or local exported secret is removed/unset.

## Cleanup checklist

- Unset local `R2_*` and `DATABASE_URL` exports.
- Remove any temporary Render DB inbound IP rule.
- Do not leave production secrets in shell history, screenshots, notes, or
  planning docs.
- Keep licensed source files untracked.
- Confirm `git status --short` shows only intentional planning/doc changes.
