"""MCP read tools for the app-wide climate reference datasets.

Unlike the project-scoped tools, these reference reads are app-wide:
they require a valid token (any authenticated agent) but gate on no
project, because the Phius/PHI datasets are shared by every project.
"""

from __future__ import annotations

from mcp.server.fastmcp import Context

from features.climate._shared import parse_lat_long
from features.climate.service import (
    get_climate_location,
    list_climate_datasets,
    search_climate_locations,
)
from features.mcp.helpers import current_token, parse_uuid, raise_mcp_error


def tool_list_climate_datasets(ctx: Context, *, allow_env_token: bool) -> list[dict[str, object]]:
    """List the available climate reference datasets (provider/version)."""
    current_token(ctx, allow_env_token)
    return [item.model_dump(mode="json") for item in list_climate_datasets().items]


def tool_search_climate_locations(
    dataset_id: str,
    ctx: Context,
    *,
    allow_env_token: bool,
    country: str | None = None,
    region: str | None = None,
    near: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, object]:
    """Search one dataset's locations by country/region or nearest to `lat,long`."""
    current_token(ctx, allow_env_token)
    parsed_dataset_id = parse_uuid(dataset_id, "dataset_id", ctx)
    result = search_climate_locations(
        parsed_dataset_id,
        country=country,
        region=region,
        near=_parse_near(near, ctx),
        limit=limit,
        offset=offset,
    )
    return result.model_dump(mode="json")


def tool_get_climate_location(location_id: str, ctx: Context, *, allow_env_token: bool) -> dict[str, object] | None:
    """Return one location's standardized climate record, or None if unknown."""
    current_token(ctx, allow_env_token)
    parsed_location_id = parse_uuid(location_id, "location_id", ctx)
    detail = get_climate_location(parsed_location_id)
    return detail.model_dump(mode="json") if detail is not None else None


def _parse_near(near: str | None, ctx: Context) -> tuple[float, float] | None:
    if near is None:
        return None
    try:
        return parse_lat_long(near)
    except ValueError:
        raise_mcp_error("validation_error", "`near` must be `lat,long` numbers.", "fatal", ctx, {"field": "near"})
