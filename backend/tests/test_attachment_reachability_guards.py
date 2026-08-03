"""Structural guards for project-document attachment reachability."""

from __future__ import annotations

import copy
import inspect
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, cast, get_args, get_origin

import pytest
from pydantic import BaseModel

from features.assets.registry import (
    ATTACHMENT_FIELDS,
    AttachmentFieldConfig,
    iter_rows_for_raw_tables,
    list_asset_references,
)
from features.assets.table_adapters import get_attachment_table_adapter
from features.project_document import envelope_models, rows
from features.project_document.document import ProjectDocumentTables
from features.project_document.envelope_models import AssemblySegment, ProjectFrame, ProjectGlazing
from features.project_document.tables.registry import iter_table_contracts
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest


@dataclass(frozen=True)
class AttachmentSchema:
    table_key: str
    row_model: type[BaseModel]
    table_path: tuple[str, ...]


_IRREGULAR_ATTACHMENT_SCHEMAS = (
    AttachmentSchema("assembly_segments", AssemblySegment, ("assemblies", "layers", "segments")),
    AttachmentSchema("project_frames", ProjectFrame, ("project_frames",)),
    AttachmentSchema("project_glazings", ProjectGlazing, ("project_glazings",)),
)


def _attachment_schemas() -> tuple[AttachmentSchema, ...]:
    contract_schemas = (
        AttachmentSchema(contract.attachment_table_key or contract.name, contract.schema_model, contract.table_path)
        for contract in iter_table_contracts()
        if any(key.endswith("_asset_ids") for key in contract.schema_model.model_fields)
    )
    return (*contract_schemas, *_IRREGULAR_ATTACHMENT_SCHEMAS)


_ATTACHMENT_SCHEMAS = _attachment_schemas()
_BASE_TABLES = empty_project_document(CreateProjectRequest(name="attachment guard", bt_number="0000")).model_dump(
    mode="json"
)["tables"]


def _module_attachment_models() -> set[type[BaseModel]]:
    discovered: set[type[BaseModel]] = set()
    for module in (rows, envelope_models):
        for _name, candidate in inspect.getmembers(module, inspect.isclass):
            if (
                issubclass(candidate, BaseModel)
                and candidate.__module__ == module.__name__
                and any(key.endswith("_asset_ids") for key in candidate.model_fields)
            ):
                discovered.add(candidate)
    return discovered


def _assert_attachment_columns_registered(configs: Iterable[AttachmentFieldConfig]) -> None:
    registered = {(config.table_key, config.field_key) for config in configs}
    covered_models = {schema.row_model for schema in _ATTACHMENT_SCHEMAS}
    unaccounted_models = _module_attachment_models() - covered_models
    assert not unaccounted_models, (
        "Project-document row models with attachment columns are missing from the structural guard: "
        f"{sorted(model.__name__ for model in unaccounted_models)}"
    )

    for schema in _ATTACHMENT_SCHEMAS:
        for field_key in schema.row_model.model_fields:
            if not field_key.endswith("_asset_ids"):
                continue
            attachment_key = f"{schema.table_key}.{field_key}"
            assert (schema.table_key, field_key) in registered, (
                f"{attachment_key} is a document attachment column with no ATTACHMENT_FIELDS entry — "
                "anonymous viewers cannot see it and the orphan sweeper will treat its assets as garbage."
            )


def _table_path(table_key: str) -> tuple[str, ...]:
    adapter = get_attachment_table_adapter(table_key)
    assert adapter is not None
    return adapter.table_path


def _replace_rows_at_contract_path(
    tables: dict[str, Any],
    table_key: str,
    rows_value: object,
) -> None:
    """Inject rows using the document table contract, independent of the walker."""

    container: dict[str, Any] = tables
    container_model: type[BaseModel] = ProjectDocumentTables
    path = _table_path(table_key)
    for index, part in enumerate(path):
        if index == len(path) - 1:
            container[part] = rows_value
            return
        annotation = container_model.model_fields[part].annotation
        child = container.get(part)
        if get_origin(annotation) is list:
            child_model = get_args(annotation)[0]
            next_child = cast(dict[str, Any], child[0]) if isinstance(child, list) and child else {}
            container[part] = [next_child]
            container = next_child
            container_model = child_model
        else:
            next_child = cast(dict[str, Any], child) if isinstance(child, dict) else {}
            container[part] = next_child
            container = next_child
            container_model = cast(type[BaseModel], annotation)


