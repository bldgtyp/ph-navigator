"""Versioned JSON Schema endpoints generated from Pydantic contracts."""

from __future__ import annotations

from functools import cache
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from features.project_document.document import ProjectDocumentV1, RoomsTableEnvelope
from features.project_document.tables import get_table_contract_by_schema_slug

router = APIRouter(prefix="/api/v1/schemas", tags=["schemas"])


@cache
def model_schema(model: type[BaseModel]) -> dict[str, Any]:
    return model.model_json_schema(ref_template="#/$defs/{model}")


@router.get("/project-document/v1.json")
def project_document_v1_schema() -> dict[str, Any]:
    return model_schema(ProjectDocumentV1)


@router.get("/room/v1.json")
def room_v1_schema() -> dict[str, Any]:
    return model_schema(get_table_contract_by_schema_slug("room").schema_model)


@router.get("/rooms-table/v1.json")
def rooms_table_v1_schema() -> dict[str, Any]:
    """Return the `{custom_fields, rows}` envelope schema for Rooms.

    Consumers (LLM/MCP, frontend) need both the bare row shape and the
    envelope shape because custom-field-capable tables publish their
    custom fields alongside their rows (plan-13 §4.7, US-CF-10).
    """
    return model_schema(RoomsTableEnvelope)


@router.get("/window-type/v1.json")
def window_type_v1_schema() -> dict[str, Any]:
    return model_schema(get_table_contract_by_schema_slug("window-type").schema_model)
