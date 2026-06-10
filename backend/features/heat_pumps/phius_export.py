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
    "HSPF2",
    "Cap @ 95°F",
    "Cooling Data Type",
    "EER2",
    "SEER2",
    "IEER",
)


class PhiusRow(BaseModel):
    """One CSV row, one outdoor equipment record. All capacity values
    in kBtu/h (post-conversion from canonical kW storage)."""

    model_config = ConfigDict(extra="forbid")

    row_id: str
    device: str
    qty: int
    cap_17f: float | None
    cap_47f: float | None
    heating_data_type: HeatingDataType | None
    cop_17f: float | None
    cop_47f: float | None
    hspf2: float | None
    cap_95f: float | None
    cooling_data_type: CoolingDataType | None
    eer2: float | None
    seer2: float | None
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
    indoor_labels_by_id = {row.id: _indoor_label(row) for row in slice_.indoor_equip}

    rows: list[PhiusRow] = []
    warnings: list[PhiusWarning] = []
    for equip in slice_.outdoor_equip:
        qty = qty_by_equip_id.get(equip.id, 0)
        rows.append(_build_row(equip, qty, indoor_labels_by_id))
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
                _csv_number(row.hspf2),
                _csv_number(row.cap_95f),
                row.cooling_data_type or "",
                _csv_number(row.eer2),
                _csv_number(row.seer2),
                _csv_number(row.ieer),
            )
        )
    return buffer.getvalue().encode("utf-8")


def _count_outdoor_units_by_equip_id(slice_: HeatPumpsTableSlice) -> dict[str, int]:
    counts: dict[str, int] = {}
    for unit in slice_.outdoor_units:
        counts[unit.outdoor_equip_id] = counts.get(unit.outdoor_equip_id, 0) + 1
    return counts


def _build_row(
    equip: HeatPumpOutdoorEquipRow,
    qty: int,
    indoor_labels_by_id: dict[str, str],
) -> PhiusRow:
    # The discriminator gates which heating/cooling metric the Phius calc
    # reads from the pasted row. Always blank the cells the user's chosen
    # type would not consume, so a stale value on the row never leaks into
    # the calc and silently shifts the result.
    cop_17f = equip.heating_cop_17f if equip.heating_data_type == "COPs" else None
    cop_47f = equip.heating_cop_47f if equip.heating_data_type == "COPs" else None
    hspf2 = equip.hspf2 if equip.heating_data_type == "HSPF2" else None
    eer2 = equip.eer2 if equip.cooling_data_type == "EER2/SEER2" else None
    seer2 = equip.seer2 if equip.cooling_data_type == "EER2/SEER2" else None
    ieer = equip.ieer if equip.cooling_data_type == "IEER" else None
    return PhiusRow(
        row_id=equip.id,
        device=_device_label(equip, indoor_labels_by_id),
        qty=qty,
        cap_17f=_kw_to_kbtuh(equip.heating_cap_kw_17f),
        cap_47f=_kw_to_kbtuh(equip.heating_cap_kw_47f),
        heating_data_type=equip.heating_data_type,
        cop_17f=cop_17f,
        cop_47f=cop_47f,
        hspf2=hspf2,
        cap_95f=_kw_to_kbtuh(equip.cooling_cap_kw_95f),
        cooling_data_type=equip.cooling_data_type,
        eer2=eer2,
        seer2=seer2,
        ieer=ieer,
    )


def _kw_to_kbtuh(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value * KW_TO_KBTU_PER_H, 2)


def _device_label(
    equip: HeatPumpOutdoorEquipRow,
    indoor_labels_by_id: dict[str, str],
) -> str:
    """`PUZ-A18NKA7 [PLA-A18EA8]` for paired splits; bare for VRF / null.

    Falls back to the row's tag when ``model_number`` is empty.
    """

    outdoor_label = _outdoor_label(equip)
    paired_id = equip.paired_indoor_equip_id
    if paired_id is None:
        return outdoor_label
    paired_label = indoor_labels_by_id.get(paired_id)
    if paired_label is None:
        # FK validator on the slice would have caught this; defensive bare output.
        return outdoor_label
    return f"{outdoor_label} [{paired_label}]"


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
        warn("heating", "Heating data type not set; calc will need COPs or HSPF2.")
    elif equip.heating_data_type == "COPs" and equip.heating_cop_17f is None and equip.heating_cop_47f is None:
        warn("heating", "Heating data type is COPs but no COP value is set.")
    elif equip.heating_data_type == "HSPF2" and equip.hspf2 is None:
        warn("heating", "Heating data type is HSPF2 but HSPF2 is not set.")

    if equip.cooling_data_type is None:
        warn("cooling", "Cooling data type not set; calc will need EER2/SEER2 or IEER.")
    elif equip.cooling_data_type == "EER2/SEER2" and equip.eer2 is None and equip.seer2 is None:
        warn("cooling", "Cooling data type is EER2/SEER2 but neither EER2 nor SEER2 is set.")
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
