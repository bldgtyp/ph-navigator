"""Phase 5 Phius Multiple HP Performance Estimator export tests.

Validates the pure transform — slice → payload → CSV — against the
PRD §6.2 column mapping and §6.4 pre-export validation rules.
"""

from __future__ import annotations

from typing import Any

from features.heat_pumps.models import HeatPumpsTableSlice
from features.heat_pumps.phius_export import (
    CSV_HEADER,
    compute_phius_payload,
    serialize_csv,
)

HPOE_COPS = "hpoe_01HX0000000000000000000001"
HPOE_HSPF2 = "hpoe_01HX0000000000000000000002"
HPOE_IEER = "hpoe_01HX0000000000000000000003"
HPOE_BARE = "hpoe_01HX0000000000000000000004"
HPIE_PAIRED = "hpie_01HX0000000000000000000001"
HPOU_1 = "hpou_01HX0000000000000000000001"
HPOU_2 = "hpou_01HX0000000000000000000002"
HPOU_3 = "hpou_01HX0000000000000000000003"


def _outdoor(
    *,
    id_: str,
    model: str,
    paired: str | None = None,
    heating_data_type: str | None = "cops",
    cap_17f: float | None = 18.0,
    cap_47f: float | None = 22.0,
    cop_17f: float | None = 2.4,
    cop_47f: float | None = 3.8,
    hspf2: float | None = None,
    cooling_data_type: str | None = "eer2_seer2",
    cap_95f: float | None = 17.5,
    eer2: float | None = 12.5,
    seer2: float | None = 21.0,
    ieer: float | None = None,
) -> dict[str, Any]:
    return {
        "id": id_,
        "model_number": model,
        "paired_indoor_equip_id": paired,
        "heating_data_type": heating_data_type,
        "heating_cap_kbtuh_17f": cap_17f,
        "heating_cap_kbtuh_47f": cap_47f,
        "heating_cop_17f": cop_17f,
        "heating_cop_47f": cop_47f,
        "hspf2": hspf2,
        "cooling_data_type": cooling_data_type,
        "cooling_cap_kbtuh_95f": cap_95f,
        "eer2": eer2,
        "seer2": seer2,
        "ieer": ieer,
    }


def _indoor(id_: str, model: str) -> dict[str, Any]:
    return {"id": id_, "model_number": model}


def _outdoor_unit(id_: str, tag: str, equip_id: str) -> dict[str, Any]:
    return {"id": id_, "tag": tag, "outdoor_equip_id": equip_id}


def _slice(**fields: Any) -> HeatPumpsTableSlice:
    return HeatPumpsTableSlice.model_validate(fields)


def test_qty_counts_outdoor_unit_instances() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7")],
        outdoor_units=[
            _outdoor_unit(HPOU_1, "HP-1", HPOE_COPS),
            _outdoor_unit(HPOU_2, "HP-2", HPOE_COPS),
        ],
    )
    payload = compute_phius_payload(slice_)
    assert payload.rows[0].qty == 2


def test_zero_instance_count_emits_warning() -> None:
    slice_ = _slice(outdoor_equip=[_outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7")])
    payload = compute_phius_payload(slice_)
    assert payload.rows[0].qty == 0
    assert any(w.field == "qty" for w in payload.warnings)


def test_paired_indoor_renders_bracketed_device_label() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7", paired=HPIE_PAIRED)],
        indoor_equip=[_indoor(HPIE_PAIRED, "PLA-A18EA8")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_COPS)],
    )
    payload = compute_phius_payload(slice_)
    assert payload.rows[0].device == "PUZ-A18NKA7 [PLA-A18EA8]"


def test_null_paired_renders_bare_device_label_per_d_hp_18() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_BARE, model="PUHY-P72TKMU-A")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-VRF", HPOE_BARE)],
    )
    payload = compute_phius_payload(slice_)
    assert payload.rows[0].device == "PUHY-P72TKMU-A"


