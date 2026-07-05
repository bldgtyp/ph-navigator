"""GET-only router for the Grasshopper Data API.

`/api/v1/gh/projects/{bt_number}` — anonymous-readable, rate-limited, saved
versions only. Phase 01 ships the foundation: the access dependency, version
resolution, the response envelope, and the resolver/metadata route. Phases 2–3
add data payloads by declaring the same `GhAccess` dependency and calling into
`service.py`.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from features.aperture_hbjson_export.service import export_aperture_window_constructions
from features.gh_api.aperture_types_export import export_aperture_types
from features.gh_api.constructions_export import OnMissingThermal, export_rich_constructions
from features.gh_api.models import (
    GhApertureConstructionsResponse,
    GhApertureTypesResponse,
    GhConstructionsResponse,
    GhResolverResponse,
    GhTableResponse,
)
from features.gh_api.rate_limit import enforce_gh_rate_limit
from features.gh_api.service import (
    build_envelope_fields,
    build_resolver_response,
    resolve_gh_access,
    resolve_version_and_body,
)
from features.gh_api.tables_export import export_table
from features.projects.access import ProjectAccess

router = APIRouter(
    prefix="/api/v1/gh/projects/{bt_number}",
    tags=["gh-api"],
    dependencies=[Depends(enforce_gh_rate_limit)],
)


# bt_number → project → view access (session → bearer → anonymous). Every GH
# route depends on this; Phases 2–3 reuse it verbatim.
GhAccess = Annotated[ProjectAccess, Depends(resolve_gh_access)]

# All data routes accept `?version=<version_id>`; omitted → the active saved version.
VersionQuery = Annotated[UUID | None, Query(alias="version")]

# `GET /constructions/hbjson` opt-in: `user_defaults` fills missing thermal-mass
# fields (density/specific-heat) with PH-neutral defaults + `warnings` instead of
# 422ing. Default `strict` preserves the original hard-fail contract.
OnMissingThermalQuery = Annotated[OnMissingThermal, Query(alias="on_missing_thermal")]


@router.get("", response_model=GhResolverResponse)
def get_project_metadata(access: GhAccess) -> GhResolverResponse:
    return build_resolver_response(access)


@router.get("/constructions/hbjson", response_model=GhConstructionsResponse)
def get_constructions_hbjson(
    access: GhAccess,
    version: VersionQuery = None,
    on_missing_thermal: OnMissingThermalQuery = "strict",
) -> GhConstructionsResponse:
    resolved, body = resolve_version_and_body(access, version)
    hb_constructions, warnings = export_rich_constructions(body, on_missing_thermal)
    return GhConstructionsResponse(
        **build_envelope_fields(access, resolved),
        hb_constructions=hb_constructions,
        warnings=warnings,
    )


@router.get("/aperture-types", response_model=GhApertureTypesResponse)
def get_aperture_types(access: GhAccess, version: VersionQuery = None) -> GhApertureTypesResponse:
    resolved, body = resolve_version_and_body(access, version)
    return GhApertureTypesResponse(
        **build_envelope_fields(access, resolved),
        aperture_types=export_aperture_types(body),
    )


@router.get("/aperture-constructions/hbjson", response_model=GhApertureConstructionsResponse)
def get_aperture_constructions_hbjson(
    access: GhAccess, version: VersionQuery = None
) -> GhApertureConstructionsResponse:
    resolved, body = resolve_version_and_body(access, version)
    return GhApertureConstructionsResponse(
        **build_envelope_fields(access, resolved),
        hb_constructions=export_aperture_window_constructions(body),
    )


@router.get("/tables/{table_name}", response_model=GhTableResponse)
def get_table(access: GhAccess, table_name: str, version: VersionQuery = None) -> GhTableResponse:
    resolved, body = resolve_version_and_body(access, version)
    return GhTableResponse(**build_envelope_fields(access, resolved), **export_table(body, table_name))
