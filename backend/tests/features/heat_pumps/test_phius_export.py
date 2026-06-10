"""Phase 5 Phius Multiple HP Performance Estimator export tests.

Validates the pure transform — slice → payload → CSV. The 2026-06-10
refactor removed the heating/cooling discriminator fields: the exporter
now emits every performance cell for every row and the user populates
whichever ratings their datasheet ships with. Capacity values are
stored canonically in kW and converted to kBtu/h on the way out.
"""

from __future__ import annotations

from typing import Any

from features.heat_pumps.models import HeatPumpsTableSlice
from features.heat_pumps.phius_export import (
    CSV_HEADER,
    KW_TO_KBTU_PER_H,
    compute_phius_payload,
    serialize_csv,
)

HPOE_A = "hpoe_01HX0000000000000000000001"
HPOE_B = "hpoe_01HX0000000000000000000002"
HPOE_BARE = "hpoe_01HX0000000000000000000004"
HPIE_PAIRED = "hpie_01HX0000000000000000000001"
HPOU_1 = "hpou_01HX0000000000000000000001"
HPOU_2 = "hpou_01HX0000000000000000000002"
HPOU_3 = "hpou_01HX0000000000000000000003"


def _outdoor(
    *,
    id_: str,
    model: str,
    tag: str | None = None,
    paired: str | None = None,
    cap_kw_17f: float | None = 5.0,
    cap_kw_47f: float | None = 8.0,
    cop_17f: float | None = 2.4,
    cop_47f: float | None = 3.8,
    hspf2: float | None = None,
    cap_kw_95f: float | None = 5.0,
    eer2: float | None = 12.5,
    seer2: float | None = 21.0,
    ieer: float | None = None,
) -> dict[str, Any]:
    return {
        "id": id_,
        "tag": tag if tag is not None else model,
        "model_number": model,
        "paired_indoor_equip_id": paired,
        "heating_cap_kw_17f": cap_kw_17f,
        "heating_cap_kw_47f": cap_kw_47f,
        "heating_cop_17f": cop_17f,
        "heating_cop_47f": cop_47f,
        "hspf2": hspf2,
        "cooling_cap_kw_95f": cap_kw_95f,
        "eer2": eer2,
        "seer2": seer2,
        "ieer": ieer,
    }


def _indoor(id_: str, model: str, *, tag: str | None = None) -> dict[str, Any]:
    return {"id": id_, "tag": tag if tag is not None else model, "model_number": model}


def _outdoor_unit(id_: str, tag: str, equip_id: str) -> dict[str, Any]:
    return {"id": id_, "tag": tag, "outdoor_equip_id": equip_id}


def _slice(**fields: Any) -> HeatPumpsTableSlice:
    return HeatPumpsTableSlice.model_validate(fields)


def _kbtuh(kw: float) -> float:
    return round(kw * KW_TO_KBTU_PER_H, 2)


def test_qty_counts_outdoor_unit_instances() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_A, model="PUZ-A18NKA7")],
        outdoor_units=[
            _outdoor_unit(HPOU_1, "HP-1", HPOE_A),
            _outdoor_unit(HPOU_2, "HP-2", HPOE_A),
        ],
    )
    payload = compute_phius_payload(slice_)
    assert payload.rows[0].qty == 2


def test_zero_instance_count_emits_warning() -> None:
    slice_ = _slice(outdoor_equip=[_outdoor(id_=HPOE_A, model="PUZ-A18NKA7")])
    payload = compute_phius_payload(slice_)
    assert payload.rows[0].qty == 0
    assert any(w.field == "qty" for w in payload.warnings)


def test_paired_indoor_renders_bracketed_device_label() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_A, model="PUZ-A18NKA7", paired=HPIE_PAIRED)],
        indoor_equip=[_indoor(HPIE_PAIRED, "PLA-A18EA8")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    payload = compute_phius_payload(slice_)
    assert payload.rows[0].device == "PUZ-A18NKA7 [PLA-A18EA8]"


def test_null_paired_renders_bare_device_label() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_BARE, model="PUHY-P72TKMU-A")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-VRF", HPOE_BARE)],
    )
    payload = compute_phius_payload(slice_).rows[0]
    assert payload.device == "PUHY-P72TKMU-A"


