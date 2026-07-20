"""Shared assertions for the built-in DataTable `status` single-select field.

The same four-option `status` field rides on twelve DataTables (every
Datasheet-bearing table plus Thermal Bridges). These helpers keep the
per-table tests from copy-pasting the FieldDef / option-list /
namespaced-key checks.
"""

from __future__ import annotations

from typing import Any

from features.project_document.tables._status_field import (
    STATUS_DEFAULT_OPTION_ID,
    STATUS_FIELD_KEY,
    STATUS_OPTION_COMPLETE,
    STATUS_OPTION_IDS,
    STATUS_OPTION_NA,
    STATUS_OPTION_NEEDED,
    STATUS_OPTION_QUESTION,
    status_option_key,
    status_option_list,
)

__all__ = [
    "STATUS_OPTION_COMPLETE",
    "STATUS_OPTION_NA",
    "STATUS_OPTION_NEEDED",
    "STATUS_OPTION_QUESTION",
    "assert_status_field_def",
    "assert_status_options",
    "status_options_payload",
]


def status_options_payload() -> list[dict[str, Any]]:
    """The four status options as a JSON-serializable replace-payload list."""
    return [option.model_dump(mode="json") for option in status_option_list()]


def assert_status_field_def(field_defs: list[dict[str, Any]]) -> None:
    """The `status` FieldDef is a built-in single-select defaulting to Needed."""
    status_def = next((field for field in field_defs if field["field_key"] == STATUS_FIELD_KEY), None)
    assert status_def is not None, "status FieldDef missing from field_defs"
    assert status_def["field_type"] == "single_select"
    assert status_def["origin"] == "built_in"
    assert status_def["default"] == STATUS_DEFAULT_OPTION_ID


def assert_status_options(single_select_options: dict[str, list[dict[str, Any]]], table_label: str) -> None:
    """The slice exposes `<table_label>.status` with the four status options."""
    key = status_option_key(table_label)
    assert key in single_select_options, f"{key} missing from single_select_options"
    option_ids = [option["id"] for option in single_select_options[key]]
    assert option_ids == list(STATUS_OPTION_IDS)