def test_cops_mode_populates_cap_and_cop_fields_only() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_COPS)],
    )
    row = compute_phius_payload(slice_).rows[0]
    assert row.heating_data_type == "COPs"
    assert (row.cap_17f, row.cap_47f, row.cop_17f, row.cop_47f) == (18.0, 22.0, 2.4, 3.8)
    assert row.hspf is None


def test_hspf2_mode_populates_hspf_field_only() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_HSPF2,
                model="SUZ-KA15NA",
                heating_data_type="hspf2",
                cap_17f=None,
                cap_47f=None,
                cop_17f=None,
                cop_47f=None,
                hspf2=9.5,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_HSPF2)],
    )
    row = compute_phius_payload(slice_).rows[0]
    assert row.heating_data_type == "HSPF2"
    assert row.hspf == 9.5
    assert (row.cap_17f, row.cap_47f, row.cop_17f, row.cop_47f) == (None, None, None, None)


def test_eer2_seer2_mode_populates_eer_seer_fields() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_COPS)],
    )
    row = compute_phius_payload(slice_).rows[0]
    assert row.cooling_data_type == "EER2/SEER2"
    assert (row.cap_95f, row.eer, row.seer) == (17.5, 12.5, 21.0)
    assert row.ieer is None


def test_ieer_mode_populates_ieer_field_only() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_IEER,
                model="PUHY-P72TKMU-A",
                cooling_data_type="ieer",
                cap_95f=72.0,
                eer2=None,
                seer2=None,
                ieer=14.5,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-VRF", HPOE_IEER)],
    )
    row = compute_phius_payload(slice_).rows[0]
    assert row.cooling_data_type == "IEER"
    assert (row.cap_95f, row.ieer) == (72.0, 14.5)
    assert (row.eer, row.seer) == (None, None)


def test_missing_heating_data_type_emits_warning() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_COPS,
                model="PUZ-A18NKA7",
                heating_data_type=None,
                cap_17f=None,
                cap_47f=None,
                cop_17f=None,
                cop_47f=None,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_COPS)],
    )
    fields = {w.field for w in compute_phius_payload(slice_).warnings}
    assert "heating_data_type" in fields


def test_cops_mode_missing_cap_fields_each_emit_warning() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_COPS,
                model="PUZ-A18NKA7",
                cap_17f=None,
                cap_47f=None,
                cop_17f=None,
                cop_47f=None,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_COPS)],
    )
    fields = {w.field for w in compute_phius_payload(slice_).warnings}
    assert {"heating_cap_kbtuh_17f", "heating_cap_kbtuh_47f", "heating_cop_17f", "heating_cop_47f"} <= fields


def test_warnings_carry_row_id_and_model_number_for_dialog_grouping() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_HSPF2,
                model="SUZ-KA15NA",
                heating_data_type="hspf2",
                cap_17f=None,
                cap_47f=None,
                cop_17f=None,
                cop_47f=None,
                hspf2=None,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_HSPF2)],
    )
    warning = next(w for w in compute_phius_payload(slice_).warnings if w.field == "hspf2")
    assert (warning.row_id, warning.model_number) == (HPOE_HSPF2, "SUZ-KA15NA")


def test_csv_header_matches_prd_column_order() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_COPS)],
    )
    csv_bytes = serialize_csv(compute_phius_payload(slice_))
    first_line = csv_bytes.decode("utf-8").splitlines()[0]
    assert first_line.split(",") == list(CSV_HEADER)


