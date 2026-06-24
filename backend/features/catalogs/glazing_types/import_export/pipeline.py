"""Orchestration for the glazing-types catalog import preview pipeline.

Mirrors `materials/import_export/pipeline.py` minus category. Pure: no DB
writes; the resulting write set goes to the token cache and is replayed
on commit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final, cast

from features.catalogs._option_seeds import GLAZING_TYPE_SINGLE_SELECT_FIELDS
from features.catalogs.glazing_types.import_export.coerce import CoercedRow, coerce_row
from features.catalogs.glazing_types.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
    FILE_KIND,
)
from features.catalogs.glazing_types.import_export.tokens import WriteSet
from features.catalogs.glazing_types.import_export.upgrade import (
    SchemaVersionTooNewError,
    upgrade_row,
)

PREVIEW_ROW_LIMIT: Final[int] = 50


class EnvelopeError(ValueError):
    """Raised when the file envelope is malformed (bad kind, bad shape)."""


@dataclass(frozen=True)
class PreviewCounts:
    new: int
    matched: int
    errored: int
    warnings: int
    dropped: int = 0


@dataclass(frozen=True)
class PreviewRowSummary:
    index: int
    classification: str  # "new" | "matched" | "errored"
    id: str | None
    name: str | None
    manufacturer: str | None


@dataclass(frozen=True)
class PreviewWarning:
    reason: str
    count: int
    row_indices: list[int]


@dataclass(frozen=True)
class PreviewReport:
    schema_version: int
    counts: PreviewCounts
    warnings: list[PreviewWarning]
    errors: list[PreviewWarning]
    rows_preview: list[PreviewRowSummary]
    write_set: WriteSet


def build_preview(
    body: object,
    existing_ids: dict[str, bool],
    known_options: dict[str, set[str]] | None = None,
) -> PreviewReport:
    """Upgrade → coerce → classify the import rows.

    ``known_options`` (field_key → known labels) enables the auto-add path (D-4):
    a new row whose single-select value is not yet an option is flagged
    ``new_option:<field>`` and the value is collected into the write-set so the
    commit can add it to the option store. Pass ``None`` to skip option
    awareness entirely.
    """
    if not isinstance(body, dict):
        raise EnvelopeError("file body must be a JSON object")
    envelope = cast(dict[str, Any], body)

    kind = envelope.get("kind")
    if kind != FILE_KIND:
        raise EnvelopeError(f"file kind must be {FILE_KIND!r}; got {kind!r}")

    schema_version = envelope.get("schema_version")
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise EnvelopeError("schema_version must be an integer")
    if schema_version < 0:
        raise EnvelopeError(f"schema_version must be >= 0; got {schema_version}")
    if schema_version > CURRENT_SCHEMA_VERSION:
        raise SchemaVersionTooNewError(
            f"file schema_version={schema_version} is newer than this app "
            f"(CURRENT_SCHEMA_VERSION={CURRENT_SCHEMA_VERSION})"
        )

    raw_rows = envelope.get("rows")
    if not isinstance(raw_rows, list):
        raise EnvelopeError("rows must be a JSON array")

    coerced_rows: list[tuple[int, CoercedRow]] = []
    dropped_count = 0
    for index, raw in enumerate(raw_rows):
        if not isinstance(raw, dict):
            coerced_rows.append((index, CoercedRow(row=None, id=None, errors=["bad_row_shape"])))
            continue
        raw_dict = cast(dict[str, Any], raw)
        upgraded = upgrade_row(dict(raw_dict), from_version=schema_version)
        if upgraded is None:
            dropped_count += 1  # upgrade dropped the row (e.g. a `DEFAULT` artifact)
            continue
        coerced_rows.append((index, coerce_row(upgraded)))

    new_rows: list[dict[str, object]] = []
    new_options: dict[str, list[str]] = {}
    new_count = 0
    matched_count = 0
    errored_count = 0
    warning_total = 0
    warnings_by_reason: dict[str, list[int]] = {}
    errors_by_reason: dict[str, list[int]] = {}
    summaries: list[PreviewRowSummary] = []

    for index, coerced in coerced_rows:
        warning_total += len(coerced.warnings)
        for warning in coerced.warnings:
            warnings_by_reason.setdefault(warning, []).append(index)

        if coerced.errors:
            errored_count += 1
            for error in coerced.errors:
                errors_by_reason.setdefault(error, []).append(index)
            if len(summaries) < PREVIEW_ROW_LIMIT:
                summaries.append(
                    PreviewRowSummary(
                        index=index,
                        classification="errored",
                        id=coerced.id,
                        name=_string_of(coerced.row, "name"),
                        manufacturer=_string_of(coerced.row, "manufacturer"),
                    )
                )
            continue

        if coerced.id is not None and coerced.id in existing_ids:
            matched_count += 1
            classification = "matched"
            if not existing_ids[coerced.id]:
                warning_total += 1
                warnings_by_reason.setdefault("matched_inactive_skip", []).append(index)
        else:
            new_count += 1
            classification = "new"
            assert coerced.row is not None
            insert_payload = dict(coerced.row)
            if coerced.id is not None:
                insert_payload["id"] = coerced.id
            new_rows.append(insert_payload)
            for field_key in _new_option_fields(coerced.row, known_options):
                value = cast(str, coerced.row[field_key])
                warning_total += 1
                warnings_by_reason.setdefault(f"new_option:{field_key}", []).append(index)
                if value not in new_options.setdefault(field_key, []):
                    new_options[field_key].append(value)

        if len(summaries) < PREVIEW_ROW_LIMIT:
            summaries.append(
                PreviewRowSummary(
                    index=index,
                    classification=classification,
                    id=coerced.id,
                    name=_string_of(coerced.row, "name"),
                    manufacturer=_string_of(coerced.row, "manufacturer"),
                )
            )

    counts = PreviewCounts(
        new=new_count,
        matched=matched_count,
        errored=errored_count,
        warnings=warning_total,
        dropped=dropped_count,
    )
    return PreviewReport(
        schema_version=schema_version,
        counts=counts,
        warnings=_group(warnings_by_reason),
        errors=_group(errors_by_reason),
        rows_preview=summaries,
        write_set=WriteSet(rows_to_insert=new_rows, new_options=new_options),
    )


def _new_option_fields(
    row: dict[str, object] | None,
    known_options: dict[str, set[str]] | None,
) -> list[str]:
    """Return the single-select fields whose value is a non-empty label not yet
    in the option store (so the commit can auto-add it)."""
    if row is None or known_options is None:
        return []
    fields: list[str] = []
    for field_key in GLAZING_TYPE_SINGLE_SELECT_FIELDS:
        value = row.get(field_key)
        if isinstance(value, str) and value and value not in known_options.get(field_key, set()):
            fields.append(field_key)
    return fields


def _group(by_reason: dict[str, list[int]]) -> list[PreviewWarning]:
    grouped = [
        PreviewWarning(reason=reason, count=len(indices), row_indices=indices) for reason, indices in by_reason.items()
    ]
    grouped.sort(key=lambda entry: entry.reason)
    return grouped


def _string_of(row: dict[str, object] | None, key: str) -> str | None:
    if row is None:
        return None
    value = row.get(key)
    return value if isinstance(value, str) else None


__all__ = [
    "EnvelopeError",
    "PreviewCounts",
    "PreviewReport",
    "PreviewRowSummary",
    "PreviewWarning",
    "build_preview",
]
