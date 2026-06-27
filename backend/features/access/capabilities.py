"""Capabilities and the principal→capability resolver.

A capability is a stable string key the seam gates on. Roles and viewer
audiences are code-defined *bundles* of capabilities; per-user exceptions are
explicit grants (``user_grants``). `capabilities_for` is the pure mapping from a
resolved principal to its capability set; `features/projects/access.py` wires it
to project routes via `require_capability`.

Beta collapses the model to today's binary behavior:

- anonymous → `ViewerPrincipal("client")` → `CLIENT_CAPS` (read only)
- signed-in → `UserPrincipal` → `MEMBER_CAPS` (read + write), plus any granted
  capabilities and the catalog-admin capability for staff.

So `CLIENT_CAPS` ≈ today's viewer and `MEMBER_CAPS` ≈ today's editor. The
`certifier`/`admin`/`staff` bundles and finer per-tab/export capabilities are
added in later phases without changing this shape (see
`planning/refactor/access-capability-model/PRD.md` §3–§4, §6).
"""

from __future__ import annotations

from typing import assert_never

from features.access.principals import Principal, UserPrincipal, ViewerPrincipal

# --- Capability keys -------------------------------------------------------

# Any read of a project's saved data (every view-gated route).
PROJECT_VIEW = "project.view"
# Any mutation of the project document or its backend state (today's "editor").
PROJECT_EDIT = "project.edit"
# Read the redacted project metadata — client name + internal Dropbox URL
# (`certifier`+; redacted from `client`). `phius_number`/`name`/`bt_number`
# stay public; `owner_display_name` is gated separately on edit (member+).
PROJECT_VIEW_PRIVATE = "project.view.private_metadata"

# Bulk exports/downloads — `certifier`+ (CP-7), beta: editor-only. One key per
# export surface, matching the decisions-ledger §4 taxonomy. The per-surface
# split buys no behavioral difference in beta (members hold all, clients none);
# it is intentional forward investment for the certifier bundle (Phase 5).
APERTURES_EXPORT_HBJSON = "apertures.export.hbjson"
ENVELOPE_EXPORT_HBJSON = "envelope.export.hbjson"
ENVELOPE_EXPORT_PHPP = "envelope.export.phpp"
EQUIPMENT_EXPORT_PHIUS = "equipment.export.phius"
MODEL_EXPORT = "model.export"
DOCUMENT_EXPORT = "document.export"

# Write access to the shared catalog library — a grantable capability, not a
# role tier (decision D7), satisfied by a `catalog.edit` grant or `is_staff`.
CATALOG_EDIT = "catalog.edit"

# --- Beta bundles ----------------------------------------------------------

CLIENT_CAPS: frozenset[str] = frozenset({PROJECT_VIEW})

# Every bulk export — grouped so the future certifier bundle (read + private +
# exports, no writes) reuses it instead of re-listing the keys.
EXPORT_CAPS: frozenset[str] = frozenset(
    {
        APERTURES_EXPORT_HBJSON,
        ENVELOPE_EXPORT_HBJSON,
        ENVELOPE_EXPORT_PHPP,
        EQUIPMENT_EXPORT_PHIUS,
        MODEL_EXPORT,
        DOCUMENT_EXPORT,
    }
)

# A member is today's editor: everything a client can read, plus writes, the
# redacted metadata, and every bulk export.
MEMBER_CAPS: frozenset[str] = CLIENT_CAPS | EXPORT_CAPS | frozenset({PROJECT_EDIT, PROJECT_VIEW_PRIVATE})

# A staff user additionally holds the catalog-admin capability (D7). The full
# cross-tenant staff bundle (admin/seat/cross-team reads) lands in Phase 5.
STAFF_EXTRA_CAPS: frozenset[str] = frozenset({CATALOG_EDIT})

# Viewer audience → its read bundle. `certifier` (a superset of `client`) is
# added when the share mechanism lands (Phase 5).
AUDIENCE_CAPS: dict[str, frozenset[str]] = {"client": CLIENT_CAPS}


def capabilities_for(principal: Principal) -> frozenset[str]:
    """Resolve a principal to the flat capability set it holds in beta.

    Pure: all per-user inputs (grants, ``is_staff``) are already carried on the
    `UserPrincipal`. The set mixes project and global (e.g. ``catalog.edit``)
    capabilities; scope-aware resolution against a specific project/team arrives
    with tenancy (Phase 5).
    """
    if isinstance(principal, ViewerPrincipal):
        return AUDIENCE_CAPS.get(principal.audience, frozenset())
    if isinstance(principal, UserPrincipal):
        if not principal.granted_capabilities and not principal.is_staff:
            return MEMBER_CAPS
        caps = MEMBER_CAPS | principal.granted_capabilities
        if principal.is_staff:
            caps |= STAFF_EXTRA_CAPS
        return caps
    assert_never(principal)
