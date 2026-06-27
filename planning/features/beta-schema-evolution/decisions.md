---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Active - decisions locked by Ed on 2026-06-27.
AUTHOR: Codex with Ed May
SCOPE: Accepted decisions for beta schema evolution.
RELATED:
  - ./README.md
  - ./PRD.md
  - planning/code-reviews/2026-06-27/beta-schema-evolution-readiness.md
---

# Decisions

## D0 - Use a read-time forward-only upgrade chain. `RESOLVED: YES (Ed, 2026-06-27)`

Project document schema evolution will use a forward-only chain of pure upgrade
steps. A raw body saved under an older `schema_version` is upgraded in memory to
the current shape and then validated. The original saved row is not mutated on
read.

This carries forward the recommended mechanism from the 2026-06-27 review and
the earlier deferred Phase 7 plan.

Rejected default: deploy-time Alembic body rewrites for project document JSONB
bodies.

## D1 - When is beta data real? `RESOLVED: first actual BLDGTYP job (Ed, 2026-06-27)`

The first project created by someone other than the development agents for an
actual BLDGTYP job counts as real beta data and activates the forever-readable
guarantee.

Disposable local/demo/agent seed data does not activate the guarantee.

## D2 - How are old saved versions stored? `RESOLVED: keep old rows old (Ed, 2026-06-27)`

Old saved versions remain stored in their original schema. Reads upgrade them in
memory. The current schema is written only when saving a draft, save-as, or
performing an explicit manual repair.

This keeps immutable project-version semantics intact.

## D3 - Should DB body rewrites ever run? `RESOLVED: explicit maintenance only (Ed, 2026-06-27)`

A DB body rewrite is allowed only as an explicit maintenance operation with
export, audit, backup, and rollback. It is not the normal deploy path and not a
silent read side effect.

## D4 - Do we need a repair/import UI before beta? `RESOLVED: no (Ed, 2026-06-27)`

Raw JSON download plus a CLI repair/audit path is enough for early beta.

Add an importer or admin repair UI only if real beta recovery happens often
enough to justify product surface area.

## D5 - How strict are built-in display-name changes? `RESOLVED: built-ins are product schema (Ed, 2026-06-27)`

Built-in field display names are product schema when they come from code-defined
fields. Old persisted built-in display names should be migrated or overlaid when
the product label changes.

User-created custom field names must be preserved. The drift reporter must
distinguish built-in `origin` from custom/user-created fields before suggesting
changes.

