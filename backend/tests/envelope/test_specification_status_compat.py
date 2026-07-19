"""Release-A compatibility contract for built-in specification statuses."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from features.envelope.models import EnvelopeCommandRequest
from features.envelope.table_contracts import (
    ProjectMaterialMutation,
    ProjectMaterialsReplaceRequest,
    apply_project_materials_replace,
)
from features.project_document.document import ProjectMaterial
from tests.envelope.test_envelope_document_contracts import envelope_body, project_material


@pytest.mark.parametrize(
    "command",
    [
        {
            "kind": "update_project_material",
            "project_material_id": "pmat_1",
            "specification_status": "needed",
        },
        {
            "kind": "update_project_glazing",
            "project_glazing_id": "pglz_1",
            "specification_status": "needed",
        },
        {
            "kind": "update_project_frame",
            "project_frame_id": "pfrm_1",
            "specification_status": "needed",
        },
    ],
)
@pytest.mark.parametrize("input_status", ["missing", "needed"])
def test_public_commands_normalize_release_a_inputs_to_schema_v7_missing(
    command: dict[str, object], input_status: str
) -> None:
    command["specification_status"] = input_status
    parsed = EnvelopeCommandRequest.model_validate({"command": command})

    assert parsed.command.model_dump(mode="json")["specification_status"] == "missing"


@pytest.mark.parametrize(
    "kind,id_key",
    [
        ("update_project_material", "project_material_id"),
        ("update_project_glazing", "project_glazing_id"),
        ("update_project_frame", "project_frame_id"),
    ],
)
def test_public_commands_still_reject_unrelated_statuses(kind: str, id_key: str) -> None:
    with pytest.raises(ValidationError):
        EnvelopeCommandRequest.model_validate(
            {"command": {"kind": kind, id_key: "row_1", "specification_status": "unknown"}}
        )


def test_table_mutation_normalizes_needed_without_loosening_persisted_model() -> None:
    raw = project_material(specification_status="needed")

    assert ProjectMaterialMutation.model_validate(raw).specification_status == "missing"
    with pytest.raises(ValidationError):
        ProjectMaterial.model_validate(raw)


def test_unchanged_table_mutation_preserves_document_identity() -> None:
    body = envelope_body()
    request = ProjectMaterialsReplaceRequest.model_validate(
        {"rows": [row.model_dump(mode="json") for row in body.tables.project_materials]}
    )

    assert apply_project_materials_replace(body, request) is body
