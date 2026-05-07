# Catalog POC module — see docs/features/2026-05-06-native-catalog-manager.md §13
# and docs/plans/2026-05-06/catalog-poc-plan.md.
#
# Strict no-cross-import rule (plan §3.2): nothing inside this package may
# import from `features.<other>`, and nothing outside may import from
# `features.catalog`. Enforced by tests/test_catalog_isolation.py.
