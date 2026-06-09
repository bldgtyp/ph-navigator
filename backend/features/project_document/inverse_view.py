"""Server-computed inverse view for `linked_record` fields."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, cast

from features.project_document.custom_fields import CustomFieldType, TableFieldDef, coerce_link_value
from features.project_document.document import ProjectDocumentV1
from features.project_document.tables.contracts import InverseLinkField, TableContract

InverseLinks = dict[tuple[str, ...], dict[str, dict[str, list[str]]]]
TableInverseLinks = dict[str, dict[str, list[str]]]


@dataclass(frozen=True)
class InverseTableView:
    inverse_links: TableInverseLinks
    inverse_link_fields: list[InverseLinkField]
    fingerprint: str


def build_snapshot_row_ids(body: ProjectDocumentV1) -> dict[tuple[str, ...], frozenset[str]]:
    """Return the row ids present in the document snapshot being read."""

    out: dict[tuple[str, ...], frozenset[str]] = {}
    for contract in _iter_unique_table_contracts():
        if not contract.table_path:
            continue
        out[contract.table_path] = frozenset(_row_id(row) for row in _table_rows(body, contract) if _row_id(row))
    return out


def build_inverse_links(
    body: ProjectDocumentV1,
    *,
    snapshot_row_ids: Mapping[tuple[str, ...], frozenset[str]] | None = None,
) -> InverseLinks:
    """Project incoming linked-record ids onto their target rows.

    Returned shape:
    `{target_table_path: {target_row_id: {source_key: [source_row_id]}}}`.
    `source_key` is `<source_table_path>.<field_key>`, e.g.
    `rooms.cf_pumps`.
    """

    row_ids_by_path = dict(snapshot_row_ids) if snapshot_row_ids is not None else build_snapshot_row_ids(body)

    inverse: dict[tuple[str, ...], dict[str, dict[str, list[str]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )

    for contract in _iter_unique_table_contracts():
        if not contract.table_path:
            continue
        linked_fields = _linked_record_fields(_table_field_defs(body, contract))
        if not linked_fields:
            continue

        for row in _table_rows(body, contract):
            source_row_id = _row_id(row)
            if not source_row_id:
                continue
            for field in linked_fields:
                target_path = _target_table_path(field)
                if target_path is None:
                    continue
                target_ids = row_ids_by_path.get(target_path, frozenset())
                if not target_ids:
                    continue
                source_key = source_link_key(contract.table_path, field.field_key)
                for target_row_id in _row_link_ids(row, field):
                    if target_row_id in target_ids:
                        inverse[target_path][target_row_id][source_key].append(source_row_id)

    return _freeze_inverse(inverse)


def build_inverse_link_fields(body: ProjectDocumentV1, target_table_path: Sequence[str]) -> list[InverseLinkField]:
    """Return metadata for inverse columns that should render on a target table."""

    target_path = tuple(target_table_path)
    fields: list[InverseLinkField] = []
    for contract in _iter_unique_table_contracts():
        if not contract.table_path:
            continue
        for field in _linked_record_fields(_table_field_defs(body, contract)):
            if _target_table_path(field) != target_path:
                continue
            fields.extend(_inverse_metadata(contract, [field]))
    return fields


def inverse_links_for_table(
    body: ProjectDocumentV1, target_table_path: Sequence[str]
) -> dict[str, dict[str, list[str]]]:
    """Convenience wrapper for one target table's inverse overlay."""

    return build_inverse_table_view(body, target_table_path).inverse_links


def inverse_fingerprint_for_table(body: ProjectDocumentV1, target_table_path: Sequence[str]) -> str:
    """Stable digest for the incoming-link overlay of one target table."""

    return build_inverse_table_view(body, target_table_path).fingerprint


def build_inverse_table_view(body: ProjectDocumentV1, target_table_path: Sequence[str]) -> InverseTableView:
    """Build inverse overlay, metadata, and fingerprint for one target table."""

    target_path = tuple(target_table_path)
    overlay: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    metadata: list[InverseLinkField] = []
    row_ids_by_path = build_snapshot_row_ids(body)
    target_ids = row_ids_by_path.get(target_path, frozenset())
    if not target_ids:
        return InverseTableView(inverse_links={}, inverse_link_fields=[], fingerprint=fingerprint_inverse_links({}))

    for contract in _iter_unique_table_contracts():
        if not contract.table_path:
            continue
        matching_fields = [
            field
            for field in _linked_record_fields(_table_field_defs(body, contract))
            if _target_table_path(field) == target_path
        ]
        if not matching_fields:
            continue
        metadata.extend(_inverse_metadata(contract, matching_fields))
        for row in _table_rows(body, contract):
            source_row_id = _row_id(row)
            if not source_row_id:
                continue
            for field in matching_fields:
                source_key = source_link_key(contract.table_path, field.field_key)
                for target_row_id in _row_link_ids(row, field):
                    if target_row_id in target_ids:
                        overlay[target_row_id][source_key].append(source_row_id)

    inverse_links = {
        target_row_id: {source_key: list(source_row_ids) for source_key, source_row_ids in by_source.items()}
        for target_row_id, by_source in overlay.items()
    }
    return InverseTableView(
        inverse_links=inverse_links,
        inverse_link_fields=metadata,
        fingerprint=fingerprint_inverse_links(inverse_links),
    )


