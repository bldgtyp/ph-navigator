"""Project-document diff summaries."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from starlette import status

from features.project_document.labels import humanize_identifier, record_display_name
from features.project_document.models import DiffChange, ProjectDiffResponse, TableDiffSummary
from features.project_document.store import get_saved_and_current_document_view, get_saved_document
from features.project_document.tables import iter_table_contracts
from features.projects.access import ProjectAccess
from features.shared.errors import api_error

DERIVED_DIFF_KEYS = frozenset({"computed", "inverse_links", "inverse_link_fields", "inverse_links_fingerprint"})


@dataclass(frozen=True)
class DiffPresenter:
    table_label: str
    envelope_key: str | None = None


DIFF_PRESENTERS: dict[str, DiffPresenter] = {
    "rooms": DiffPresenter("Rooms", "rooms"),
    "apertures": DiffPresenter("Apertures"),
    "assembly_segments": DiffPresenter("Assembly Segments"),
    "project_materials": DiffPresenter("Project Materials"),
    "space_types": DiffPresenter("Space Types", "space_types"),
    "ventilators": DiffPresenter("Ventilators", "ventilators"),
    "appliances": DiffPresenter("Appliances", "appliances"),
    "pumps": DiffPresenter("Pumps", "pumps"),
    "fans": DiffPresenter("Fans", "fans"),
    "heat_pumps_outdoor_equip": DiffPresenter("Heat Pump Outdoor Equipment", "heat_pumps_outdoor_equip"),
    "heat_pumps_indoor_equip": DiffPresenter("Heat Pump Indoor Equipment", "heat_pumps_indoor_equip"),
    "heat_pumps_outdoor_units": DiffPresenter("Heat Pump Outdoor Units", "heat_pumps_outdoor_units"),
    "heat_pumps_indoor_units": DiffPresenter("Heat Pump Indoor Units", "heat_pumps_indoor_units"),
    "hot_water_heaters": DiffPresenter("Hot Water Heaters", "hot_water_heaters"),
    "hot_water_tanks": DiffPresenter("Hot Water Tanks", "hot_water_tanks"),
    "electric_heaters": DiffPresenter("Electric Heaters", "electric_heaters"),
    "thermal_bridges": DiffPresenter("Thermal Bridges", "thermal_bridges"),
    "aperture_install_types": DiffPresenter("Aperture Install Types", "aperture_install_types"),
}


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
                status.HTTP_422_UNPROCESSABLE_CONTENT,
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
        tables=[table for table in tables if table.changes],
    )


def table_diff_summary(table: str, before: Any, after: Any) -> TableDiffSummary:
    presenter = DIFF_PRESENTERS.get(table, DiffPresenter(humanize_identifier(table)))
    if before == after:
        return TableDiffSummary(
            table=table,
            change_count=0,
            changed_paths=[],
            table_label=presenter.table_label,
            added_count=0,
            removed_count=0,
            changed_count=0,
            changes=[],
        )
    changed_paths = sorted(diff_paths(before, after, table))
    changes = structured_changes(table, before, after)
    operation_counts = Counter(change.operation for change in changes)
    return TableDiffSummary(
        table=table,
        change_count=len(changed_paths),
        changed_paths=changed_paths,
        table_label=presenter.table_label,
        added_count=operation_counts["added"],
        removed_count=operation_counts["removed"],
        changed_count=operation_counts["changed"],
        changes=changes,
    )


def structured_changes(table: str, before: Any, after: Any) -> list[DiffChange]:
    if isinstance(before, list) and isinstance(after, list):
        return diff_record_list(table, before, after, table, collect_field_labels(before, after))
    if isinstance(before, dict) and isinstance(after, dict):
        content_path = table
        presenter = DIFF_PRESENTERS.get(table, DiffPresenter(humanize_identifier(table)))
        envelope_key = presenter.envelope_key
        if (
            envelope_key is not None
            and isinstance(before.get(envelope_key), dict)
            and isinstance(after.get(envelope_key), dict)
        ):
            content_path = f"{table}.{envelope_key}"
            before = {**before[envelope_key], "single_select_options": before.get("single_select_options", {})}
            after = {**after[envelope_key], "single_select_options": after.get("single_select_options", {})}
        field_labels = collect_field_labels(before, after)
        changes: list[DiffChange] = []
        handled: set[str] = set()
        for section, identity_key in (("rows", "id"), ("field_defs", "field_key")):
            before_rows = before.get(section)
            after_rows = after.get(section)
            if isinstance(before_rows, list) and isinstance(after_rows, list):
                changes.extend(
                    diff_record_list(
                        table,
                        before_rows,
                        after_rows,
                        f"{content_path}.{section}",
                        field_labels,
                        identity_key=identity_key,
                    )
                )
                handled.add(section)
        before_options = before.get("single_select_options")
        after_options = after.get("single_select_options")
        if isinstance(before_options, dict) and isinstance(after_options, dict):
            for namespace in sorted(set(before_options) | set(after_options)):
                before_rows = before_options.get(namespace, [])
                after_rows = after_options.get(namespace, [])
                if isinstance(before_rows, list) and isinstance(after_rows, list):
                    changes.extend(
                        diff_record_list(
                            table,
                            before_rows,
                            after_rows,
                            f"{table}.single_select_options.{namespace}",
                            field_labels,
                        )
                    )
            handled.add("single_select_options")
        for key in sorted((set(before) | set(after)) - handled - DERIVED_DIFF_KEYS):
            changes.extend(
                diff_record_fields(
                    table,
                    before.get(key),
                    after.get(key),
                    record_id=table,
                    record_label=humanize_identifier(table),
                    display_path=key,
                    raw_path=f"{table}.{key}",
                    field_labels=field_labels,
                )
            )
        return changes
    if before == after:
        return []
    return [
        DiffChange(
            operation="changed",
            record_id=table,
            record_label=humanize_identifier(table),
            field_key=table,
            field_label=humanize_identifier(table),
            before=before,
            after=after,
            raw_paths=[table],
        )
    ]


def diff_record_list(
    table: str,
    before: list[Any],
    after: list[Any],
    raw_path: str,
    field_labels: dict[str, str],
    *,
    identity_key: str = "id",
) -> list[DiffChange]:
    before_by_id = records_by_key(before, identity_key)
    after_by_id = records_by_key(after, identity_key)
    if before_by_id is None or after_by_id is None:
        if before == after:
            return []
        return [
            DiffChange(
                operation="changed",
                record_id=table,
                record_label=humanize_identifier(table),
                field_key=raw_path.removeprefix(f"{table}."),
                field_label=humanize_identifier(raw_path.rsplit(".", 1)[-1]),
                before=before,
                after=after,
                raw_paths=[raw_path],
            )
        ]
    changes: list[DiffChange] = []
    for record_id in sorted(set(before_by_id) | set(after_by_id)):
        before_record = before_by_id.get(record_id)
        after_record = after_by_id.get(record_id)
        record_path = f"{raw_path}[{record_id}]"
        record = after_record if after_record is not None else before_record
        label = record_label_for_value(record, record_id)
        if before_record is None:
            changes.append(
                DiffChange(
                    operation="added",
                    record_id=record_id,
                    record_label=label,
                    after=meaningful_payload(after_record),
                    raw_paths=[record_path],
                )
            )
        elif after_record is None:
            changes.append(
                DiffChange(
                    operation="removed",
                    record_id=record_id,
                    record_label=label,
                    before=meaningful_payload(before_record),
                    raw_paths=[record_path],
                )
            )
        else:
            changes.extend(
                diff_record_fields(
                    table,
                    before_record,
                    after_record,
                    record_id=record_id,
                    record_label=label,
                    display_path="",
                    raw_path=record_path,
                    field_labels=field_labels,
                    identity_key=identity_key,
                )
            )
    return changes


def diff_record_fields(
    table: str,
    before: Any,
    after: Any,
    *,
    record_id: str,
    record_label: str,
    display_path: str,
    raw_path: str,
    field_labels: dict[str, str],
    identity_key: str = "id",
) -> list[DiffChange]:
    if before == after:
        return []
    if isinstance(before, dict) and isinstance(after, dict):
        changes: list[DiffChange] = []
        for key in sorted(set(before) | set(after)):
            if key == identity_key or key in DERIVED_DIFF_KEYS:
                continue
            next_display = display_path if key == "custom_values" else join_display_path(display_path, key)
            changes.extend(
                diff_record_fields(
                    table,
                    before.get(key),
                    after.get(key),
                    record_id=record_id,
                    record_label=record_label,
                    display_path=next_display,
                    raw_path=f"{raw_path}.{key}",
                    field_labels=field_labels,
                )
            )
        return changes
    if isinstance(before, list) and isinstance(after, list):
        before_by_id = records_by_key(before, "id")
        after_by_id = records_by_key(after, "id")
        if before_by_id is not None and after_by_id is not None:
            changes: list[DiffChange] = []
            for nested_id in sorted(set(before_by_id) | set(after_by_id)):
                nested_before = before_by_id.get(nested_id)
                nested_after = after_by_id.get(nested_id)
                nested_display = join_display_path(display_path, nested_id)
                nested_raw = f"{raw_path}[{nested_id}]"
                if nested_before is None:
                    changes.append(
                        DiffChange(
                            operation="added",
                            record_id=nested_id,
                            record_label=record_label_for_value(nested_after, nested_id),
                            after=meaningful_payload(nested_after),
                            raw_paths=[nested_raw],
                        )
                    )
                elif nested_after is None:
                    changes.append(
                        DiffChange(
                            operation="removed",
                            record_id=nested_id,
                            record_label=record_label_for_value(nested_before, nested_id),
                            before=meaningful_payload(nested_before),
                            raw_paths=[nested_raw],
                        )
                    )
                else:
                    changes.extend(
                        diff_record_fields(
                            table,
                            nested_before,
                            nested_after,
                            record_id=record_id,
                            record_label=record_label,
                            display_path=nested_display,
                            raw_path=nested_raw,
                            field_labels=field_labels,
                        )
                    )
            return changes
    return [
        build_field_change(
            record_id,
            record_label,
            display_path or table,
            before,
            after,
            raw_path,
            field_labels,
        )
    ]


def build_field_change(
    record_id: str,
    record_label_value: str,
    field_key: str,
    before: Any,
    after: Any,
    raw_path: str,
    field_labels: dict[str, str],
) -> DiffChange:
    return DiffChange(
        operation="changed",
        record_id=record_id,
        record_label=record_label_value,
        field_key=field_key,
        field_label=field_labels.get(field_key, humanize_identifier(field_key.rsplit(".", 1)[-1])),
        before=before,
        after=after,
        raw_paths=[raw_path],
    )


def collect_field_labels(*values: Any) -> dict[str, str]:
    labels: dict[str, str] = {}
    for value in values:
        if not isinstance(value, dict) or not isinstance(value.get("field_defs"), list):
            continue
        for field in value["field_defs"]:
            if not isinstance(field, dict):
                continue
            field_key = field.get("field_key")
            display_name = field.get("display_name")
            if isinstance(field_key, str) and isinstance(display_name, str):
                labels[field_key] = display_name
    return labels


def records_by_key(rows: Iterable[Any], key: str) -> dict[str, Any] | None:
    keyed: dict[str, Any] = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get(key), str):
            return None
        keyed[row[key]] = row
    return keyed


def record_label_for_value(record: Any, fallback: str) -> str:
    if not isinstance(record, dict):
        return fallback
    for key in ("label", "display_name"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value
    custom_values = record.get("custom_values")
    if not isinstance(custom_values, dict):
        custom_values = {}
    display_name = record_display_name(record, custom_values, fallback="")
    if display_name:
        return display_name
    number = custom_values.get("number", record.get("number"))
    if isinstance(number, str) and number.strip():
        return number
    return fallback


def meaningful_payload(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: meaningful_payload(item) for key, item in value.items() if key not in DERIVED_DIFF_KEYS}
    if isinstance(value, list):
        return [meaningful_payload(item) for item in value]
    return value


def join_display_path(prefix: str, key: str) -> str:
    return f"{prefix}.{key}" if prefix else key


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
    return records_by_key(rows, "id")
