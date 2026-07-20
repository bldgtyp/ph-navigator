"""PH-Navigator-client compatibility for built-in specification-status mutations.

Release A taught the schema-v7 backend to accept the coming ``needed``. Now
that ``needed`` is canonical (schema v8), the same named boundary runs the
other way: an incoming legacy ``missing`` normalizes to internal ``needed``.
It deliberately lives on the public mutation DTOs only — the persisted row
models stay strictly canonical.

This is temporary, but it is *not* yet only about stale browser caches: as of
this release the shipping frontend still serializes ``missing`` on the wire
(``frontend/src/features/project_document/specification-status.ts``). Phase 03
renames the frontend; only after that does this module protect nothing but
cached clients, and only then does the Cleanup Release C observation window
make it safe to delete. Removing it before the frontend rename breaks every
material/glazing/frame status write.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BeforeValidator

from features.project_document.document import SpecificationStatus


def normalize_specification_status_input(value: object) -> object:
    """Map a cached client's legacy spelling to the canonical value."""

    return "needed" if value == "missing" else value


CompatibleSpecificationStatus = Annotated[
    SpecificationStatus,
    BeforeValidator(normalize_specification_status_input),
]
