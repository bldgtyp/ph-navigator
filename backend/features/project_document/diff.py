"""Project-document diff summaries."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from starlette import status

from features.project_document.models import ProjectDiffResponse, TableDiffSummary
from features.project_document.store import get_saved_and_current_document_view, get_saved_document
from features.project_document.tables import iter_table_contracts
from features.projects.access import ProjectAccess
from features.shared.errors import api_error


def get_project_diff(
    from_version_id: UUID,
    to_value: str,
    access: ProjectAccess,
) -> ProjectDiffResponse:
    if to_value == "draft":
        from_body, current = get_saved_and_current_document_view(from_version_id, access)
        to_body = current.body
        to_version_id: UUID | str = "draft"
    else:
        from_body = get_saved_document(from_version_id, access)
        try:
            to_version_id = UUID(to_value)
        except ValueError as exc:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "validation_error",
                "Invalid diff target.",
            ) from exc
        to_body = get_saved_document(to_version_id, access)

    tables = [
        table_diff_summary(
            contract.name,
            contract.extract_diff_value(from_body),
            contract.extract_diff_value(to_body),
        )
        for contract in iter_table_contracts()
    ]
    return ProjectDiffResponse(
        project_id=access.project_id,
        from_version_id=from_version_id,
        to_version_id=to_version_id,
        tables=tables,
    )


def table_diff_summary(table: str, before: Any, after: Any) -> TableDiffSummary:
    changed_paths = sorted(diff_paths(before, after, table))
    return TableDiffSummary(table=table, change_count=len(changed_paths), changed_paths=changed_paths)


def diff_paths(before: Any, after: Any, path: str = "") -> set[str]:
    if before == after:
        return set()
    if isinstance(before, dict) and isinstance(after, dict):
        keys = set(before) | set(after)
        return {
            changed
            for key in keys
            for changed in diff_paths(before.get(key), after.get(key), f"{path}.{key}" if path else str(key))
        }
    if isinstance(before, list) and isinstance(after, list):
        return diff_list_paths(before, after, path)
    return {path or "$"}


def diff_list_paths(before: list[Any], after: list[Any], path: str) -> set[str]:
    before_by_id = rows_by_id(before)
    after_by_id = rows_by_id(after)
    if before_by_id is None or after_by_id is None:
        return {path or "$"}
    changed: set[str] = set()
    for row_id in set(before_by_id) | set(after_by_id):
        row_path = f"{path}[{row_id}]" if path else f"[{row_id}]"
        changed.update(diff_paths(before_by_id.get(row_id), after_by_id.get(row_id), row_path))
    return changed


def rows_by_id(rows: Iterable[Any]) -> dict[str, Any] | None:
    keyed: dict[str, Any] = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            return None
        keyed[row["id"]] = row
    return keyed
