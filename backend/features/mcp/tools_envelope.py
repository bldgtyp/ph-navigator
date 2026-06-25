"""Envelope and project-material MCP tools."""

from __future__ import annotations

from typing import cast

from fastapi import HTTPException
from mcp.server.fastmcp import Context
from pydantic import ValidationError

from features.envelope.models import EnvelopeCommandRequest
from features.envelope.service import (
    apply_envelope_command,
    get_envelope_read_model,
    get_project_material_drift_report,
)
from features.mcp.helpers import (
    current_token,
    parse_uuid,
    project_access_or_error,
    raise_http_exception_as_mcp_error,
    raise_mcp_error,
)
from features.mcp.models import McpRecoverability
from features.project_document.models import ProjectDocumentSource

__all__ = [
    "tool_apply_envelope_command",
    "tool_list_envelope_assemblies",
    "tool_list_project_materials",
    "tool_query_unfinished_envelope_work",
    "tool_report_material_catalog_drift",
    "tool_report_missing_envelope_evidence",
]


def tool_list_envelope_assemblies(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        response = get_envelope_read_model(parsed_version_id, access, source)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_read_failed",
            default_message="Envelope assemblies could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )
    return {
        "project_id": str(response.project_id),
        "version_id": str(response.version_id),
        "source": response.source,
        "version_etag": response.version_etag,
        "draft_etag": response.draft_etag,
        "assemblies": [assembly.model_dump(mode="json") for assembly in response.assemblies],
    }


def tool_list_project_materials(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        response = get_envelope_read_model(parsed_version_id, access, source)
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_read_failed",
            default_message="Project materials could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )
    return {
        "project_id": str(response.project_id),
        "version_id": str(response.version_id),
        "source": response.source,
        "version_etag": response.version_etag,
        "draft_etag": response.draft_etag,
        "project_materials": [material.model_dump(mode="json") for material in response.project_materials],
    }


def tool_report_material_catalog_drift(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:read", ctx)
    try:
        return get_project_material_drift_report(parsed_version_id, access, source).model_dump(mode="json")
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_drift_failed",
            default_message="Material catalog drift could not be loaded.",
            default_recoverability="refresh",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )


def tool_report_missing_envelope_evidence(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    read = tool_list_project_materials(project_id, version_id, ctx, allow_env_token=allow_env_token, source=source)
    missing_datasheets: list[dict[str, object]] = []
    missing_site_photos: list[dict[str, object]] = []
    for material in _dict_items(read.get("project_materials")):
        if not material.get("datasheet_asset_ids"):
            missing_datasheets.append(
                {
                    "project_material_id": material.get("id"),
                    "project_material_name": material.get("name"),
                    "specification_status": material.get("specification_status"),
                }
            )
        use_sites = material.get("use_sites")
        for site in _dict_items(use_sites):
            if not site.get("photo_asset_ids"):
                missing_site_photos.append(
                    {
                        "project_material_id": material.get("id"),
                        "project_material_name": material.get("name"),
                        "assembly_id": site.get("assembly_id"),
                        "assembly_name": site.get("assembly_name"),
                        "layer_id": site.get("layer_id"),
                        "segment_id": site.get("segment_id"),
                    }
                )
    return {
        **{key: read[key] for key in ("project_id", "version_id", "source", "version_etag", "draft_etag")},
        "missing_datasheet_count": len(missing_datasheets),
        "missing_site_photo_count": len(missing_site_photos),
        "missing_datasheets": missing_datasheets,
        "missing_site_photos": missing_site_photos,
    }


def tool_query_unfinished_envelope_work(
    project_id: str,
    version_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    source: ProjectDocumentSource = "draft",
) -> dict[str, object]:
    assemblies = tool_list_envelope_assemblies(
        project_id,
        version_id,
        ctx,
        allow_env_token=allow_env_token,
        source=source,
    )
    materials = tool_list_project_materials(project_id, version_id, ctx, allow_env_token=allow_env_token, source=source)
    evidence = tool_report_missing_envelope_evidence(
        project_id,
        version_id,
        ctx,
        allow_env_token=allow_env_token,
        source=source,
    )
    drift = tool_report_material_catalog_drift(
        project_id,
        version_id,
        ctx,
        allow_env_token=allow_env_token,
        source=source,
    )
    missing_materials: list[dict[str, object]] = []
    missing_conductivity: list[dict[str, object]] = []
    referenced_material_ids: set[str] = set()
    material_by_id: dict[str, dict[str, object]] = {
        str(material.get("id")): material
        for material in _dict_items(materials.get("project_materials"))
        if material.get("id") is not None
    }
    for assembly in _dict_items(assemblies.get("assemblies")):
        for layer in _dict_items(assembly.get("layers")):
            for segment in _dict_items(layer.get("segments")):
                material_id = segment.get("project_material_id")
                if material_id is None:
                    missing_materials.append(_segment_work_item(assembly, layer, segment))
                    continue
                material_id_str = str(material_id)
                referenced_material_ids.add(material_id_str)
                material = material_by_id.get(material_id_str)
                if material is not None and material.get("conductivity_w_mk") is None:
                    missing_conductivity.append(
                        {
                            **_segment_work_item(assembly, layer, segment),
                            "project_material_id": material_id_str,
                            "project_material_name": material.get("name"),
                        }
                    )
    unused_materials = [
        {"project_material_id": material_id, "project_material_name": material.get("name")}
        for material_id, material in material_by_id.items()
        if material_id not in referenced_material_ids
    ]
    drifted = [
        item for item in _dict_items(drift.get("materials")) if item.get("state") not in {"in_sync", "customized"}
    ]
    return {
        "project_id": assemblies["project_id"],
        "version_id": assemblies["version_id"],
        "source": assemblies["source"],
        "version_etag": assemblies["version_etag"],
        "draft_etag": assemblies["draft_etag"],
        "counts": {
            "missing_materials": len(missing_materials),
            "missing_conductivity": len(missing_conductivity),
            "missing_datasheets": evidence["missing_datasheet_count"],
            "missing_site_photos": evidence["missing_site_photo_count"],
            "unused_materials": len(unused_materials),
            "catalog_drift": len(drifted),
        },
        "missing_materials": missing_materials,
        "missing_conductivity": missing_conductivity,
        "missing_datasheets": evidence["missing_datasheets"],
        "missing_site_photos": evidence["missing_site_photos"],
        "unused_materials": unused_materials,
        "catalog_drift": drifted,
    }


def tool_apply_envelope_command(
    project_id: str,
    version_id: str,
    command: dict[str, object],
    ctx: Context,
    *,
    allow_env_token: bool,
    if_match: str | None = None,
    if_match_version: str | None = None,
) -> dict[str, object]:
    parsed_project_id = parse_uuid(project_id, "project_id", ctx)
    parsed_version_id = parse_uuid(version_id, "version_id", ctx)
    token = current_token(ctx, allow_env_token)
    access = project_access_or_error(token, parsed_project_id, "project:write", ctx)
    try:
        payload = EnvelopeCommandRequest.model_validate({"command": command})
        response = apply_envelope_command(
            parsed_version_id,
            access,
            payload.command,
            if_match=if_match,
            if_match_version=if_match_version,
            updated_via="mcp",
        )
    except ValidationError as exc:
        raise_mcp_error(
            "validation_error",
            "Envelope command failed validation.",
            "fatal",
            ctx,
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        )
    except HTTPException as exc:
        raise_http_exception_as_mcp_error(
            exc,
            ctx,
            default_code="envelope_command_failed",
            default_message="Envelope command failed.",
            default_recoverability="fatal",
            recoverability_by_code=_ENVELOPE_RECOVERABILITY,
        )
    return response.model_dump(mode="json")


_ENVELOPE_RECOVERABILITY: dict[str, McpRecoverability] = {
    "project_version_not_found": "refresh",
    "version_locked": "refresh",
    "draft_etag_mismatch": "refresh",
    "version_etag_mismatch": "refresh",
    "duplicate_assembly_name": "fatal",
    "last_layer": "fatal",
    "last_segment": "fatal",
    "assembly_not_found": "refresh",
    "layer_not_found": "refresh",
    "segment_not_found": "refresh",
    "project_material_not_found": "refresh",
    "catalog_material_not_found": "refresh",
    "ambiguous_catalog_material": "fatal",
    "project_material_has_no_catalog_origin": "refresh",
    "catalog_material_source_missing": "refresh",
    "catalog_material_source_deactivated": "refresh",
}


def _dict_items(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _segment_work_item(
    assembly: dict[str, object],
    layer: dict[str, object],
    segment: dict[str, object],
) -> dict[str, object]:
    return {
        "assembly_id": assembly.get("id"),
        "assembly_name": assembly.get("name"),
        "layer_id": layer.get("id"),
        "layer_order": layer.get("order"),
        "segment_id": segment.get("id"),
        "segment_order": segment.get("order"),
    }