def test_capacity_fields_convert_kw_to_kbtuh() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_A,
                model="PUZ-A18NKA7",
                cap_kw_17f=5.28,
                cap_kw_47f=7.91,
                cap_kw_95f=7.03,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    row = compute_phius_payload(slice_).rows[0]
    assert row.cap_17f == _kbtuh(5.28)
    assert row.cap_47f == _kbtuh(7.91)
    assert row.cap_95f == _kbtuh(7.03)


def test_efficiency_fields_pass_through_unchanged() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_A,
                model="PUZ-A18NKA7",
                cop_17f=2.4,
                cop_47f=3.8,
                hspf2=9.5,
                eer2=12.5,
                seer2=21.0,
                ieer=14.5,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    row = compute_phius_payload(slice_).rows[0]
    assert (row.cop_17f, row.cop_47f, row.hspf2) == (2.4, 3.8, 9.5)
    assert (row.eer2, row.seer2, row.ieer) == (12.5, 21.0, 14.5)


def test_all_heating_fields_unset_emits_single_warning() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_A,
                model="PUZ-A18NKA7",
                cap_kw_17f=None,
                cap_kw_47f=None,
                cop_17f=None,
                cop_47f=None,
                hspf2=None,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    warnings = compute_phius_payload(slice_).warnings
    heating_warnings = [w for w in warnings if w.field == "heating"]
    assert len(heating_warnings) == 1


def test_any_heating_field_set_suppresses_heating_warning() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_A,
                model="PUZ-A18NKA7",
                cap_kw_17f=None,
                cap_kw_47f=None,
                cop_17f=None,
                cop_47f=None,
                hspf2=9.5,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    warnings = compute_phius_payload(slice_).warnings
    assert not any(w.field == "heating" for w in warnings)


def test_all_cooling_fields_unset_emits_single_warning() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_A,
                model="PUZ-A18NKA7",
                cap_kw_95f=None,
                eer2=None,
                seer2=None,
                ieer=None,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    cooling_warnings = [
        w for w in compute_phius_payload(slice_).warnings if w.field == "cooling"
    ]
    assert len(cooling_warnings) == 1


def test_warnings_carry_row_id_and_tag_for_dialog_grouping() -> None:
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_A,
                model="SUZ-KA15NA",
                tag="OE-2",
                cap_kw_17f=None,
                cap_kw_47f=None,
                cop_17f=None,
                cop_47f=None,
                hspf2=None,
            )
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    warning = next(w for w in compute_phius_payload(slice_).warnings if w.field == "heating")
    assert (warning.row_id, warning.tag) == (HPOE_A, "OE-2")


def test_csv_header_matches_declared_column_order() -> None:
    slice_ = _slice(
        outdoor_equip=[_outdoor(id_=HPOE_A, model="PUZ-A18NKA7")],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    csv_bytes = serialize_csv(compute_phius_payload(slice_))
    first_line = csv_bytes.decode("utf-8").splitlines()[0]
    assert first_line.split(",") == list(CSV_HEADER)


def test_csv_row_always_emits_every_field() -> None:
    """No more discriminator gating: each populated field shows up; empties stay blank."""
    slice_ = _slice(
        outdoor_equip=[
            _outdoor(
                id_=HPOE_A,
                model="PUZ-A18NKA7",
                cap_kw_17f=5.0,
                cap_kw_47f=8.0,
                hspf2=9.5,
                cap_kw_95f=6.0,
                ieer=13.0,
            ),
        ],
        outdoor_units=[_outdoor_unit(HPOU_1, "HP-1", HPOE_A)],
    )
    csv_text = serialize_csv(compute_phius_payload(slice_)).decode("utf-8")
    expected_cap_17f = _csv_format(_kbtuh(5.0))
    expected_cap_47f = _csv_format(_kbtuh(8.0))
    expected_cap_95f = _csv_format(_kbtuh(6.0))
    assert csv_text.splitlines()[1].split(",") == [
        "PUZ-A18NKA7",
        "1",
        expected_cap_17f,
        expected_cap_47f,
        "2.4",
        "3.8",
        "9.5",
        expected_cap_95f,
        "12.5",
        "21",
        "13",
    ]


def test_zero_qty_renders_blank_qty_cell() -> None:
    slice_ = _slice(outdoor_equip=[_outdoor(id_=HPOE_A, model="PUZ-A18NKA7")])
    csv_text = serialize_csv(compute_phius_payload(slice_)).decode("utf-8")
    assert csv_text.splitlines()[1].split(",")[1] == ""


def _csv_format(value: float) -> str:
    if value == int(value):
        return str(int(value))
    return str(value)


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
