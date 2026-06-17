"""Phius Multiple Heat Pump Performance Estimator export.

Pure transform: project's heat-pump slice → CSV payload that pastes
cleanly into the calc's "Air Source Heat Pump Performance Data"
section. Heat-pump capacity is stored in canonical kW and converted
to kBtu/h on the way out — the Phius calc still expects IP units.
"""

from __future__ import annotations

import csv
import io
from typing import Literal

from pydantic import BaseModel, ConfigDict

from features.heat_pumps.models import (
    CoolingDataType,
    HeatingDataType,
    HeatPumpIndoorEquipRow,
    HeatPumpOutdoorEquipRow,
    HeatPumpsTableSlice,
)

# Conversion factor for storage (kW) → Phius calc (kBtu/h).
KW_TO_KBTU_PER_H = 3.412141633

WarningField = Literal[
    "heating",
    "cooling",
    "qty",
]


CSV_HEADER: tuple[str, ...] = (
    "Device(s)",
    "Qty",
    "Cap @ 17°F",
    "Cap @ 47°F",
    "Heating Data Type",
    "COP @ 17°F",
    "COP @ 47°F",
    "HSPF/HSPF2",
    "Cap @ 95°F",
    "Cooling Data Type",
    "EER/EER2",
    "SEER/SEER2",
    "IEER",
)


class PhiusRow(BaseModel):
    """One CSV row, one outdoor equipment record. All capacity values
    in kBtu/h (post-conversion from canonical kW storage).

    The ``hspf``, ``eer``, and ``seer`` cells hold whichever rating the
    user entered; the heating/cooling ``data_type`` cells convey which
    AHRI standard the value is on (legacy or 2023).
    """

    model_config = ConfigDict(extra="forbid")

    row_id: str
    device: str
    qty: int
    cap_17f: float | None
    cap_47f: float | None
    heating_data_type: HeatingDataType | None
    cop_17f: float | None
    cop_47f: float | None
    hspf: float | None
    cap_95f: float | None
    cooling_data_type: CoolingDataType | None
    eer: float | None
    seer: float | None
    ieer: float | None


class PhiusWarning(BaseModel):
    """One pre-export warning, scoped to a single outdoor equip row."""

    model_config = ConfigDict(extra="forbid")

    row_id: str
    tag: str
    field: WarningField
    message: str


class PhiusPayload(BaseModel):
    """Computed export payload — what the frontend dialog reads."""

    model_config = ConfigDict(extra="forbid")

    rows: list[PhiusRow]
    warnings: list[PhiusWarning]


class PhiusExportResponse(BaseModel):
    """Default JSON wire shape.

    ``rows`` + ``warnings`` feed the dialog; ``csv`` carries the download body
    inline so Continue does not need a second request.
    """

    model_config = ConfigDict(extra="forbid")

    rows: list[PhiusRow]
    warnings: list[PhiusWarning]
    csv: str


def compute_phius_payload(slice_: HeatPumpsTableSlice) -> PhiusPayload:
    """Walk the outdoor-equip table; derive Qty from instance counts; validate."""

    qty_by_equip_id = _count_outdoor_units_by_equip_id(slice_)
    indoor_labels_by_id = {row.id: _indoor_label(row) for row in slice_.indoor_equip.rows}
    paired_indoor_label_by_equip_id = _paired_indoor_label_by_outdoor_equip_id(
        slice_,
        indoor_labels_by_id,
    )

    rows: list[PhiusRow] = []
    warnings: list[PhiusWarning] = []
    for equip in slice_.outdoor_equip.rows:
        qty = qty_by_equip_id.get(equip.id, 0)
        rows.append(_build_row(equip, qty, paired_indoor_label_by_equip_id.get(equip.id)))
        warnings.extend(_validate(equip, qty))
    return PhiusPayload(rows=rows, warnings=warnings)


def serialize_csv(payload: PhiusPayload) -> bytes:
    """UTF-8 CSV; columns follow CSV_HEADER order."""

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(CSV_HEADER)
    for row in payload.rows:
        writer.writerow(
            (
                row.device,
                _csv_int(row.qty),
                _csv_number(row.cap_17f),
                _csv_number(row.cap_47f),
                row.heating_data_type or "",
                _csv_number(row.cop_17f),
                _csv_number(row.cop_47f),
                _csv_number(row.hspf),
                _csv_number(row.cap_95f),
                row.cooling_data_type or "",
                _csv_number(row.eer),
                _csv_number(row.seer),
                _csv_number(row.ieer),
            )
        )
    return buffer.getvalue().encode("utf-8")


def _count_outdoor_units_by_equip_id(slice_: HeatPumpsTableSlice) -> dict[str, int]:
    counts: dict[str, int] = {}
    for unit in slice_.outdoor_units.rows:
        counts[unit.outdoor_equip_id] = counts.get(unit.outdoor_equip_id, 0) + 1
    return counts


