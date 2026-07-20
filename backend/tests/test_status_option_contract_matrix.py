"""Contract matrix for the twelve DataTables carrying the built-in `status` field.

The specification-status rename moved the *typed* Materials/Glazings/Frames
literal from `missing` to `needed` (schema v8). The DataTable family stores the
same semantic as a stable single-select **option id** instead, and D-2 keeps
those ids untouched: `opt_status_needed` is persisted in real documents and
renaming it would be a data migration, not a value rename.

This matrix is the regression that pins that boundary. It walks every table in
`STATUS_TABLE_NAMES` — Thermal Bridges, the seven Equipment tables, and all four
Heat Pump leaves — rather than trusting per-table tests to stay in step, and it
reuses the same assertions those per-table tests call.
"""

from __future__ import annotations

import pytest

from features.project_document.document import ProjectDocumentV1
from features.project_document.tables._status_field import (
    STATUS_OPTION_NEEDED,
    STATUS_TABLE_NAMES,
    status_option_key,
)
from features.project_document.tables.registry import get_table_contract
from features.project_document.templates import empty_project_document
from features.projects.models import CreateProjectRequest
from tests.status_field_helpers import assert_status_field_def, assert_status_options


@pytest.fixture(scope="module")
def seeded_document() -> ProjectDocumentV1:
    return empty_project_document(CreateProjectRequest(name="Status Matrix", bt_number="2426", cert_programs=[]))


def test_matrix_covers_every_status_bearing_table() -> None:
    """Guard the guard: a table added to the family must appear here too."""

    assert len(STATUS_TABLE_NAMES) == 12


@pytest.mark.parametrize("table_name", STATUS_TABLE_NAMES)
def test_status_field_and_options_hold_the_stable_needed_contract(
    table_name: str, seeded_document: ProjectDocumentV1
) -> None:
    options = {
        key: [option.model_dump(mode="json") for option in value]
        for key, value in seeded_document.single_select_options.items()
    }
    registry = get_table_contract(table_name).field_registry
    assert registry is not None
    field_defs = [field.model_dump(mode="json") for field in registry.read_field_defs(seeded_document)]

    assert_status_options(options, table_name)
    assert_status_field_def(field_defs)

    # The option the rename must NOT touch, and the label it must read as.
    labels = {option["id"]: option["label"] for option in options[status_option_key(table_name)]}
    assert labels[STATUS_OPTION_NEEDED] == "Needed"
    assert "Missing" not in labels.values()
