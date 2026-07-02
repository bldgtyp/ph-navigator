---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Align existing sample/current documents with the new Rooms airflow fields.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
---

# Phase 02 - Existing Document Compatibility

## Goal

Make existing sample/current Rooms tables expose the two built-ins without
damaging saved-version immutability, draft ETags, or audit semantics.

## Strategy Options

Choose one after Phase 00:

- **Seed-only:** acceptable only if all relevant current data can be reset or
  reseeded before users depend on it.
- **Read overlay:** add missing built-in FieldDefs to Rooms responses/extractors
  without rewriting saved versions. Lowest write risk, but needs careful
  fingerprint/diff behavior.
- **Schema bump/read-time upgrade:** transform stale bodies into the new shape on
  read. Saved versions remain immutable unless saved again; drafts can be
  rewritten through the existing upgraded-draft path.
- **Explicit backfill:** one-time production data rewrite. Highest operational
  burden; use only if read overlay/schema upgrade is insufficient.

## Tasks

- Inspect `backend/seeds/project/rooms.json`; seed rows can omit the new
  `custom_values` keys because missing/null should render blank.
- If seed JSON is used to materialize persisted docs, confirm the seed builder
  combines current `ROOMS_BUILT_IN_FIELD_DEFS` with `rooms.json` rows.
- Implement the chosen stale-document alignment.
- Preserve custom fields and custom field order in existing `rooms.field_defs`.
- Do not change existing Space-Type linked-record data or option lists.
- Ensure `dirty_tables(...)` does not mark a draft dirty solely because a read
  overlay added virtual field defs. If using schema upgrade instead, document the
  expected draft rewrite/ETag behavior.

## Verification

- Backend test with a stale Rooms envelope missing the airflow FieldDefs.
- Backend test with an existing row where both new keys are absent; GET returns
  fields and row display path remains blank.
- Backend test with explicit `null` in `custom_values` round-tripping unchanged.
- If a migration/backfill is chosen, add an idempotence test.
