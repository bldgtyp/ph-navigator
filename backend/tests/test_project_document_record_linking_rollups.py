"""Record-linking Phase 3 rollup formula tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import ProjectDocumentV1, PumpRow, RoomRow
from features.project_document.formula import ast_to_json, build_field_registry, parse, resolve_refs
from features.project_document.formula.ast_nodes import FieldAccess, FuncCall, LinkedFromRef, LinkedRef
from features.project_document.formula.errors import FormulaUnsupportedFunctionError
from features.project_document.tables.pumps import pumps_response
from features.project_document.tables.rooms import rooms_field_registry, rooms_response
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def _empty_body() -> ProjectDocumentV1:
    return empty_project_document(
        CreateProjectRequest(
            name="t",
            bt_number="1",
            cert_programs=[],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )


def _field(
    field_key: str,
    display_name: str,
    field_type: CustomFieldType,
    config: dict[str, object] | None = None,
) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=field_type,
        config=config or {},
        created_at=datetime.now(UTC),
        origin="custom",
    )


def _resolved_rooms_formula(body: ProjectDocumentV1, source: str) -> dict[str, object]:
    ast = parse(source)
    resolved = resolve_refs(ast, build_field_registry(rooms_field_registry, body))
    return {
        "source": source,
        "ast": ast_to_json(resolved),
        "deps": ["num_people"],
        "result_type": "number",
    }


def _parsed_formula_config(source: str) -> dict[str, object]:
    return {
        "source": source,
        "ast": ast_to_json(parse(source)),
        "deps": [],
        "result_type": "number",
    }


def test_parser_accepts_linked_rollup_primitives() -> None:
    forward = parse('avg(linked("cf_pumps").cf_wattage)')
    assert isinstance(forward, FuncCall)
    assert forward.name == "avg"
    assert isinstance(forward.args[0], FieldAccess)
    assert isinstance(forward.args[0].target, LinkedRef)
    assert forward.args[0].target.field_key == "cf_pumps"

    inverse = parse('sum(linked_from(rooms, "cf_pumps").cf_wattage)')
    assert isinstance(inverse, FuncCall)
    assert inverse.name == "sum"
    assert isinstance(inverse.args[0], FieldAccess)
    assert isinstance(inverse.args[0].target, LinkedFromRef)
    assert inverse.args[0].target.source_table_path == ("rooms",)
    assert inverse.args[0].target.source_field_key == "cf_pumps"


@pytest.mark.parametrize("source", ["min({A})", "max({A})", "array_join({A})", "count_unique({A})"])
def test_parser_rejects_deferred_rollup_functions(source: str) -> None:
    with pytest.raises(FormulaUnsupportedFunctionError) as excinfo:
        parse(source)

    assert excinfo.value.error_code == "formula_function_not_supported"


def test_pumps_response_computes_inverse_count_sum_and_formula_chain() -> None:
    body = _empty_body()
    linked_field = _field(
        "cf_pumps",
        "Pump",
        CustomFieldType.linked_record,
        {"target_table_path": ["equipment", "pumps"], "max_links": None},
    )
    wattage_field = _field("cf_wattage", "Wattage", CustomFieldType.number)
    room_formula = _field(
        "cf_load",
        "Load",
        CustomFieldType.formula,
        _resolved_rooms_formula(body, "{People} * 10"),
    )
    pump_count = _field(
        "cf_room_count",
        "Room Count",
        CustomFieldType.formula,
        _parsed_formula_config('count(linked_from(rooms, "cf_pumps"))'),
    )
    pump_total = _field(
        "cf_total_watts",
        "Total Watts",
        CustomFieldType.formula,
        _parsed_formula_config('sum(linked_from(rooms, "cf_pumps").cf_wattage)'),
    )
    pump_formula_chain = _field(
        "cf_total_load",
        "Total Load",
        CustomFieldType.formula,
        _parsed_formula_config('sum(linked_from(rooms, "cf_pumps").cf_load)'),
    )

    rooms = [
        RoomRow(
            id="rm_a",
            custom_values={"num_people": 2, "cf_wattage": 100},
            custom_links={"cf_pumps": ["pmp_a"]},
        ),
        RoomRow(
            id="rm_b",
            custom_values={"num_people": 3, "cf_wattage": 150},
            custom_links={"cf_pumps": ["pmp_a", "pmp_missing"]},
        ),
        RoomRow(
            id="rm_c",
            custom_values={"num_people": 4, "cf_wattage": 200},
            custom_links={"cf_pumps": ["pmp_b"]},
        ),
    ]
    pumps = [PumpRow(id="pmp_a"), PumpRow(id="pmp_b")]
    body = body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "rooms": body.tables.rooms.model_copy(
                        update={
                            "field_defs": [*body.tables.rooms.field_defs, linked_field, wattage_field, room_formula],
                            "rows": rooms,
                        }
                    ),
                    "equipment": body.tables.equipment.model_copy(
                        update={
                            "pumps": body.tables.equipment.pumps.model_copy(
                                update={
                                    "field_defs": [
                                        *body.tables.equipment.pumps.field_defs,
                                        pump_count,
                                        pump_total,
                                        pump_formula_chain,
                                    ],
                                    "rows": pumps,
                                }
                            )
                        }
                    ),
                }
            )
        }
    )

    response = pumps_response(
        project_id=uuid4(),
        version_id=uuid4(),
        source="version",
        version_etag="v",
        draft_etag=None,
        body=body,
    )

    assert response.rows_computed["pmp_a"]["cf_room_count"] == 2.0
    assert response.rows_computed["pmp_a"]["cf_total_watts"] == 250.0
    assert response.rows_computed["pmp_a"]["cf_total_load"] == 50.0
    assert response.rows_computed["pmp_b"]["cf_room_count"] == 1.0
    assert response.rows_computed["pmp_b"]["cf_total_watts"] == 200.0


def test_rooms_response_computes_forward_linked_avg() -> None:
    body = _empty_body()
    linked_field = _field(
        "cf_pumps",
        "Pump",
        CustomFieldType.linked_record,
        {"target_table_path": ["equipment", "pumps"], "max_links": None},
    )
    avg_field = _field(
        "cf_avg_pump_watts",
        "Avg Pump Watts",
        CustomFieldType.formula,
        _parsed_formula_config('avg(linked("cf_pumps").wattage)'),
    )
    room = RoomRow(id="rm_a", custom_links={"cf_pumps": ["pmp_a", "pmp_b", "pmp_missing"]})
    pumps = [
        PumpRow(id="pmp_a", custom_values={"wattage": 100}),
        PumpRow(id="pmp_b", custom_values={"wattage": 200}),
    ]
    body = body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "rooms": body.tables.rooms.model_copy(
                        update={
                            "field_defs": [*body.tables.rooms.field_defs, linked_field, avg_field],
                            "rows": [room],
                        }
                    ),
                    "equipment": body.tables.equipment.model_copy(
                        update={"pumps": body.tables.equipment.pumps.model_copy(update={"rows": pumps})}
                    ),
                }
            )
        }
    )

    response = rooms_response(
        project_id=uuid4(),
        version_id=uuid4(),
        source="version",
        version_etag="v",
        draft_etag=None,
        body=body,
    )

    assert response.rows_computed["rm_a"]["cf_avg_pump_watts"] == 150.0
