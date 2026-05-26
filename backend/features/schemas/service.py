"""Cached JSON-schema generation for the public `/api/v1/schemas/*` endpoints.

`model_schema` is cached so a hot client (LLM, frontend) repeatedly
hitting the schema endpoints doesn't re-walk Pydantic's reflection tree
every request. The route layer stays display-only and pulls schemas
through this helper.
"""

from __future__ import annotations

from functools import cache
from typing import Any

from pydantic import BaseModel

__all__ = ["model_schema"]


@cache
def model_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Return the JSON schema for a Pydantic model, using a single $defs root."""
    return model.model_json_schema(ref_template="#/$defs/{model}")
