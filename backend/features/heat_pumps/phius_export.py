"""Phius Multiple Heat Pump Performance Estimator export.

Pure transform: project's heat-pump slice → CSV payload that pastes
cleanly into the calc's "Air Source Heat Pump Performance Data"
section. Column order and conditional cells follow
`planning/archive/heat-pumps/PRD.md` §6.2; pre-export validation
follows §6.4.
"""

from __future__ import annotations

import csv
import io
from typing import Literal

from pydantic import BaseModel, ConfigDict

from features.heat_pumps.models import (
    HeatPumpOutdoorEquipRow,
    HeatPumpsTableSlice,
)

WarningField = Literal[
    "heating_data_type",
    "heating_cap_kbtuh_17f",
    "heating_cap_kbtuh_47f",
    "heating_cop_17f",
    "heating_cop_47f",
    "hspf2",
    "cooling_data_type",
    "cooling_cap_kbtuh_95f",
    "eer2",
    "seer2",
    "ieer",
    "qty",
]


CSV_HEADER: tuple[str, ...] = (
    "Device(s)",
    "Qty",
    "Heating Data Type",
    "Cap @ 17°F",
    "Cap @ 47°F",
    "COP @ 17°F",
    "COP @ 47°F",
    "HSPF",
    "Cooling Data Type",
    "Cap @ 95°F",
    "EER",
    "SEER",
    "IEER",
)

_HEATING_DATA_TYPE_LABELS: dict[str, str] = {"cops": "COPs", "hspf2": "HSPF2"}
_COOLING_DATA_TYPE_LABELS: dict[str, str] = {"eer2_seer2": "EER2/SEER2", "ieer": "IEER"}


class PhiusRow(BaseModel):
    """One CSV row, one outdoor equipment record."""

    model_config = ConfigDict(extra="forbid")

    row_id: str
    device: str
    qty: int
    heating_data_type: str
    cap_17f: float | None
    cap_47f: float | None
    cop_17f: float | None
    cop_47f: float | None
    hspf: float | None
    cooling_data_type: str
    cap_95f: float | None
    eer: float | None
    seer: float | None
    ieer: float | None


class PhiusWarning(BaseModel):
    """One pre-export warning, scoped to a single outdoor equip row."""

    model_config = ConfigDict(extra="forbid")

    row_id: str
    model_number: str
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
    indoor_models_by_id = {row.id: row.model_number for row in slice_.indoor_equip}

    rows: list[PhiusRow] = []
    warnings: list[PhiusWarning] = []
    for equip in slice_.outdoor_equip:
        qty = qty_by_equip_id.get(equip.id, 0)
        rows.append(_build_row(equip, qty, indoor_models_by_id))
        warnings.extend(_validate(equip, qty))
    return PhiusPayload(rows=rows, warnings=warnings)


def serialize_csv(payload: PhiusPayload) -> bytes:
    """UTF-8 CSV; column order per PRD §6.2."""

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(CSV_HEADER)
    for row in payload.rows:
        writer.writerow(
            (
                row.device,
                _csv_int(row.qty),
                row.heating_data_type,
                _csv_number(row.cap_17f),
                _csv_number(row.cap_47f),
                _csv_number(row.cop_17f),
                _csv_number(row.cop_47f),
                _csv_number(row.hspf),
                row.cooling_data_type,
                _csv_number(row.cap_95f),
                _csv_number(row.eer),
                _csv_number(row.seer),
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
    indoor_models_by_id: dict[str, str],
) -> PhiusRow:
    heating_is_cops = equip.heating_data_type == "cops"
    heating_is_hspf2 = equip.heating_data_type == "hspf2"
    cooling_is_eer2 = equip.cooling_data_type == "eer2_seer2"
    cooling_is_ieer = equip.cooling_data_type == "ieer"
    return PhiusRow(
        row_id=equip.id,
        device=_device_label(equip, indoor_models_by_id),
        qty=qty,
        heating_data_type=_HEATING_DATA_TYPE_LABELS.get(equip.heating_data_type or "", ""),
        cap_17f=equip.heating_cap_kbtuh_17f if heating_is_cops else None,
        cap_47f=equip.heating_cap_kbtuh_47f if heating_is_cops else None,
        cop_17f=equip.heating_cop_17f if heating_is_cops else None,
        cop_47f=equip.heating_cop_47f if heating_is_cops else None,
        hspf=equip.hspf2 if heating_is_hspf2 else None,
        cooling_data_type=_COOLING_DATA_TYPE_LABELS.get(equip.cooling_data_type or "", ""),
        cap_95f=equip.cooling_cap_kbtuh_95f if (cooling_is_eer2 or cooling_is_ieer) else None,
        eer=equip.eer2 if cooling_is_eer2 else None,
        seer=equip.seer2 if cooling_is_eer2 else None,
        ieer=equip.ieer if cooling_is_ieer else None,
    )


def _device_label(
    equip: HeatPumpOutdoorEquipRow,
    indoor_models_by_id: dict[str, str],
) -> str:
    """`PUZ-A18NKA7 [PLA-A18EA8]` for paired splits; bare for VRF / null."""

    paired_id = equip.paired_indoor_equip_id
    if paired_id is None:
        return equip.model_number
    paired_model = indoor_models_by_id.get(paired_id)
    if paired_model is None:
        # FK validator on the slice would have caught this; defensive bare output.
        return equip.model_number
    return f"{equip.model_number} [{paired_model}]"


def _validate(equip: HeatPumpOutdoorEquipRow, qty: int) -> list[PhiusWarning]:
    warnings: list[PhiusWarning] = []

    def warn(field: WarningField, message: str) -> None:
        warnings.append(
            PhiusWarning(
                row_id=equip.id,
                model_number=equip.model_number,
                field=field,
                message=message,
            )
        )

    if qty == 0:
        warn("qty", "No outdoor units reference this equipment row.")

    if equip.heating_data_type is None:
        warn("heating_data_type", "Heating data type is required for export.")
    elif equip.heating_data_type == "cops":
        if equip.heating_cap_kbtuh_17f is None:
            warn("heating_cap_kbtuh_17f", "Heating capacity @ 17°F is required for COPs export.")
        if equip.heating_cap_kbtuh_47f is None:
            warn("heating_cap_kbtuh_47f", "Heating capacity @ 47°F is required for COPs export.")
        if equip.heating_cop_17f is None:
            warn("heating_cop_17f", "COP @ 17°F is required for COPs export.")
        if equip.heating_cop_47f is None:
            warn("heating_cop_47f", "COP @ 47°F is required for COPs export.")
    elif equip.heating_data_type == "hspf2" and equip.hspf2 is None:
        warn("hspf2", "HSPF2 is required for HSPF2 export.")

    if equip.cooling_data_type is None:
        warn("cooling_data_type", "Cooling data type is required for export.")
    elif equip.cooling_data_type == "eer2_seer2":
        if equip.cooling_cap_kbtuh_95f is None:
            warn("cooling_cap_kbtuh_95f", "Cooling capacity @ 95°F is required for EER2/SEER2 export.")
        if equip.eer2 is None:
            warn("eer2", "EER2 is required for EER2/SEER2 export.")
        if equip.seer2 is None:
            warn("seer2", "SEER2 is required for EER2/SEER2 export.")
    elif equip.cooling_data_type == "ieer":
        if equip.cooling_cap_kbtuh_95f is None:
            warn("cooling_cap_kbtuh_95f", "Cooling capacity @ 95°F is required for IEER export.")
        if equip.ieer is None:
            warn("ieer", "IEER is required for IEER export.")

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
