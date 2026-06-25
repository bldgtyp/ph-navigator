"""Pumps document shape and table contract tests."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from features.project_document.custom_fields import CustomFieldType
from features.project_document.document import ProjectDocumentV1, PumpRow
from features.project_document.tables import get_table_contract
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS, PUMPS_BUILT_IN_FIELD_KEYS
from tests.builders.assets import insert_project_asset
from tests.project_document_helpers import (
    custom_fields_from_slice,
    empty_pumps_table,
    empty_required_tables,
    field_defs_fingerprint,
)
from tests.status_field_helpers import (
    assert_status_field_def,
    assert_status_options,
    status_options_payload,
)
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def draft_pumps_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/pumps"


def mutate_pumps_url(project_id: object, version_id: object) -> str:
    return f"{draft_pumps_url(project_id, version_id)}/custom-fields:mutate"


def add_field_mutation(
    *,
    fingerprint: str,
    field_key: str = "cf_notes",
    display_name: str = "Pilot Notes",
    table_key: str = "pumps",
) -> dict[str, Any]:
    return {
        "kind": "addField",
        "table_key": table_key,
        "after": {
            "field_key": field_key,
            "display_name": display_name,
            "field_type": CustomFieldType.short_text.value,
            "config": {},
            "description": None,
            "created_at": "2026-06-13T09:30:00Z",
            "created_by": None,
        },
        "expected_schema_fingerprint": fingerprint,
    }


def pump_payload() -> dict[str, Any]:
    return {
        "field_defs": empty_pumps_table()["field_defs"],
        "pumps": [
            {
                "id": "pmp_1",
                "device_type": "opt_circ",
                "phase": 1,
                "notes": None,
                "link": "https://example.com/pump.pdf",
                "datasheet_asset_ids": [],
                "custom_values": {
                    "record_id": "P-1",
                    "use": "DHW recirc",
                    "manufacturer": "Taco",
                    "model": "0015e3",
                    "volts": 120,
                    "horse_power": None,
                    "wattage": 45,
                    "flow_gpm": 15.141647136,
                    "runtime_khr_yr": 2.5,
                },
            }
        ],
        "single_select_options": {
            "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}],
            "pumps.status": status_options_payload(),
        },
    }


def test_pump_row_validates_phase_and_link() -> None:
    base = pump_payload()["pumps"][0]
    assert PumpRow.model_validate(base).custom_values["record_id"] == "P-1"
    with pytest.raises(ValidationError, match="phase must be 1 or 3"):
        PumpRow.model_validate({**base, "phase": 2})
    with pytest.raises(ValidationError, match="link must start"):
        PumpRow.model_validate({**base, "link": "ftp://example.com/pump.pdf"})


def test_document_allows_duplicate_pump_tags() -> None:
    first = pump_payload()["pumps"][0]
    tables = empty_required_tables()
    body = {
        "schema_version": 1,
        "project": {"name": "p", "bt_number": "1", "cert_programs": []},
        "tables": {
            **tables,
            "equipment": {
                **tables["equipment"],
                "pumps": empty_pumps_table(
                    rows=[
                        first,
                        {
                            **first,
                            "id": "pmp_2",
                            "custom_values": {**first["custom_values"], "record_id": "p-1"},
                        },
                    ]
                ),
            },
        },
        "single_select_options": {
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            "pumps.device_type": [{"id": "opt_circ", "label": "Circulator", "color": "#3b82f6", "order": 0}],
        },
    }
    doc = ProjectDocumentV1.model_validate(body)
    assert [pump.custom_values["record_id"] for pump in doc.tables.equipment.pumps.rows] == ["P-1", "p-1"]


def test_document_rejects_negative_pump_numeric_builtin() -> None:
    payload = pump_payload()
    payload["pumps"][0]["custom_values"]["wattage"] = -1
    tables = empty_required_tables()

    with pytest.raises(ValidationError, match="pump wattage must be zero or greater"):
        ProjectDocumentV1.model_validate(
            {
                "schema_version": 1,
                "project": {"name": "p", "bt_number": "1", "cert_programs": []},
                "tables": {
                    **tables,
                    "equipment": {
                        **tables["equipment"],
                        "pumps": empty_pumps_table(rows=payload["pumps"]),
                    },
                },
                "single_select_options": payload["single_select_options"],
            }
        )


def test_pumps_contract_exposes_field_registry() -> None:
    pumps = get_table_contract("pumps")

    assert pumps.field_registry is not None
    assert pumps.table_path == ("equipment", "pumps")
    assert pumps.field_registry.field_keys == PUMPS_BUILT_IN_FIELD_KEYS
    assert pumps.field_registry.option_list_namespace_prefix == "equipment.pumps"


def test_pump_flow_field_uses_fixed_flow_rate_units() -> None:
    flow_field = next(field for field in PUMPS_BUILT_IN_FIELD_DEFS if field.field_key == "flow_gpm")

    assert flow_field.display_name == "Flow"
    assert flow_field.config["units"] == {
        "mode": "fixed",
        "unit_type": "flow_rate",
        "si_unit": "l_min",
        "ip_unit": "gpm",
        "precision_si": 1,
        "precision_ip": 1,
    }


def test_first_pumps_replace_lazily_creates_draft(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    assert initial.status_code == 200
    assert initial.json()["source"] == "version"

    updated = client.put(
        draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=pump_payload(),
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["source"] == "draft"
    assert body["draft_etag"]
    assert body["pumps"][0]["custom_values"]["record_id"] == "P-1"


def test_pumps_schema_mutation_adds_field_round_trip(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    assert initial.status_code == 200
    fingerprint = field_defs_fingerprint(initial.json()["field_defs"])

    response = client.post(
        mutate_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=add_field_mutation(fingerprint=fingerprint),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "draft"
    assert [field["field_key"] for field in custom_fields_from_slice(body)] == ["cf_notes"]
    assert all(field["field_key"] != "datasheet_asset_ids" for field in body["field_defs"])

    refetch = client.get(draft_pumps_url(project_id, version_id))
    assert refetch.status_code == 200
    assert [field["field_key"] for field in custom_fields_from_slice(refetch.json())] == ["cf_notes"]


def test_pumps_schema_mutation_rejects_builtin_display_name_collision(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    assert initial.status_code == 200
    mutation = add_field_mutation(
        fingerprint=field_defs_fingerprint(initial.json()["field_defs"]),
        field_key="cf_use",
        display_name="Use",
    )

    response = client.post(
        mutate_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=mutation,
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["error_code"] == "custom_field_duplicate_name"
    assert payload["details"]["colliding_field_origin"] == "built_in"


def test_pumps_schema_mutation_rejects_path_payload_table_mismatch(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    assert initial.status_code == 200
    mutation = add_field_mutation(
        fingerprint=field_defs_fingerprint(initial.json()["field_defs"]),
        table_key="rooms",
    )

    response = client.post(
        mutate_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=mutation,
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["error_code"] == "custom_field_invalid_field_id"
    assert payload["details"] == {"table_key": "rooms", "path_table_name": "pumps"}


def test_pumps_custom_value_and_datasheet_survive_replace_refetch(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    assert initial.status_code == 200
    add_response = client.post(
        mutate_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=add_field_mutation(fingerprint=field_defs_fingerprint(initial.json()["field_defs"])),
    )
    assert add_response.status_code == 200, add_response.text
    with_custom_field = add_response.json()

    payload = pump_payload()
    payload["field_defs"] = with_custom_field["field_defs"]
    asset_id = "asset_01HXABCDEF0123456789ABCD"
    insert_project_asset(project_id=project_id, asset_id=asset_id)
    payload["pumps"][0]["datasheet_asset_ids"] = [asset_id]
    payload["pumps"][0]["custom_values"]["cf_notes"] = "Primary recirc pump"

    updated = client.put(
        draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match": with_custom_field["draft_etag"]},
        json=payload,
    )
    assert updated.status_code == 200, updated.text

    refetch = client.get(draft_pumps_url(project_id, version_id))
    assert refetch.status_code == 200
    row = refetch.json()["pumps"][0]
    assert row["custom_values"]["cf_notes"] == "Primary recirc pump"
    assert row["datasheet_asset_ids"] == ["asset_01HXABCDEF0123456789ABCD"]


def test_pumps_slice_exposes_status_field_and_options(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    initial = client.get(draft_pumps_url(project["id"], project["active_version_id"]))

    assert initial.status_code == 200
    body = initial.json()
    assert_status_field_def(body["field_defs"])
    assert_status_options(body["single_select_options"], "pumps")


def test_pumps_replace_persists_status_value(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    payload = pump_payload()
    payload["pumps"][0]["custom_values"]["status"] = "opt_status_complete"

    updated = client.put(
        draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=payload,
    )
    assert updated.status_code == 200, updated.text

    refetch = client.get(draft_pumps_url(project_id, version_id))
    assert refetch.json()["pumps"][0]["custom_values"]["status"] == "opt_status_complete"
    assert_status_options(refetch.json()["single_select_options"], "pumps")


def test_pumps_replace_rejects_unknown_status_option(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    initial = client.get(draft_pumps_url(project_id, version_id))
    payload = pump_payload()
    payload["pumps"][0]["custom_values"]["status"] = "opt_status_bogus"

    response = client.put(
        draft_pumps_url(project_id, version_id),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=payload,
    )
    assert response.status_code == 422
