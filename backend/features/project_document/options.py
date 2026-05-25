"""Shared option-list helpers for namespaced `single_select_options`.

Plan-16 P3.1: Phase 3 introduces custom `single_select` fields that share
the existing `single_select_options` envelope. Helpers here build the
`<table_path>.<field_id>` namespace key, read/replace the option list in
the document body, validate list shape (duplicates / colors / order), and
locate row cells referencing a particular option id (used by both the
delete-option cascade in `EditOptionsMutation` and the change-type
preflight in `ChangeTypeMutation`).
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Iterable as IterableT

from starlette import status

from features.project_document.custom_fields import normalize_display_name
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.shared.errors import api_error

_HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
_OPTION_ID_PATTERN = re.compile(r"^opt_[A-Za-z0-9_-]+$")


def option_list_key(table_path: tuple[str, ...], field_id: str) -> str:
    """Build the `<table_path>.<field_id>` namespace key.

    `table_path` mirrors the registered TableContract path (e.g.
    `("rooms",)` or `("equipment", "ervs")`). The dot-joined prefix is
    the namespace and the suffix is the column identity (core key for
    core single-selects, `cf_*` for custom).
    """
    if not table_path:
        raise ValueError("option_list_key requires a non-empty table_path")
    return f"{'.'.join(table_path)}.{field_id}"


def read_option_list(body: ProjectDocumentV1, key: str) -> list[SingleSelectOption]:
    """Return the option list stored under `key`, or empty list if absent."""
    return list(body.single_select_options.get(key, []))


def replace_option_list(
    body: ProjectDocumentV1,
    key: str,
    options: list[SingleSelectOption],
) -> ProjectDocumentV1:
    """Return a new body with `options` substituted under `key`.

    Passing an empty list keeps the key with an empty entry rather than
    deleting it (matches the existing core-options round-trip shape).
    """
    next_map = dict(body.single_select_options)
    next_map[key] = list(options)
    return body.model_copy(update={"single_select_options": next_map})


def remove_option_list(body: ProjectDocumentV1, key: str) -> ProjectDocumentV1:
    """Return a new body with `key` removed from `single_select_options`.

    Used when a single_select field is converted to another type — the
    namespaced entry becomes stale.
    """
    next_map = dict(body.single_select_options)
    next_map.pop(key, None)
    return body.model_copy(update={"single_select_options": next_map})


def validate_option_list(options: Iterable[SingleSelectOption]) -> None:
    """Reject duplicate ids, duplicate labels (case-insensitive trimmed),
    malformed colors, or non-positive `order`s. Raises
    `custom_field_option_list_invalid` with structured details.
    """
    seen_ids: set[str] = set()
    seen_labels: set[str] = set()
    for option in options:
        if not _OPTION_ID_PATTERN.match(option.id):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_option_list_invalid",
                "Option id does not match the required pattern.",
                {"reason": "invalid_option_id", "option_id": option.id},
            )
        if option.id in seen_ids:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_option_list_invalid",
                "Duplicate option id in option list.",
                {"reason": "duplicate_option_id", "option_id": option.id},
            )
        seen_ids.add(option.id)
        normalized = normalize_display_name(option.label)
        if not normalized:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_option_list_invalid",
                "Option label cannot be empty.",
                {"reason": "empty_label", "option_id": option.id},
            )
        if normalized in seen_labels:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_option_list_invalid",
                "Duplicate option label in option list.",
                {"reason": "duplicate_label", "option_id": option.id, "label": option.label},
            )
        seen_labels.add(normalized)
        if not _HEX_COLOR_PATTERN.match(option.color):
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "custom_field_option_list_invalid",
                "Option color must be a 6-digit hex string.",
                {"reason": "invalid_color", "option_id": option.id, "color": option.color},
            )


def find_cells_referencing_option(
    rows: IterableT[Mapping[str, object]],
    field_id: str,
    option_id: str,
    *,
    is_custom: bool,
) -> list[tuple[str, object]]:
    """Return `(row_id, raw_value)` for every row referencing `option_id`.

    `is_custom=True` looks inside `row["custom"][field_id]`;
    `is_custom=False` reads `row[field_id]` directly (core single-select
    columns like `floor_level` / `building_zone`).
    """
    found: list[tuple[str, object]] = []
    for row in rows:
        row_id = str(row.get("id", ""))
        if is_custom:
            custom = row.get("custom") or {}
            value = custom.get(field_id) if isinstance(custom, Mapping) else None
        else:
            value = row.get(field_id)
        if value == option_id:
            found.append((row_id, value))
    return found


# Mirror of frontend `OPTION_COLOR_PALETTE` (lib.ts); keep byte-for-byte
# in sync so backend-generated option colors round-trip through the
# frontend color picker's preset swatches.
OPTION_COLOR_PALETTE: tuple[str, ...] = (
    "#3b82f6",
    "#10b981",
    "#a16207",
    "#7c3aed",
    "#0f766e",
    "#be123c",
)


def mint_option_id() -> str:
    """Mint a fresh `opt_*` id matching the SingleSelectOption pattern."""
    import secrets

    return f"opt_{secrets.token_hex(8)}"
