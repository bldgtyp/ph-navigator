"""Shared option-list cascade for `editOptions` (Phase 3b increment 2a).

`heat_pumps.manufacturer` is one document-level single-select list referenced by
both the outdoor- and indoor-equip leaves. Deleting a manufacturer option must
clear it on **every** binding — not just the table the edit was addressed to —
or the sibling leaf's rows dangle and the document validator rejects the write.
"""

from __future__ import annotations

from typing import Any, cast

from features.heat_pumps.models import HEAT_PUMP_MANUFACTURER_OPTION_KEY
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.mutations.models import EditOptionsMutation
from features.project_document.mutations.options_ops import apply_edit_options
from features.project_document.tables.heat_pumps import outdoor_equip_field_registry
from tests.features.heat_pumps.test_heat_pumps import indoor_equip, outdoor_equip
from tests.project_document_helpers import empty_required_tables

MFR_A = "opt_mfr_a"
MFR_B = "opt_mfr_b"


def _manufacturer_option(option_id: str, label: str, order: float) -> SingleSelectOption:
    return SingleSelectOption(id=option_id, label=label, color="#112233", order=order)


def _document_with_shared_manufacturer() -> ProjectDocumentV1:
    """Both equip leaves carry one row pointing at the shared `MFR_A` option."""
    tables = empty_required_tables()
    heat_pumps = tables["equipment"]["heat_pumps"]
    heat_pumps["outdoor_equip"]["rows"] = [outdoor_equip(manufacturer=MFR_A)]
    heat_pumps["indoor_equip"]["rows"] = [indoor_equip(manufacturer=MFR_A)]
    return ProjectDocumentV1.model_validate(
        {
            "schema_version": 1,
            "project": {"name": "p", "bt_number": "1", "cert_programs": []},
            "tables": tables,
            "single_select_options": {
                HEAT_PUMP_MANUFACTURER_OPTION_KEY: [
                    _manufacturer_option(MFR_A, "Mitsubishi", 1.0),
                    _manufacturer_option(MFR_B, "Daikin", 2.0),
                ],
            },
        }
    )


def _outdoor_manufacturer(body: ProjectDocumentV1) -> str | None:
    return cast(Any, body.tables.equipment.heat_pumps.outdoor_equip.rows[0]).manufacturer


def _indoor_manufacturer(body: ProjectDocumentV1) -> str | None:
    return cast(Any, body.tables.equipment.heat_pumps.indoor_equip.rows[0]).manufacturer


def test_deleting_shared_manufacturer_clears_both_leaves() -> None:
    body = _document_with_shared_manufacturer()
    assert _outdoor_manufacturer(body) == MFR_A
    assert _indoor_manufacturer(body) == MFR_A

    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="heat_pumps_outdoor_equip",
        field_id="manufacturer",
        next_options=[_manufacturer_option(MFR_B, "Daikin", 1.0)],
        expected_schema_fingerprint="ignored-by-apply",
    )
    next_body, audit = apply_edit_options(body, mutation, outdoor_equip_field_registry)

    # Both leaves are cleared from a single edit addressed to the outdoor leaf.
    assert _outdoor_manufacturer(next_body) is None
    assert _indoor_manufacturer(next_body) is None
    assert audit["cleared_row_count"] == 2
    assert audit["deleted_option_ids"] == [MFR_A]
    # The shared list is rewritten once; both leaves read the same namespace key.
    assert [option.id for option in next_body.single_select_options[HEAT_PUMP_MANUFACTURER_OPTION_KEY]] == [MFR_B]


def test_renaming_shared_manufacturer_leaves_rows_untouched() -> None:
    body = _document_with_shared_manufacturer()
    mutation = EditOptionsMutation(
        kind="editOptions",
        table_key="heat_pumps_outdoor_equip",
        field_id="manufacturer",
        next_options=[
            _manufacturer_option(MFR_A, "Mitsubishi Electric", 1.0),
            _manufacturer_option(MFR_B, "Daikin", 2.0),
        ],
        expected_schema_fingerprint="ignored-by-apply",
    )
    next_body, audit = apply_edit_options(body, mutation, outdoor_equip_field_registry)

    assert _outdoor_manufacturer(next_body) == MFR_A
    assert _indoor_manufacturer(next_body) == MFR_A
    assert audit["cleared_row_count"] == 0
    assert audit["deleted_option_ids"] == []
