---
DATE: 2026-07-19
TIME: 14:30 EDT
STATUS: Accepted planning decisions
AUTHOR: Codex with Ed May
SCOPE: Architecture, compatibility, and rollout decisions for the status rename.
RELATED:
  - ./PRD.md
  - ./research.md
  - ./PLAN.md
---

# Decisions

## D1 — Canonical semantic set

PH-Navigator's canonical specification-status semantics are
`complete | needed | question | na`, displayed Complete / Needed / Question /
N/A.

## D2 — Preserve the two storage families

Materials/Glazings/Frames use typed literals. Equipment/Thermal Bridges use
stable DataTable option ids. Do not migrate `opt_status_needed` to a literal;
summary adapters own the semantic projection.

## D3 — Use schema v8 forward upgrade

Implement `_upgrade_v7_to_v8` in the existing dict-to-dict upgrade chain. Do
not use a Pydantic before-validator as the primary migration and do not add an
Alembic JSONB rewrite.

## D4 — Historical saved versions remain immutable

Saved v7 rows remain raw v7. Typed reads upgrade them in memory. Existing
drafts may rewrite through the established draft path; Save/Save As persists
current schema. A physical rewrite of historical production rows would require
a separate maintenance packet and explicit authorization.

## D5 — Use expand/contract releases

Compatibility Release A makes schema-v7 API/frontend boundaries understand
both values while continuing to store/send `missing`. Canonical Release B
changes storage/domain/writes to v8 `needed`. Cleanup Release C removes only
temporary PH-Navigator-client adapters after the observation window.

## D6 — External Honeybee status remains `MISSING`

Installed `honeybee_ref` accepts `COMPLETE | MISSING | QUESTION | NA`. Use a
named adapter: internal `needed` → external `MISSING`; imported external
`MISSING`/`missing` → internal `needed`. This is permanent format compatibility,
not an internal alias.

## D7 — Preserve Documentation `unknown`

`unknown` remains a response-only sentinel. UI presentation and editor writes
resolve it to Needed. It is not persisted as a specification status.

## D8 — Scope the UI rename

Status controls/counts/filters/data attributes use `needed`. Generic meanings
of missing—absent evidence, missing climate data, catalog-row absence,
validation errors—remain. Add `--report-status-needed: #d97706`; move
status-semantic consumers to it; retain
`--report-status-missing: var(--report-status-needed)` for Climate and other
non-status consumers during this refactor. Leave Documentation write-error and
zero-meter uses unchanged unless a separate review reclassifies them. Do not
combine CSS architecture cleanup with the schema rollout.

## D9 — Production rollout has a write cliff

Before any v8 persistence, app-only rollback is available only if the previous
SHA is also proven compatible with the candidate's Alembic head, relational DB
shape, and production config. After any v8 draft/version is persisted, old v7
code rejects schema-too-new bodies; default recovery is roll-forward. Record
the first v8 persistent write.

## D10 — “Update both projects” does not mean bulk rewrite

Both production projects must have every saved version and draft audited by
candidate v8 code and must pass deployed read checks. Their active work moves
to persisted v8 through the next legitimate draft/Save/Save As. Do not create
meaningless edits or rewrite historical rows solely to stamp schema v8.
