"""Deterministic record-linking perf document builder."""

from __future__ import annotations

from datetime import UTC, datetime

from features.project_document.custom_fields import CustomFieldType, TableFieldDef
from features.project_document.document import (
    ApplianceRow,
    ElectricHeaterRow,
    FanRow,
    HotWaterHeaterRow,
    HotWaterTankRow,
    ProjectDocumentV1,
    PumpRow,
    RoomRow,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def build_record_linking_perf_document() -> ProjectDocumentV1:
    """Build the Phase-02 inverse-view perf fixture in memory."""

    body = empty_project_document(
        CreateProjectRequest(
            name="record-linking perf",
            bt_number="perf",
            cert_programs=[],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )
    pumps = [PumpRow(id=f"pmp_{index:03d}") for index in range(50)]
    room_fields = [
        _linked_record_field_def(field_key=f"cf_pumps_{index}", display_name=f"Pump {index}") for index in range(3)
    ]
    rooms = [
        RoomRow(
            id=f"rm_{index:04d}",
            custom_links={
                field.field_key: [f"pmp_{(index + offset) % 50:03d}"] for offset, field in enumerate(room_fields)
            },
        )
        for index in range(4000)
    ]
    return body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "rooms": body.tables.rooms.model_copy(
                        update={
                            "field_defs": [*body.tables.rooms.field_defs, *room_fields],
                            "rows": rooms,
                        }
                    ),
                    "equipment": body.tables.equipment.model_copy(
                        update={
                            "pumps": body.tables.equipment.pumps.model_copy(update={"rows": pumps}),
                            "fans": body.tables.equipment.fans.model_copy(
                                update={
                                    "field_defs": [
                                        *body.tables.equipment.fans.field_defs,
                                        _linked_record_field_def(field_key="cf_perf_pump", display_name="Pump"),
                                    ],
                                    "rows": _linked_equipment_rows(FanRow, "fan", "cf_perf_pump"),
                                }
                            ),
                            "hot_water_heaters": body.tables.equipment.hot_water_heaters.model_copy(
                                update={
                                    "field_defs": [
                                        *body.tables.equipment.hot_water_heaters.field_defs,
                                        _linked_record_field_def(field_key="cf_perf_pump", display_name="Pump"),
                                    ],
                                    "rows": _linked_equipment_rows(
                                        HotWaterHeaterRow,
                                        "hwh",
                                        "cf_perf_pump",
                                    ),
                                }
                            ),
                            "hot_water_tanks": body.tables.equipment.hot_water_tanks.model_copy(
                                update={
                                    "field_defs": [
                                        *body.tables.equipment.hot_water_tanks.field_defs,
                                        _linked_record_field_def(field_key="cf_perf_pump", display_name="Pump"),
                                    ],
                                    "rows": _linked_equipment_rows(
                                        HotWaterTankRow,
                                        "hwt",
                                        "cf_perf_pump",
                                    ),
                                }
                            ),
                            "electric_heaters": body.tables.equipment.electric_heaters.model_copy(
                                update={
                                    "field_defs": [
                                        *body.tables.equipment.electric_heaters.field_defs,
                                        _linked_record_field_def(field_key="cf_perf_pump", display_name="Pump"),
                                    ],
                                    "rows": _linked_equipment_rows(
                                        ElectricHeaterRow,
                                        "heatr",
                                        "cf_perf_pump",
                                    ),
                                }
                            ),
                            "appliances": body.tables.equipment.appliances.model_copy(
                                update={
                                    "field_defs": [
                                        *body.tables.equipment.appliances.field_defs,
                                        _linked_record_field_def(field_key="cf_perf_pump", display_name="Pump"),
                                    ],
                                    "rows": _linked_equipment_rows(
                                        ApplianceRow,
                                        "appl",
                                        "cf_perf_pump",
                                    ),
                                }
                            ),
                        }
                    ),
                }
            )
        }
    )


def _linked_record_field_def(*, field_key: str, display_name: str) -> TableFieldDef:
    return TableFieldDef(
        field_key=field_key,
        display_name=display_name,
        field_type=CustomFieldType.linked_record,
        config={"target_table_path": ["equipment", "pumps"], "max_links": 1},
        created_at=datetime(2026, 6, 9, tzinfo=UTC),
        origin="custom",
    )


def _linked_equipment_rows(row_type: type, prefix: str, field_key: str) -> list[object]:
    return [
        row_type(id=f"{prefix}_{index:03d}", custom_links={field_key: [f"pmp_{index % 50:03d}"]})
        for index in range(200)
    ]
