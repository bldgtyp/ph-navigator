"""Strict canonical specification-status contract after Phase 07 adapter retirement."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from features.envelope.models import EnvelopeCommandRequest
from features.envelope.table_contracts import (
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
def test_public_commands_accept_canonical_needed(command: dict[str, object]) -> None:
    parsed = EnvelopeCommandRequest.model_validate({"command": command})

    assert parsed.commands[0].model_dump(mode="json")["specification_status"] == "needed"


@pytest.mark.parametrize(
    "kind,id_key",
    [
        ("update_project_material", "project_material_id"),
        ("update_project_glazing", "project_glazing_id"),
        ("update_project_frame", "project_frame_id"),
    ],
)
@pytest.mark.parametrize("invalid_status", ["missing", "unknown"])
def test_public_commands_reject_legacy_missing_and_unrelated_statuses(
    kind: str, id_key: str, invalid_status: str
) -> None:
    with pytest.raises(ValidationError):
        EnvelopeCommandRequest.model_validate(
            {"command": {"kind": kind, id_key: "row_1", "specification_status": invalid_status}}
        )


def test_table_mutation_rejects_legacy_missing() -> None:
    raw = project_material(specification_status="missing")

    with pytest.raises(ValidationError):
        ProjectMaterialsReplaceRequest.model_validate({"rows": [raw]})
    with pytest.raises(ValidationError):
        ProjectMaterial.model_validate(raw)


def test_unchanged_table_mutation_preserves_document_identity() -> None:
    body = envelope_body()
    request = ProjectMaterialsReplaceRequest.model_validate(
        {"rows": [row.model_dump(mode="json") for row in body.tables.project_materials]}
    )

    assert apply_project_materials_replace(body, request) is body