def _real_row_shape(tables: dict[str, Any], table_key: str, row: dict[str, Any]) -> object:
    container: object = tables
    for part in _table_path(table_key):
        if isinstance(container, list):
            container = container[0] if container else None
        if not isinstance(container, dict):
            break
        container = container.get(part)
    if isinstance(container, dict) and "rows" in container:
        return {**container, "rows": [row]}
    return [row]


class _RawDocument:
    def __init__(self, tables: dict[str, Any]) -> None:
        self.tables = tables

    def model_dump(self, mode: str | None = None) -> dict[str, Any]:
        return {"tables": self.tables}


def test_every_document_attachment_column_is_registered() -> None:
    _assert_attachment_columns_registered(ATTACHMENT_FIELDS)


def test_contract_backed_attachment_adapters_derive_registered_table_paths() -> None:
    irregular = {schema.table_key for schema in _IRREGULAR_ATTACHMENT_SCHEMAS}
    contracts = {contract.attachment_table_key or contract.name: contract for contract in iter_table_contracts()}

    for table_key in {field.table_key for field in ATTACHMENT_FIELDS} - irregular:
        adapter = get_attachment_table_adapter(table_key)
        assert adapter is not None
        assert adapter.source == "table_contract"
        assert adapter.table_path == contracts[table_key].table_path


def test_irregular_attachment_adapters_are_explicit() -> None:
    expected = {
        "project_frames": (("project_frames",), "irregular_project_table"),
        "project_glazings": (("project_glazings",), "irregular_project_table"),
        "assembly_segments": (("assemblies", "layers", "segments"), "nested_flattening_adapter"),
    }

    for table_key, (table_path, source) in expected.items():
        adapter = get_attachment_table_adapter(table_key)
        assert adapter is not None
        assert adapter.table_path == table_path
        assert adapter.source == source


def test_every_registered_attachment_field_is_reachable() -> None:
    fields_by_table: dict[str, list[AttachmentFieldConfig]] = defaultdict(list)
    for field in ATTACHMENT_FIELDS:
        fields_by_table[field.table_key].append(field)

    for table_key, fields in fields_by_table.items():
        tables = copy.deepcopy(_BASE_TABLES)
        asset_ids = {field.key: f"asset_guard_{field.key.replace('.', '_')}" for field in fields}
        row = {
            "id": f"row_guard_{table_key}",
            "name": "guard",
            **{field.field_key: [asset_ids[field.key]] for field in fields},
        }
        _replace_rows_at_contract_path(tables, table_key, _real_row_shape(tables, table_key, row))

        rows_walked = iter_rows_for_raw_tables(tables, table_key)
        references = list_asset_references(cast(Any, _RawDocument(tables)))

        for field in fields:
            assert rows_walked, (
                f"{field.key} is registered but its real table shape yields zero rows — "
                "anonymous viewers cannot see its assets and the orphan sweeper will treat them as garbage."
            )
            assert any(reference["asset_id"] == asset_ids[field.key] for reference in references), (
                f"{field.key} is registered and its row is walkable, but list_asset_references dropped the field."
            )


@pytest.mark.parametrize("table_key", sorted({field.table_key for field in ATTACHMENT_FIELDS}))
@pytest.mark.parametrize("enveloped", [False, True], ids=["bare-list", "rows-envelope"])
def test_attachment_row_walker_tolerates_bare_lists_and_envelopes(table_key: str, enveloped: bool) -> None:
    tables = copy.deepcopy(_BASE_TABLES)
    row = {"id": f"row_shape_{table_key}"}
    rows_value: object = {"field_defs": [], "rows": [row]} if enveloped else [row]

    _replace_rows_at_contract_path(tables, table_key, rows_value)

    walked = iter_rows_for_raw_tables(tables, table_key)
    assert len(walked) == 1
    assert walked[0]["id"] == row["id"]
