"""Shared human labels for project-document records and identifiers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import cast


def humanize_identifier(value: str) -> str:
    return value.replace("_", " ").replace("-", " ").strip().title()


def string_record_value(row: object, custom_values: Mapping[str, object], key: str) -> str | None:
    value = cast(Mapping[str, object], row).get(key) if isinstance(row, Mapping) else getattr(row, key, None)
    if not isinstance(value, str):
        value = custom_values.get(key)
    if not isinstance(value, str):
        return None
    return value.strip() or None


def record_display_name(
    row: object,
    custom_values: Mapping[str, object],
    *,
    fallback: str = "Untitled record",
) -> str:
    return (
        string_record_value(row, custom_values, "name")
        or string_record_value(row, custom_values, "record_id")
        or string_record_value(row, custom_values, "tag")
        or fallback
    )
