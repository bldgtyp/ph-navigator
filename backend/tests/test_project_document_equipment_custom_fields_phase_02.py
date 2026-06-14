"""Equipment custom-fields Phase 02 backend registry rollout tests."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import pytest

from features.project_document.custom_fields import CustomFieldType
from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_KEYS
from features.project_document.tables.contracts import table_path_option_namespace
from features.project_document.tables.electric_heaters import ELECTRIC_HEATERS_BUILT_IN_FIELD_KEYS
from features.project_document.tables.fans import FANS_BUILT_IN_FIELD_KEYS
from features.project_document.tables.hot_water_heaters import HOT_WATER_HEATERS_BUILT_IN_FIELD_KEYS
from features.project_document.tables.hot_water_tanks import HOT_WATER_TANKS_BUILT_IN_FIELD_KEYS
from features.project_document.tables.registry import get_table_contract
from features.project_document.tables.thermal_bridges import THERMAL_BRIDGES_BUILT_IN_FIELD_KEYS
from features.project_document.tables.ventilators import VENTILATORS_BUILT_IN_FIELD_KEYS
from tests.project_document_helpers import custom_fields_from_slice, field_defs_fingerprint
from tests.test_project_document import ORIGIN, create_project, signed_in_client
from tests.test_project_document_appliances import appliance_payload
from tests.test_project_document_electric_heaters import electric_heater_payload
from tests.test_project_document_fans import fan_payload
from tests.test_project_document_hot_water_heaters import hot_water_heater_payload
from tests.test_project_document_hot_water_tanks import hot_water_tank_payload
from tests.test_project_document_thermal_bridges import thermal_bridge_payload
from tests.test_project_document_ventilators import ventilator_payload


@dataclass(frozen=True)
class TableCase:
    table_key: str
    payload_key: str
    payload_factory: Callable[[], dict[str, Any]]
    built_in_field_keys: tuple[str, ...]


TABLE_CASES: tuple[TableCase, ...] = (
    TableCase("ventilators", "ventilators", ventilator_payload, VENTILATORS_BUILT_IN_FIELD_KEYS),
    TableCase("fans", "fans", fan_payload, FANS_BUILT_IN_FIELD_KEYS),
    TableCase(
        "hot_water_heaters",
        "hot_water_heaters",
        hot_water_heater_payload,
        HOT_WATER_HEATERS_BUILT_IN_FIELD_KEYS,
    ),
    TableCase(
        "hot_water_tanks",
        "hot_water_tanks",
        hot_water_tank_payload,
        HOT_WATER_TANKS_BUILT_IN_FIELD_KEYS,
    ),
    TableCase(
        "electric_heaters",
        "electric_heaters",
        electric_heater_payload,
        ELECTRIC_HEATERS_BUILT_IN_FIELD_KEYS,
    ),
    TableCase("appliances", "appliances", appliance_payload, APPLIANCES_BUILT_IN_FIELD_KEYS),
    TableCase(
        "thermal_bridges",
        "thermal_bridges",
        thermal_bridge_payload,
        THERMAL_BRIDGES_BUILT_IN_FIELD_KEYS,
    ),
)


def draft_table_url(project_id: object, version_id: object, table_key: str) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/{table_key}"


def mutate_table_url(project_id: object, version_id: object, table_key: str) -> str:
    return f"{draft_table_url(project_id, version_id, table_key)}/custom-fields:mutate"


def mutation_headers(slice_body: dict[str, Any]) -> dict[str, str]:
    headers = {"Origin": ORIGIN}
    if slice_body["source"] == "draft":
        headers["If-Match"] = slice_body["draft_etag"]
    else:
        headers["If-Match-Version"] = slice_body["version_etag"]
    return headers


def add_field_mutation(
    *,
    table_key: str,
    fingerprint: str,
    field_key: str = "cf_phase_02",
    display_name: str = "Phase 02 Notes",
    field_type: CustomFieldType = CustomFieldType.short_text,
    initial_options: list[dict[str, object]] | None = None,
) -> dict[str, Any]:
    mutation: dict[str, Any] = {
        "kind": "addField",
        "table_key": table_key,
        "after": {
            "field_key": field_key,
            "display_name": display_name,
            "field_type": field_type.value,
            "config": {},
            "description": None,
            "created_at": "2026-06-13T13:00:00Z",
            "created_by": None,
        },
        "expected_schema_fingerprint": fingerprint,
    }
    if initial_options is not None:
        mutation["initial_options"] = initial_options
    return mutation


def delete_field_mutation(*, table_key: str, field_key: str, fingerprint: str) -> dict[str, Any]:
    return {
        "kind": "deleteField",
        "table_key": table_key,
        "field_id": field_key,
        "clear_values": True,
        "expected_schema_fingerprint": fingerprint,
    }


def set_formula_mutation(*, table_key: str, field_key: str, fingerprint: str, source: str) -> dict[str, Any]:
    return {
        "kind": "setFormula",
        "table_key": table_key,
        "field_id": field_key,
        "source": source,
        "expected_schema_fingerprint": fingerprint,
    }


@pytest.mark.parametrize("case", TABLE_CASES, ids=[case.table_key for case in TABLE_CASES])
def test_phase_02_target_contract_exposes_field_registry(case: TableCase) -> None:
    contract = get_table_contract(case.table_key)

    assert contract.field_registry is not None
    assert contract.field_registry.field_keys == case.built_in_field_keys
    assert contract.field_registry.option_list_namespace_prefix == table_path_option_namespace(contract.table_path)


@pytest.mark.parametrize("case", TABLE_CASES, ids=[case.table_key for case in TABLE_CASES])
def test_phase_02_add_field_succeeds_on_every_target_table(
    clean_document_tables: None,
    case: TableCase,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, case.table_key))
    assert initial.status_code == 200
    response = client.post(
        mutate_table_url(project_id, version_id, case.table_key),
        headers=mutation_headers(initial.json()),
        json=add_field_mutation(
            table_key=case.table_key,
            fingerprint=field_defs_fingerprint(initial.json()["field_defs"]),
        ),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert [field["field_key"] for field in custom_fields_from_slice(body)] == ["cf_phase_02"]

    refetch = client.get(draft_table_url(project_id, version_id, case.table_key))
    assert refetch.status_code == 200
    assert [field["field_key"] for field in custom_fields_from_slice(refetch.json())] == ["cf_phase_02"]


@pytest.mark.parametrize("case", TABLE_CASES, ids=[case.table_key for case in TABLE_CASES])
def test_phase_04_target_response_includes_formula_overlay(
    clean_document_tables: None,
    case: TableCase,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, case.table_key))
    assert initial.status_code == 200
    added = client.post(
        mutate_table_url(project_id, version_id, case.table_key),
        headers=mutation_headers(initial.json()),
        json=add_field_mutation(
            table_key=case.table_key,
            fingerprint=field_defs_fingerprint(initial.json()["field_defs"]),
            field_key="cf_tag_copy",
            display_name="Tag Copy",
            field_type=CustomFieldType.formula,
        ),
    )
    assert added.status_code == 200, added.text

    payload = case.payload_factory()
    payload["field_defs"] = added.json()["field_defs"]
    write = client.put(
        draft_table_url(project_id, version_id, case.table_key),
        headers=mutation_headers(added.json()),
        json=payload,
    )
    assert write.status_code == 200, write.text

    formula = client.post(
        mutate_table_url(project_id, version_id, case.table_key),
        headers=mutation_headers(write.json()),
        json=set_formula_mutation(
            table_key=case.table_key,
            field_key="cf_tag_copy",
            fingerprint=field_defs_fingerprint(write.json()["field_defs"]),
            source="{Tag}",
        ),
    )

    assert formula.status_code == 200, formula.text
    body = formula.json()
    row = payload[case.payload_key][0]
    assert body["rows_computed"][row["id"]]["cf_tag_copy"] == row["custom_values"]["record_id"]


@pytest.mark.parametrize(
    "case",
    (
        next(case for case in TABLE_CASES if case.table_key == "electric_heaters"),
        next(case for case in TABLE_CASES if case.table_key == "fans"),
    ),
    ids=["simple-electric-heaters", "attachment-heavy-fans"],
)
def test_phase_02_delete_field_clears_custom_values_on_nested_equipment_tables(
    clean_document_tables: None,
    case: TableCase,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, case.table_key))
    assert initial.status_code == 200
    added = client.post(
        mutate_table_url(project_id, version_id, case.table_key),
        headers=mutation_headers(initial.json()),
        json=add_field_mutation(
            table_key=case.table_key,
            fingerprint=field_defs_fingerprint(initial.json()["field_defs"]),
        ),
    )
    assert added.status_code == 200, added.text

    payload = case.payload_factory()
    payload["field_defs"] = added.json()["field_defs"]
    payload[case.payload_key][0]["custom_values"]["cf_phase_02"] = "to be cleared"
    write = client.put(
        draft_table_url(project_id, version_id, case.table_key),
        headers=mutation_headers(added.json()),
        json=payload,
    )
    assert write.status_code == 200, write.text
    assert write.json()[case.payload_key][0]["custom_values"]["cf_phase_02"] == "to be cleared"

    deleted = client.post(
        mutate_table_url(project_id, version_id, case.table_key),
        headers=mutation_headers(write.json()),
        json=delete_field_mutation(
            table_key=case.table_key,
            field_key="cf_phase_02",
            fingerprint=field_defs_fingerprint(write.json()["field_defs"]),
        ),
    )

    assert deleted.status_code == 200, deleted.text
    assert custom_fields_from_slice(deleted.json()) == []
    assert "cf_phase_02" not in deleted.json()[case.payload_key][0]["custom_values"]


def test_phase_02_custom_single_select_options_use_nested_table_path_namespace(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, "fans"))
    assert initial.status_code == 200
    response = client.post(
        mutate_table_url(project_id, version_id, "fans"),
        headers=mutation_headers(initial.json()),
        json=add_field_mutation(
            table_key="fans",
            fingerprint=field_defs_fingerprint(initial.json()["field_defs"]),
            field_key="cf_status",
            display_name="Status",
            field_type=CustomFieldType.single_select,
            initial_options=[{"id": "opt_status_basis", "label": "Basis", "color": "#0ea5e9", "order": 0}],
        ),
    )

    assert response.status_code == 200, response.text
    assert response.json()["single_select_options"]["equipment.fans.cf_status"][0]["id"] == "opt_status_basis"
    assert "fans.cf_status" not in response.json()["single_select_options"]


def test_phase_02_builtin_option_edit_still_updates_representative_table(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, "fans"))
    assert initial.status_code == 200
    payload = fan_payload()
    payload["field_defs"] = initial.json()["field_defs"]
    write = client.put(
        draft_table_url(project_id, version_id, "fans"),
        headers=mutation_headers(initial.json()),
        json=payload,
    )
    assert write.status_code == 200, write.text

    response = client.post(
        mutate_table_url(project_id, version_id, "fans"),
        headers=mutation_headers(write.json()),
        json={
            "kind": "editOptions",
            "table_key": "fans",
            "field_id": "fan_type",
            "next_options": [
                {"id": "opt_fan_dryer", "label": "1-Dryer", "color": "#f97316", "order": 0},
                {"id": "opt_fan_user_defined", "label": "3-User Defined", "color": "#8b5cf6", "order": 1},
            ],
            "replacements": {"opt_fan_kitchen_hood": "opt_fan_user_defined"},
            "expected_schema_fingerprint": field_defs_fingerprint(write.json()["field_defs"]),
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["fans"][0]["fan_type"] == "opt_fan_user_defined"
    assert [option["id"] for option in response.json()["single_select_options"]["fans.type"]] == [
        "opt_fan_dryer",
        "opt_fan_user_defined",
    ]


def test_phase_02_table_key_mismatch_still_rejects(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_table_url(project_id, version_id, "thermal_bridges"))
    assert initial.status_code == 200
    response = client.post(
        mutate_table_url(project_id, version_id, "thermal_bridges"),
        headers=mutation_headers(initial.json()),
        json=add_field_mutation(
            table_key="fans",
            fingerprint=field_defs_fingerprint(initial.json()["field_defs"]),
        ),
    )

    assert response.status_code == 422
    assert response.json()["error_code"] == "custom_field_invalid_field_id"
    assert response.json()["details"] == {"table_key": "fans", "path_table_name": "thermal_bridges"}
