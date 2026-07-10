"""Compact project-record status summary contracts and table registry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._status_field import STATUS_TABLE_NAMES

StatusSummaryState = Literal["needed", "question", "complete", "na", "unknown"]
StatusSummaryDestinationKind = Literal["equipment_tab", "heat_pump_leaf", "thermal_bridges"]


class StatusSummaryCounts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    needed: int = 0
    question: int = 0
    complete: int = 0
    na: int = 0
    unknown: int = 0

    @property
    def total(self) -> int:
        return self.needed + self.question + self.complete + self.na + self.unknown


class StatusSummaryRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    display_name: str
    status: StatusSummaryState
    notes: str | None


class StatusSummaryDestination(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: StatusSummaryDestinationKind
    key: str | None = None


class StatusSummaryLeaf(BaseModel):
    model_config = ConfigDict(extra="forbid")

    table_name: str
    label: str
    destination: StatusSummaryDestination
    counts: StatusSummaryCounts
    records: list[StatusSummaryRecord]


class StatusSummaryGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    label: str
    counts: StatusSummaryCounts
    leaves: list[StatusSummaryLeaf]


class ProjectStatusSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    counts: StatusSummaryCounts
    groups: list[StatusSummaryGroup]


@dataclass(frozen=True)
class StatusSummaryTable:
    table_name: str
    group_key: str
    group_label: str
    leaf_label: str
    destination_kind: StatusSummaryDestinationKind
    destination_key: str | None = None


def _equipment_table(table_name: str, label: str, tab: str) -> StatusSummaryTable:
    return StatusSummaryTable(
        table_name=table_name,
        group_key=table_name,
        group_label=label,
        leaf_label=label,
        destination_kind="equipment_tab",
        destination_key=tab,
    )


def _heat_pump_leaf(table_name: str, label: str, leaf: str) -> StatusSummaryTable:
    return StatusSummaryTable(
        table_name=table_name,
        group_key="heat_pumps",
        group_label="Heat Pumps",
        leaf_label=label,
        destination_kind="heat_pump_leaf",
        destination_key=leaf,
    )


STATUS_SUMMARY_TABLES: tuple[StatusSummaryTable, ...] = (
    _equipment_table("ventilators", "Ventilators", "ventilators"),
    _heat_pump_leaf("heat_pumps_outdoor_equip", "Outdoor Equipment", "equipment-outdoor"),
    _heat_pump_leaf("heat_pumps_indoor_equip", "Indoor Equipment", "equipment-indoor"),
    _heat_pump_leaf("heat_pumps_outdoor_units", "Outdoor Units", "units-outdoor"),
    _heat_pump_leaf("heat_pumps_indoor_units", "Indoor Units", "units-indoor"),
    _equipment_table("pumps", "Pumps", "pumps"),
    _equipment_table("fans", "Fans", "fans"),
    _equipment_table("hot_water_heaters", "Hot Water Heaters", "hot-water-heaters"),
    _equipment_table("hot_water_tanks", "Hot Water Tanks", "hot-water-tanks"),
    _equipment_table("electric_heaters", "Electric Heaters", "electric-heaters"),
    _equipment_table("appliances", "Appliances", "appliances"),
    StatusSummaryTable(
        table_name="thermal_bridges",
        group_key="thermal_bridges",
        group_label="Thermal Bridges",
        leaf_label="Thermal Bridges",
        destination_kind="thermal_bridges",
    ),
)

assert {table.table_name for table in STATUS_SUMMARY_TABLES} == set(STATUS_TABLE_NAMES)
