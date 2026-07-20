"""Compact project-record status summary contracts and table registry."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Literal, Protocol, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from features.project_document.envelope_models import SPECIFICATION_STATUSES, SpecificationStatus
from features.project_document.models import ProjectDocumentSource, ProjectDocumentView
from features.project_document.tables import get_table_contract
from features.project_document.tables._status_field import (
    STATUS_OPTION_COMPLETE,
    STATUS_OPTION_NA,
    STATUS_OPTION_NEEDED,
    STATUS_OPTION_QUESTION,
    STATUS_TABLE_NAMES,
)
from features.project_document.tables.contracts import read_table_envelope
from features.project_document.validation import document_etag
from features.projects.access import ProjectAccess

StatusSummaryState = SpecificationStatus | Literal["unknown"]
StatusSummaryDestinationKind = Literal[
    "equipment_tab",
    "heat_pump_leaf",
    "thermal_bridges",
    "aperture_glazings",
    "aperture_frames",
    "envelope_materials",
]
StatusSummaryStatusSource = Literal["custom_status", "specification_status"]


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
    subgroup_key: str | None = None
    subgroup_label: str | None = None
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
    subgroup_key: str | None = None
    subgroup_label: str | None = None
    destination_key: str | None = None
    status_source: StatusSummaryStatusSource = "custom_status"


class _SummaryRow(Protocol):
    id: str


class _SummaryEnvelope(Protocol):
    rows: list[_SummaryRow]


def _equipment_table(
    table_name: str,
    label: str,
    tab: str,
    *,
    group_key: str,
    group_label: str,
) -> StatusSummaryTable:
    return StatusSummaryTable(
        table_name=table_name,
        group_key=group_key,
        group_label=group_label,
        leaf_label=label,
        destination_kind="equipment_tab",
        destination_key=tab,
    )


def _heat_pump_leaf(table_name: str, label: str, leaf: str) -> StatusSummaryTable:
    return StatusSummaryTable(
        table_name=table_name,
        group_key="mechanical",
        group_label="Mechanical",
        leaf_label=label,
        subgroup_key="heat_pumps",
        subgroup_label="Heat Pumps",
        destination_kind="heat_pump_leaf",
        destination_key=leaf,
    )


def _specification_table(
    table_name: str,
    label: str,
    destination_kind: StatusSummaryDestinationKind,
) -> StatusSummaryTable:
    return StatusSummaryTable(
        table_name=table_name,
        group_key="envelope",
        group_label="Envelope",
        leaf_label=label,
        destination_kind=destination_kind,
        status_source="specification_status",
    )


STATUS_SUMMARY_TABLES: tuple[StatusSummaryTable, ...] = (
    _equipment_table(
        "ventilators",
        "Ventilators",
        "ventilators",
        group_key="mechanical",
        group_label="Mechanical",
    ),
    _heat_pump_leaf("heat_pumps_outdoor_equip", "Outdoor Equipment", "equipment-outdoor"),
    _heat_pump_leaf("heat_pumps_indoor_equip", "Indoor Equipment", "equipment-indoor"),
    _heat_pump_leaf("heat_pumps_outdoor_units", "Outdoor Units", "units-outdoor"),
    _heat_pump_leaf("heat_pumps_indoor_units", "Indoor Units", "units-indoor"),
    _equipment_table("pumps", "Pumps", "pumps", group_key="mechanical", group_label="Mechanical"),
    _equipment_table("fans", "Fans", "fans", group_key="mechanical", group_label="Mechanical"),
    _equipment_table(
        "electric_heaters",
        "Electric Heaters",
        "electric-heaters",
        group_key="mechanical",
        group_label="Mechanical",
    ),
    _equipment_table(
        "hot_water_heaters",
        "Hot Water Heaters",
        "hot-water-heaters",
        group_key="domestic_hot_water",
        group_label="Domestic Hot Water",
    ),
    _equipment_table(
        "hot_water_tanks",
        "Hot Water Tanks",
        "hot-water-tanks",
        group_key="domestic_hot_water",
        group_label="Domestic Hot Water",
    ),
    _equipment_table(
        "appliances",
        "Appliances",
        "appliances",
        group_key="domestic_hot_water",
        group_label="Domestic Hot Water",
    ),
    _specification_table("project_glazings", "Glazings", "aperture_glazings"),
    _specification_table("project_frames", "Frames", "aperture_frames"),
    _specification_table("project_materials", "Materials", "envelope_materials"),
    StatusSummaryTable(
        table_name="thermal_bridges",
        group_key="thermal_bridges",
        group_label="Thermal Bridges",
        leaf_label="Thermal Bridges",
        destination_kind="thermal_bridges",
    ),
)

assert {table.table_name for table in STATUS_SUMMARY_TABLES if table.status_source == "custom_status"} == set(
    STATUS_TABLE_NAMES
)

_STATUS_BY_OPTION_ID: dict[str, StatusSummaryState] = {
    STATUS_OPTION_NEEDED: "needed",
    STATUS_OPTION_QUESTION: "question",
    STATUS_OPTION_COMPLETE: "complete",
    STATUS_OPTION_NA: "na",
}


def get_draft_status_summary(version_id: UUID, access: ProjectAccess) -> ProjectStatusSummaryResponse:
    from features.project_document.store import get_current_document_view

    return project_status_summary(get_current_document_view(version_id, access))


def get_saved_status_summary(version_id: UUID, access: ProjectAccess) -> ProjectStatusSummaryResponse:
    from features.project_document.store import get_saved_document

    body = get_saved_document(version_id, access)
    return project_status_summary(
        ProjectDocumentView(
            project_id=access.project_id,
            version_id=version_id,
            source="version",
            version_etag=document_etag(body),
            draft_etag=None,
            body=body,
        )
    )


def project_status_summary(view: ProjectDocumentView) -> ProjectStatusSummaryResponse:
    leaves = [_summary_leaf(view, table) for table in STATUS_SUMMARY_TABLES]
    groups: list[StatusSummaryGroup] = []
    for table in STATUS_SUMMARY_TABLES:
        if any(group.key == table.group_key for group in groups):
            continue
        group_leaves = [
            leaf
            for leaf, leaf_table in zip(leaves, STATUS_SUMMARY_TABLES, strict=True)
            if leaf_table.group_key == table.group_key
        ]
        groups.append(
            StatusSummaryGroup(
                key=table.group_key,
                label=table.group_label,
                counts=_sum_counts(leaf.counts for leaf in group_leaves),
                leaves=group_leaves,
            )
        )
    return ProjectStatusSummaryResponse(
        project_id=view.project_id,
        version_id=view.version_id,
        source=view.source,
        version_etag=view.version_etag,
        draft_etag=view.draft_etag,
        counts=_sum_counts(group.counts for group in groups),
        groups=groups,
    )


def _summary_leaf(view: ProjectDocumentView, table: StatusSummaryTable) -> StatusSummaryLeaf:
    if table.status_source == "custom_status":
        contract = get_table_contract(table.table_name)
        registry = contract.field_registry
        assert registry is not None
        envelope = cast("_SummaryEnvelope", read_table_envelope(view.body, contract.table_path))
        rows = envelope.rows
        records = [_summary_record(row, registry.read_row_custom_values(row), table.status_source) for row in rows]
    else:
        rows = cast("list[_SummaryRow]", getattr(view.body.tables, table.table_name))
        records = [_summary_record(row, {}, table.status_source) for row in rows]
    return StatusSummaryLeaf(
        table_name=table.table_name,
        label=table.leaf_label,
        subgroup_key=table.subgroup_key,
        subgroup_label=table.subgroup_label,
        destination=StatusSummaryDestination(kind=table.destination_kind, key=table.destination_key),
        counts=_count_records(records),
        records=records,
    )


def _summary_record(
    row: _SummaryRow,
    custom_values: Mapping[str, object],
    status_source: StatusSummaryStatusSource,
) -> StatusSummaryRecord:
    if status_source == "specification_status":
        raw_status = getattr(row, "specification_status", None)
        status = cast("StatusSummaryState", raw_status) if raw_status in SPECIFICATION_STATUSES else "unknown"
    else:
        raw_status = custom_values.get("status")
        status = _STATUS_BY_OPTION_ID.get(raw_status, "unknown") if isinstance(raw_status, str) else "unknown"
    return StatusSummaryRecord(
        id=row.id,
        display_name=(
            _string_value(row, custom_values, "name")
            or _string_value(row, custom_values, "record_id")
            or _string_value(row, custom_values, "tag")
            or "Untitled record"
        ),
        status=status,
        notes=_string_value(row, custom_values, "notes") or _string_value(row, custom_values, "comments"),
    )


def _string_value(row: object, custom_values: Mapping[str, object], key: str) -> str | None:
    value = getattr(row, key, None)
    if not isinstance(value, str):
        value = custom_values.get(key)
    if not isinstance(value, str):
        return None
    return value.strip() or None


def _count_records(records: list[StatusSummaryRecord]) -> StatusSummaryCounts:
    return StatusSummaryCounts(**{state: sum(record.status == state for record in records) for state in _STATUS_STATES})


def _sum_counts(counts: Iterable[StatusSummaryCounts]) -> StatusSummaryCounts:
    values = list(counts)
    return StatusSummaryCounts(**{state: sum(getattr(count, state) for count in values) for state in _STATUS_STATES})


_STATUS_STATES: tuple[StatusSummaryState, ...] = ("needed", "question", "complete", "na", "unknown")