def _paired_indoor_label_by_outdoor_equip_id(
    slice_: HeatPumpsTableSlice,
    indoor_labels_by_id: dict[str, str],
) -> dict[str, str]:
    """Resolve exactly-one indoor equipment label per outdoor equipment.

    The editable relationship lives on installed units: indoor unit →
    outdoor unit → outdoor equipment. Multiple indoor equipment models
    linked to one outdoor model indicate VRF / multi-indoor equipment, so
    the Phius device label stays bare.
    """

    outdoor_equip_id_by_unit_id = {unit.id: unit.outdoor_equip_id for unit in slice_.outdoor_units.rows}
    indoor_equip_ids_by_outdoor_equip_id: dict[str, set[str]] = {}
    for unit in slice_.indoor_units.rows:
        if unit.outdoor_unit_id is None:
            continue
        outdoor_equip_id = outdoor_equip_id_by_unit_id.get(unit.outdoor_unit_id)
        if outdoor_equip_id is None:
            continue
        indoor_equip_ids_by_outdoor_equip_id.setdefault(outdoor_equip_id, set()).add(unit.indoor_equip_id)

    labels: dict[str, str] = {}
    for outdoor_equip_id, indoor_equip_ids in indoor_equip_ids_by_outdoor_equip_id.items():
        if len(indoor_equip_ids) != 1:
            continue
        indoor_equip_id = next(iter(indoor_equip_ids))
        indoor_label = indoor_labels_by_id.get(indoor_equip_id)
        if indoor_label is not None:
            labels[outdoor_equip_id] = indoor_label
    return labels


def _build_row(
    equip: HeatPumpOutdoorEquipRow,
    qty: int,
    paired_indoor_label: str | None,
) -> PhiusRow:
    # The discriminator gates which heating/cooling metric the Phius calc
    # reads from the pasted row. Always blank the cells the user's chosen
    # type would not consume, so a stale value on the row never leaks into
    # the calc and silently shifts the result. The HSPF/HSPF2 cell and the
    # EER/SEER cells are single columns whose interpretation is determined
    # by the data-type cell.
    cop_17f = equip.heating_cop_17f if equip.heating_data_type == "COPs" else None
    cop_47f = equip.heating_cop_47f if equip.heating_data_type == "COPs" else None
    hspf = equip.hspf if equip.heating_data_type in ("HSPF", "HSPF2") else None
    eer = equip.eer if equip.cooling_data_type in ("EER/SEER", "EER2/SEER2") else None
    seer = equip.seer if equip.cooling_data_type in ("EER/SEER", "EER2/SEER2") else None
    ieer = equip.ieer if equip.cooling_data_type == "IEER" else None
    return PhiusRow(
        row_id=equip.id,
        device=_device_label(equip, paired_indoor_label),
        qty=qty,
        cap_17f=_kw_to_kbtuh(equip.heating_cap_kw_17f),
        cap_47f=_kw_to_kbtuh(equip.heating_cap_kw_47f),
        heating_data_type=equip.heating_data_type,
        cop_17f=cop_17f,
        cop_47f=cop_47f,
        hspf=hspf,
        cap_95f=_kw_to_kbtuh(equip.cooling_cap_kw_95f),
        cooling_data_type=equip.cooling_data_type,
        eer=eer,
        seer=seer,
        ieer=ieer,
    )


def _kw_to_kbtuh(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value * KW_TO_KBTU_PER_H, 2)


def _device_label(
    equip: HeatPumpOutdoorEquipRow,
    paired_indoor_label: str | None,
) -> str:
    """`PUZ-A18NKA7 [PLA-A18EA8]` for paired splits; bare for VRF / null.

    Falls back to the row's tag when ``model_number`` is empty.
    """

    outdoor_label = _outdoor_label(equip)
    if paired_indoor_label is None:
        return outdoor_label
    return f"{outdoor_label} [{paired_indoor_label}]"


def _outdoor_label(equip: HeatPumpOutdoorEquipRow) -> str:
    return equip.model_number or equip.tag


def _indoor_label(equip: HeatPumpIndoorEquipRow) -> str:
    return equip.model_number or equip.tag


def _validate(equip: HeatPumpOutdoorEquipRow, qty: int) -> list[PhiusWarning]:
    warnings: list[PhiusWarning] = []

    def warn(field: WarningField, message: str) -> None:
        warnings.append(
            PhiusWarning(
                row_id=equip.id,
                tag=equip.tag,
                field=field,
                message=message,
            )
        )

    if qty == 0:
        warn("qty", "No outdoor units reference this equipment row.")

    # Heating: warn if no data type is chosen, or if the chosen type's
    # metric cells are empty. The capacity-only case still warns because
    # the Phius calc needs an efficiency value as well as the cap @ 17/47F.
    if equip.heating_data_type is None:
        warn("heating", "Heating data type not set; calc needs COPs, HSPF, or HSPF2.")
    elif equip.heating_data_type == "COPs" and equip.heating_cop_17f is None and equip.heating_cop_47f is None:
        warn("heating", "Heating data type is COPs but no COP value is set.")
    elif equip.heating_data_type in ("HSPF", "HSPF2") and equip.hspf is None:
        warn(
            "heating",
            f"Heating data type is {equip.heating_data_type} but the HSPF/HSPF2 value is not set.",
        )

    if equip.cooling_data_type is None:
        warn("cooling", "Cooling data type not set; calc needs EER/SEER, EER2/SEER2, or IEER.")
    elif equip.cooling_data_type in ("EER/SEER", "EER2/SEER2") and equip.eer is None and equip.seer is None:
        warn(
            "cooling",
            f"Cooling data type is {equip.cooling_data_type} but neither EER nor SEER is set.",
        )
    elif equip.cooling_data_type == "IEER" and equip.ieer is None:
        warn("cooling", "Cooling data type is IEER but IEER is not set.")

    return warnings


def _csv_number(value: float | None) -> str:
    if value is None:
        return ""
    # Drop the trailing .0 for whole numbers to match how the calc shows them.
    if value == int(value):
        return str(int(value))
    return str(value)


def _csv_int(value: int) -> str:
    return str(value) if value > 0 else ""
