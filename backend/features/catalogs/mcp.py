"""MCP read tools for the shared PH-Navigator reference catalogs.

Catalog rows (materials, window frames, window glazings) are shared
reference data across projects, so reads require a valid MCP token
(project-scoped or user-scoped) without gating on a single project.
"""

from __future__ import annotations

import asyncio

from mcp.server.fastmcp import Context

from features.catalogs._shared import CATALOG_SCHEMA_VERSION
from features.catalogs.frame_types.service import list_frame_types
from features.catalogs.glazing_types.service import list_glazing_types
from features.catalogs.materials.models import MATERIAL_CATEGORY_IDS
from features.catalogs.materials.service import list_materials
from features.mcp.helpers import current_token, raise_mcp_error

__all__ = [
    "tool_list_catalog_frame_types",
    "tool_list_catalog_glazing_types",
    "tool_search_catalog_materials",
]

_MAX_CATALOG_LIMIT = 500


def _validate_limit(limit: int, ctx: Context) -> int:
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1 or limit > _MAX_CATALOG_LIMIT:
        raise_mcp_error(
            "validation_error",
            f"limit must be an integer between 1 and {_MAX_CATALOG_LIMIT}.",
            "fatal",
            ctx,
            {"field": "limit", "min": 1, "max": _MAX_CATALOG_LIMIT},
        )
    return limit


def _normalize_optional_text(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _normalize_manufacturers(manufacturers: list[str] | None) -> list[str] | None:
    if manufacturers is None:
        return None
    return [item.strip() for item in manufacturers if isinstance(item, str) and item.strip()]


def _matches_query(query: str | None, *fields: str | None) -> bool:
    if query is None:
        return True
    needle = query.casefold()
    return any(field is not None and needle in field.casefold() for field in fields)


async def tool_search_catalog_materials(
    ctx: Context,
    *,
    allow_env_token: bool,
    query: str | None = None,
    category: str | None = None,
    limit: int = 50,
) -> dict[str, object]:
    """Search active Materials catalog rows by optional query and category."""
    validated_limit = _validate_limit(limit, ctx)
    normalized_category = _normalize_optional_text(category)
    if normalized_category is not None and normalized_category not in MATERIAL_CATEGORY_IDS:
        raise_mcp_error(
            "validation_error",
            f"Unknown material category: {normalized_category}",
            "fatal",
            ctx,
            {"field": "category", "allowed": list(MATERIAL_CATEGORY_IDS)},
        )
    normalized_query = _normalize_optional_text(query)

    def _run() -> dict[str, object]:
        current_token(ctx, allow_env_token)
        items = list_materials(include_inactive=False).items
        matched = [
            item
            for item in items
            if (normalized_category is None or item.category == normalized_category)
            and _matches_query(normalized_query, item.name, item.source)
        ]
        return {
            "items": [item.model_dump(mode="json") for item in matched[:validated_limit]],
            "total_matched": len(matched),
            "truncated": len(matched) > validated_limit,
        }

    return await asyncio.to_thread(_run)


async def tool_list_catalog_frame_types(
    ctx: Context,
    *,
    allow_env_token: bool,
    manufacturers: list[str] | None = None,
    location: str | None = None,
    operation: str | None = None,
    use: str | None = None,
    query: str | None = None,
    limit: int = 100,
) -> dict[str, object]:
    """List active Window-Frame catalog rows to obtain valid catalog_record_ids for pickFrame."""
    validated_limit = _validate_limit(limit, ctx)
    normalized_manufacturers = _normalize_manufacturers(manufacturers)
    normalized_location = _normalize_optional_text(location)
    normalized_operation = _normalize_optional_text(operation)
    normalized_use = _normalize_optional_text(use)
    normalized_query = _normalize_optional_text(query)

    def _run() -> dict[str, object]:
        current_token(ctx, allow_env_token)
        items = list_frame_types(
            include_inactive=False,
            location=normalized_location,
            operation=normalized_operation,
            use=normalized_use,
            manufacturers=normalized_manufacturers,
        ).items
        matched = [
            item
            for item in items
            if _matches_query(normalized_query, item.name, item.manufacturer, item.brand, item.source)
        ]
        return {
            "catalog_schema_version": CATALOG_SCHEMA_VERSION,
            "items": [item.model_dump(mode="json") for item in matched[:validated_limit]],
            "total_matched": len(matched),
            "truncated": len(matched) > validated_limit,
        }

    return await asyncio.to_thread(_run)


async def tool_list_catalog_glazing_types(
    ctx: Context,
    *,
    allow_env_token: bool,
    manufacturers: list[str] | None = None,
    query: str | None = None,
    limit: int = 100,
) -> dict[str, object]:
    """List active Window-Glazing catalog rows to obtain valid catalog_record_ids for pickGlazing."""
    validated_limit = _validate_limit(limit, ctx)
    normalized_manufacturers = _normalize_manufacturers(manufacturers)
    normalized_query = _normalize_optional_text(query)

    def _run() -> dict[str, object]:
        current_token(ctx, allow_env_token)
        items = list_glazing_types(
            include_inactive=False,
            manufacturers=normalized_manufacturers,
        ).items
        matched = [
            item
            for item in items
            if _matches_query(normalized_query, item.name, item.manufacturer, item.brand, item.source)
        ]
        return {
            "catalog_schema_version": CATALOG_SCHEMA_VERSION,
            "items": [item.model_dump(mode="json") for item in matched[:validated_limit]],
            "total_matched": len(matched),
            "truncated": len(matched) > validated_limit,
        }

    return await asyncio.to_thread(_run)
