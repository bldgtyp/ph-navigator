# Catalog POC migrations

Alembic env decision deferred to week 2 (plan §5.1) — when the first models
land. Two viable shapes:

1. A second Alembic config (`alembic_catalog.ini`) with its own `versions/`
   directory and `script_location = backend/features/catalog/migrations`.
   Cleanest isolation; matches plan §13.1 ("independent of the main Alembic
   tree"). Run with `alembic -c alembic_catalog.ini upgrade head`.
2. Namespaced inside the existing tree using a separate Alembic branch label
   (`down_revision = None`, `branch_labels = ('catalog_poc',)`). Lighter to
   set up but couples the POC to PHN's migration history.

Default to (1) unless the second-config friction proves silly.
