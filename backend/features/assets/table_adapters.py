"""Project-document row adapters for registered attachment tables.

The attachment-field registry remains the security allowlist. These adapters
only describe how an already-authorized table key reaches its raw document
rows, so reference reads and attachment mutation can share one shape authority.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from typing import Any, Literal, cast

from features.project_document.tables.registry import iter_table_contracts

RawRowsReader = Callable[[dict[str, Any]], Iterable[dict[str, Any]]]
AttachmentAdapterSource = Literal["table_contract", "irregular_project_table", "nested_flattening_adapter"]


@dataclass(frozen=True)
class AttachmentTableAdapter:
    """Resolve one public attachment table key to mutable raw document rows."""

    table_path: tuple[str, ...]
    read_rows: RawRowsReader
    source: AttachmentAdapterSource

    def rows(self, tables: dict[str, Any]) -> list[dict[str, Any]]:
        return list(self.read_rows(tables))

    def find_row(self, tables: dict[str, Any], row_id: str) -> dict[str, Any] | None:
        return next((row for row in self.read_rows(tables) if row.get("id") == row_id), None)


def get_attachment_table_adapter(table_key: str) -> AttachmentTableAdapter | None:
    """Return the table-shape adapter without authorizing an attachment field."""

    return _ATTACHMENT_TABLE_ADAPTERS.get(table_key)


def iter_attachment_rows(tables: dict[str, Any], table_key: str) -> list[dict[str, Any]]:
    adapter = get_attachment_table_adapter(table_key)
    return adapter.rows(tables) if adapter is not None else []


def find_attachment_row(tables: dict[str, Any], table_key: str, row_id: str) -> dict[str, Any] | None:
    adapter = get_attachment_table_adapter(table_key)
    return adapter.find_row(tables, row_id) if adapter is not None else None


def attachment_table_rows(value: object) -> list[dict[str, Any]]:
    """Normalize a bare row list or a FieldDef table envelope."""

    if isinstance(value, dict):
        envelope = cast(dict[str, object], value)
        if isinstance(envelope.get("rows"), list):
            return _dict_rows(envelope["rows"])
    return _dict_rows(value)


def _build_attachment_table_adapters() -> dict[str, AttachmentTableAdapter]:
    adapters = {
        contract.attachment_table_key or contract.name: _direct_adapter(
            contract.table_path,
            source="table_contract",
        )
        for contract in iter_table_contracts()
        if contract.table_path
    }
    adapters.update(_IRREGULAR_ADAPTERS)
    return adapters


def _direct_adapter(
    table_path: tuple[str, ...],
    *,
    source: AttachmentAdapterSource,
) -> AttachmentTableAdapter:
    def read_rows(tables: dict[str, Any]) -> list[dict[str, Any]]:
        value: object = tables
        for path_part in table_path:
            if not isinstance(value, dict):
                return []
            value = value.get(path_part)
        return attachment_table_rows(value)

    return AttachmentTableAdapter(
        table_path=table_path,
        read_rows=read_rows,
        source=source,
    )


def _assembly_segment_rows(tables: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for assembly in attachment_table_rows(tables.get("assemblies")):
        for layer in attachment_table_rows(assembly.get("layers")):
            yield from attachment_table_rows(layer.get("segments"))


def _dict_rows(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


_IRREGULAR_ADAPTERS: dict[str, AttachmentTableAdapter] = {
    "project_frames": _direct_adapter(
        ("project_frames",),
        source="irregular_project_table",
    ),
    "project_glazings": _direct_adapter(
        ("project_glazings",),
        source="irregular_project_table",
    ),
    "assembly_segments": AttachmentTableAdapter(
        table_path=("assemblies", "layers", "segments"),
        read_rows=_assembly_segment_rows,
        source="nested_flattening_adapter",
    ),
}

_ATTACHMENT_TABLE_ADAPTERS = _build_attachment_table_adapters()