def test_csv_row_uses_column_conditional_blanks() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7"),
            _outdoor(
                id_=HPOE_HSPF2,
                model="SUZ-KA15NA",
                heating_data_type="hspf2",
                cap_17f=None,
                cap_47f=None,
                cop_17f=None,
                cop_47f=None,
                hspf2=9.5,
                cooling_data_type="ieer",
                cap_95f=12.0,
                eer2=None,
                seer2=None,
                ieer=13.0,
            ),
        ],
        outdoor_units=[
            _outdoor_unit(HPOU_1, "HP-1", HPOE_COPS),
            _outdoor_unit(HPOU_2, "HP-2", HPOE_HSPF2),
            _outdoor_unit(HPOU_3, "HP-3", HPOE_HSPF2),
        ],
    )
    csv_text = serialize_csv(compute_phius_payload(slice_)).decode("utf-8")
    lines = csv_text.splitlines()
    assert lines[1].split(",") == [
        "PUZ-A18NKA7",
        "1",
        "COPs",
        "18",
        "22",
        "2.4",
        "3.8",
        "",
        "EER2/SEER2",
        "17.5",
        "12.5",
        "21",  # eer2/seer2 mode -> ieer column blank
        "",
    ]
    assert lines[2].split(",") == [
        "SUZ-KA15NA",
        "2",
        "HSPF2",
        "",
        "",
        "",
        "",
        "9.5",
        "IEER",
        "12",
        "",  # ieer mode -> eer/seer columns blank
        "",
        "13",
    ]


def test_zero_qty_renders_blank_qty_cell() -> None:
    slice_ = _slice(outdoor_equip=[_outdoor(id_=HPOE_COPS, model="PUZ-A18NKA7")])
    csv_text = serialize_csv(compute_phius_payload(slice_)).decode("utf-8")
    assert csv_text.splitlines()[1].split(",")[1] == ""


# ---- HTTP integration -------------------------------------------------------

from tests.features.heat_pumps.test_heat_pumps import (  # noqa: E402  (import below module body to keep transform tests at top)
    add_patch,
    heat_pumps_table_url,
    heat_pumps_url,
    outdoor_equip,
    outdoor_unit,
)
from tests.test_project_document import ORIGIN, create_project, signed_in_client  # noqa: E402


def _export_url(project_id: object, *, format: str | None = None) -> str:
    suffix = f"?format={format}" if format else ""
    return f"{heat_pumps_url(project_id)}/export-phius{suffix}"


def _seed_one_outdoor_equip(client: Any, project: dict[str, Any]) -> None:
    initial = client.get(heat_pumps_url(project["id"]))
    client.patch(
        heat_pumps_table_url(project["id"], "outdoor-equip"),
        headers={"Origin": ORIGIN, "If-Match-Version": initial.json()["version_etag"]},
        json=add_patch(outdoor_equip()),
    )
    refreshed = client.get(heat_pumps_url(project["id"]))
    client.patch(
        heat_pumps_table_url(project["id"], "outdoor-units"),
        headers={"Origin": ORIGIN, "If-Match": refreshed.json()["draft_etag"]},
        json=add_patch(outdoor_unit()),
    )


def test_export_phius_json_returns_rows_warnings_and_csv(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    _seed_one_outdoor_equip(client, project)

    response = client.post(_export_url(project["id"]), headers={"Origin": ORIGIN})

    assert response.status_code == 200
    body = response.json()
    assert {"rows", "warnings", "csv"} <= body.keys()
    assert body["rows"][0]["device"] == "PUZ-A18NKA7"
    assert body["rows"][0]["qty"] == 1
    assert body["csv"].splitlines()[0].startswith("Device(s),Qty")


def test_export_phius_raw_csv_returns_csv_media_type(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    _seed_one_outdoor_equip(client, project)

    response = client.post(_export_url(project["id"], format="raw-csv"), headers={"Origin": ORIGIN})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.text.splitlines()[0] == ",".join(CSV_HEADER)


def test_export_phius_xlsx_paste_returns_501(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)

    response = client.post(_export_url(project["id"], format="xlsx-paste"), headers={"Origin": ORIGIN})

    assert response.status_code == 501
    assert response.json()["error_code"] == "phius_export_format_unsupported"
