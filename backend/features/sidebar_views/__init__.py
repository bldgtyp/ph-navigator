"""Per-user project-sidebar ViewState persistence.

Backs the Apertures/Envelope sidebar organization (sort mode, manual order,
groups, collapse) with a per-user × per-project × per-sidebar row. The backend
treats the payload as an opaque JSON document owned by the frontend sidebar
contract — the sibling of `features/table_views` for element sidebars.
"""
