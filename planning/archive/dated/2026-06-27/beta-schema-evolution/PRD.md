---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Complete - product/engineering contract implemented and archived.
AUTHOR: Codex with Ed May
SCOPE: Product and engineering requirements for beta-safe project document schema evolution.
RELATED:
  - ./README.md
  - ./decisions.md
  - ./PLAN.md
  - planning/code-reviews/2026-06-27/beta-schema-evolution-readiness.md
---

# PRD - Beta Schema Evolution

## Problem

PH-Navigator is close to MVP feature-complete. Once beta use starts on real
projects, project documents will become durable work product. During beta we
should expect to adjust object storage, field contracts, relationships, unit
fields, option lists, and table data structures.

Without a deliberate schema-evolution path, a normal beta change could make
older project documents fail validation and become uneditable. The app already
has read-safe recovery, but that only exposes raw JSON and diagnostics. It does
not let the team continue working normally after a data-shape change.

## Goal

Before real beta project data exists, add the minimum durable mechanism that
lets PH-Navigator:

- keep old saved project documents openable;
- audit all known project bodies before a schema bump ships;
- upgrade old bodies in memory without mutating immutable saved versions on
  read;
- preserve clear ETag/draft/save semantics;
- make built-in `FieldDef` drift visible before stale field contracts leak into
  beta work.

## Users

- BLDGTYP beta operators using PH-Navigator on real project work.
- Developers changing project document schemas during beta.
- Future agents resuming schema-change or migration tasks.

## Requirements

### Functional Requirements

1. **Forward-only document upgrader**
   - Provide a project-document migration entry point that accepts a raw body,
     detects `schema_version`, applies pure version-step functions, and returns
     a validated current `ProjectDocument`.
   - Reject future schema versions with a clear typed error.
   - Keep existing saved DB rows unchanged on read.

2. **Saved version and draft semantics**
   - Saved versions and drafts can both be upgraded in memory.
   - Saving a draft or save-as writes the current schema version.
   - ETag/version checks remain understandable and are not hidden by implicit
     DB rewrites.

3. **Golden corpus**
   - Commit serialized v1 fixture bodies before beta data exists.
   - Every future schema bump adds fixtures for the old shape it changes.
   - Tests prove upgrade, current validation, canonical serialization, body-size
     safety, and idempotence.

4. **Corpus/DB audit**
   - Provide a CLI that can audit fixtures, exported JSON, and local DB project
     versions/drafts.
   - Report schema versions, invalid bodies, applied upgrade steps, validation
     errors, and body sizes.
   - Do not write upgraded bodies to the DB by default.

5. **Built-in FieldDef drift reporting**
   - Compare persisted built-in `field_defs` against current code-defined
     built-ins by table and `field_key`.
   - Report missing, extra, type/config/display/default/option changes.
   - Distinguish built-in product fields from user-created custom fields.

6. **Schema-bump checklist**
   - Add a short required checklist for durable schema changes.
   - Require corpus coverage and audit evidence for every bump after real data
     exists.

7. **Recovery posture**
   - Keep read-safe recovery as emergency access.
   - Use raw JSON download plus CLI repair/audit for early beta recovery.
   - Do not build a UI importer unless beta recovery happens often enough to
     justify it.

### Non-Functional Requirements

- Migration steps are pure, small, reviewable dict-to-dict functions.
- Old migration steps remain indefinitely once beta data exists.
- Tests are focused and deterministic.
- The mechanism is easy to run locally before deploy.
- The feature does not change product-visible behavior except improved ability
  to survive old project data.

## Non-Goals

- No relational extraction of project document tables.
- No broad Alembic body-rewrite mechanism as the default migration path.
- No silent read-time DB mutation.
- No full admin repair UI before beta.
- No attempt to make table-view preferences first-class project data.
- No broad catalog migration redesign unless a later beta issue proves it is
  needed.

## Success Criteria

The feature is complete when:

- current v1 fixtures exist and validate through the migration entry point;
- future-version and invalid-body paths fail clearly;
- saved-version and draft upgrade semantics are covered by tests;
- the audit CLI can run against fixtures and local DB data without DB mutation;
- built-in `FieldDef` drift can be reported;
- schema-bump docs/checklist are in place;
- the full drill has been run before the first real beta project save.

## Beta Gate

The forever-readable guarantee begins when the first actual BLDGTYP project is
created by someone other than the development agents for real project work.

Before that event, this feature should be complete or the beta should remain
limited to disposable test data.

