"""Access capability model.

Home of the capability-based authorization machinery that replaces the
binary ``is_editor`` check. Phase 1 lands the persistence for fine-grained
per-user capability grants (``user_grants``); later phases add the capability
constants/bundles here and grow the resolver in
``features/projects/access.py`` (the single project-scoped seam).

See ``planning/archive/dated/2026-06-27/access-capability-model/`` for the contract.
"""
