"""Orchestration for the catalog import preview pipeline.

Takes a parsed JSON dict, runs:

    envelope check → upgrade chain → per-row coerce → dedup against
    existing catalog ids → assemble preview report + write set

Produces no DB writes; the write set is handed to the token cache by
the service layer and replayed on commit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final, cast

from features.catalogs.materials.import_export.coerce import CoercedRow, coerce_row
from features.catalogs.materials.import_export.file_format import (
    CURRENT_SCHEMA_VERSION,
    FILE_KIND,
)
from features.catalogs.materials.import_export.tokens import WriteSet
from features.catalogs.materials.import_export.upgrade import (
    SchemaVersionTooNewError,
    upgrade_row,
)

# Number of rows echoed back to the UI in the preview report. Enough
# to confirm the import looks right; bounded so the response stays
# small even for a 10k-row file.
PREVIEW_ROW_LIMIT: Final[int] = 50


class EnvelopeError(ValueError):
    """Raised when the file envelope is malformed (bad kind, bad shape).

    Distinct from `SchemaVersionTooNewError` so the route can return a
    more specific error code for each.
    """


@dataclass(frozen=True)
class PreviewCounts:
    new: int
    matched: int
    errored: int
    warnings: int


@dataclass(frozen=True)
class PreviewRowSummary:
    """One sampled row in the preview report.

    Mirrors the canonical catalog shape (post-coerce) so the UI can
    render a familiar table.
    """

    index: int
    classification: str  # "new" | "matched" | "errored"
    id: str | None
    name: str | None
    category: str | None


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


def build_preview(body: object, existing_ids: dict[str, bool]) -> PreviewReport:
    """Run the full pipeline against an already-parsed JSON dict.

    `existing_ids` maps every catalog `id` currently in the DB to its
    active flag (True = active, False = soft-deleted). Inactive
    matches are still skipped (skip-matches policy) but surface a
    distinct warning so the user knows their re-import didn't land.
    The caller fetches the map so this function stays pure and
    unit-testable.
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
        # A negative version is never produced by any exporter and has no
        # upgrade step. Catch it here so the upgrade chain never sees it
        # (it would otherwise crash with an unhandled RuntimeError → 500).
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
    for index, raw in enumerate(raw_rows):
        if not isinstance(raw, dict):
            # A non-object row is treated as a row-level error, not an
            # envelope error: it doesn't abort the file.
            coerced_rows.append((index, CoercedRow(row=None, id=None, errors=["bad_row_shape"])))
            continue
        raw_dict = cast(dict[str, Any], raw)
        upgraded = upgrade_row(dict(raw_dict), from_version=schema_version)
        coerced_rows.append((index, coerce_row(upgraded)))

    # Partition.
    new_rows: list[dict[str, object]] = []
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
                        name=_name_of(coerced.row),
                        category=_category_of(coerced.row),
                    )
                )
            continue

        if coerced.id is not None and coerced.id in existing_ids:
            matched_count += 1
            classification = "matched"
            # Inactive (soft-deleted) match: still skipped under
            # skip-matches policy, but surface a distinct warning so
            # the user understands their re-import did not land.
            # Update-in-place / reactivate is intentionally deferred.
            if not existing_ids[coerced.id]:
                warning_total += 1
                warnings_by_reason.setdefault("matched_inactive_skip", []).append(index)
        else:
            new_count += 1
            classification = "new"
            assert coerced.row is not None  # non-errored rows always have row
            insert_payload = dict(coerced.row)
            if coerced.id is not None:
                insert_payload["id"] = coerced.id
            new_rows.append(insert_payload)

        if len(summaries) < PREVIEW_ROW_LIMIT:
            summaries.append(
                PreviewRowSummary(
                    index=index,
                    classification=classification,
                    id=coerced.id,
                    name=_name_of(coerced.row),
                    category=_category_of(coerced.row),
                )
            )

    counts = PreviewCounts(
        new=new_count,
        matched=matched_count,
        errored=errored_count,
        warnings=warning_total,
    )
    return PreviewReport(
        schema_version=schema_version,
        counts=counts,
        warnings=_group(warnings_by_reason),
        errors=_group(errors_by_reason),
        rows_preview=summaries,
        write_set=WriteSet(rows_to_insert=new_rows),
    )


def _group(by_reason: dict[str, list[int]]) -> list[PreviewWarning]:
    grouped = [
        PreviewWarning(reason=reason, count=len(indices), row_indices=indices) for reason, indices in by_reason.items()
    ]
    # Stable ordering by reason → easier to assert on in tests.
    grouped.sort(key=lambda entry: entry.reason)
    return grouped


def _name_of(row: dict[str, object] | None) -> str | None:
    if row is None:
        return None
    value = row.get("name")
    return value if isinstance(value, str) else None


def _category_of(row: dict[str, object] | None) -> str | None:
    if row is None:
        return None
    value = row.get("category")
    return value if isinstance(value, str) else None


__all__ = [
    "EnvelopeError",
    "PreviewCounts",
    "PreviewReport",
    "PreviewRowSummary",
    "PreviewWarning",
    "build_preview",
]
