# Held DDL (not in the migration chain)

These `.sql` files are **finalized but unapplied** schema, parked here on
purpose. Alembic only scans `alembic/versions/`, so nothing in this directory
runs during `alembic upgrade`.

They exist so a future feature is a *fill-in* rather than a re-design: the
schema was reviewed and agreed when the surrounding decision was made, and is
kept ready to drop into a real migration when its consumer lands.

| File | Applies when | Decision / build spec |
| --- | --- | --- |
| `phase5_tenancy_and_shares.sql` | multi-tenant teams + certifier shares land (RBC trigger) | Decision: `planning/archive/dated/2026-06-27/access-capability-model/` PRD §5.1/§5.3, D9. Build spec: `planning/features_v2.0/access-capability-enforcement/` |

To apply held DDL: create a normal Alembic revision (`make makemigration name=...`),
paste the statements into `upgrade()`, and write the matching `downgrade()`.

**Drift caveat:** nothing parses or type-checks these files, so foreign keys
that reference live tables (`users`, `projects`, `project_versions`, …) can
silently go stale if those tables change before the held DDL is applied. When
you apply one, re-validate every referenced column against the current schema
first — treat the file as a reviewed starting point, not guaranteed-current SQL.