def fingerprint_inverse_links(inverse: Mapping[str, Mapping[str, Sequence[str]]]) -> str:
    payload: list[tuple[str, str, tuple[str, ...]]] = []
    for target_row_id, by_source in sorted(inverse.items()):
        for source_key, source_row_ids in sorted(by_source.items()):
            payload.append((source_key, target_row_id, tuple(source_row_ids)))
    encoded = json.dumps(payload, separators=(",", ":"), sort_keys=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def attach_inverse_links_overlay(
    rows: list[dict[str, object]],
    overlay: Mapping[str, Mapping[str, Sequence[str]]],
) -> list[dict[str, object]]:
    """Attach `row["inverse_links"]` to row dicts for derived exports."""

    out: list[dict[str, object]] = []
    for row in rows:
        row_id = str(row.get("id", ""))
        next_row = dict(row)
        next_row["inverse_links"] = {
            source_key: list(source_row_ids) for source_key, source_row_ids in overlay.get(row_id, {}).items()
        }
        out.append(next_row)
    return out


def source_link_key(table_path: Sequence[str], field_key: str) -> str:
    return ".".join((*table_path, field_key))


def target_table_path_for_link_field(field: TableFieldDef) -> tuple[str, ...] | None:
    return _target_table_path(field)


def row_link_ids_for_field(row: Mapping[str, object], field: TableFieldDef) -> list[str]:
    return _row_link_ids(row, field)


def _iter_unique_table_contracts() -> Iterable[TableContract]:
    from features.project_document.tables.registry import iter_table_contracts

    seen_paths: set[tuple[str, ...]] = set()
    for contract in iter_table_contracts():
        if not contract.table_path or contract.table_path in seen_paths:
            continue
        seen_paths.add(contract.table_path)
        yield contract


def _table_field_defs(body: ProjectDocumentV1, contract: TableContract) -> list[TableFieldDef]:
    table = _table_object(body, contract.table_path)
    fields = getattr(table, "field_defs", [])
    if isinstance(fields, list):
        return [field if isinstance(field, TableFieldDef) else TableFieldDef.model_validate(field) for field in fields]
    return []


def _table_rows(body: ProjectDocumentV1, contract: TableContract) -> list[dict[str, Any]]:
    table = _table_object(body, contract.table_path)
    rows = getattr(table, "rows", [])
    if not isinstance(rows, list):
        return []
    return [_row_to_dict(row) for row in rows]


def _table_object(body: ProjectDocumentV1, table_path: Sequence[str]) -> object:
    current: object = body.tables
    for segment in table_path:
        current = getattr(current, segment, None)
        if current is None:
            return None
    return current


def _row_to_dict(row: object) -> dict[str, Any]:
    if isinstance(row, dict):
        return cast(dict[str, Any], row)
    row_id = getattr(row, "id", None)
    if isinstance(row_id, str):
        out: dict[str, Any] = {"id": row_id}
        custom_links = getattr(row, "custom_links", None)
        if isinstance(custom_links, dict):
            out["custom_links"] = custom_links
        return out
    model_dump = getattr(row, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump(mode="json")
        return dumped if isinstance(dumped, dict) else {}
    return {}


def _row_id(row: Mapping[str, object]) -> str:
    value = row.get("id")
    return value if isinstance(value, str) else ""


def _row_link_ids(row: Mapping[str, object], field: TableFieldDef) -> list[str]:
    raw_links = row.get("custom_links")
    if not isinstance(raw_links, dict):
        return []
    raw = cast(Mapping[str, object], raw_links).get(field.field_key)
    max_links = field.config.get("max_links")
    cap = max_links if isinstance(max_links, int) and not isinstance(max_links, bool) else None
    return coerce_link_value(raw, max_links=cap)


def _linked_record_fields(fields: Iterable[TableFieldDef]) -> list[TableFieldDef]:
    return [field for field in fields if field.field_type is CustomFieldType.linked_record]


def _target_table_path(field: TableFieldDef) -> tuple[str, ...] | None:
    raw = field.config.get("target_table_path")
    if not isinstance(raw, list) or not raw or not all(isinstance(part, str) and part for part in raw):
        return None
    return tuple(cast(list[str], raw))


def _inverse_metadata(contract: TableContract, fields: Iterable[TableFieldDef]) -> list[InverseLinkField]:
    return [
        InverseLinkField(
            source_key=source_link_key(contract.table_path, field.field_key),
            source_table_path=list(contract.table_path),
            source_table_display=_display_table_path(contract.table_path),
            source_field_key=field.field_key,
            source_field_display_name=field.display_name,
        )
        for field in fields
    ]


def _freeze_inverse(
    inverse: Mapping[tuple[str, ...], Mapping[str, Mapping[str, list[str]]]],
) -> InverseLinks:
    return {
        target_path: {
            target_row_id: {source_key: list(source_row_ids) for source_key, source_row_ids in by_source.items()}
            for target_row_id, by_source in by_row.items()
        }
        for target_path, by_row in inverse.items()
    }


def _display_table_path(table_path: Sequence[str]) -> str:
    leaf = table_path[-1] if table_path else "Table"
    return leaf.replace("_", " ").title()
