"""Backend-owned Documentation tab summary projection."""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Literal, Protocol, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from features.project_document.envelope_models import Assembly, AssemblySegment, ProjectMaterial, SpecificationStatus
from features.project_document.models import ProjectDocumentSource, ProjectDocumentView
from features.project_document.tables import get_table_contract
from features.project_document.tables._status_field import (
    STATUS_OPTION_COMPLETE,
    STATUS_OPTION_NA,
    STATUS_OPTION_NEEDED,
    STATUS_OPTION_QUESTION,
)
from features.project_document.tables.contracts import read_table_envelope
from features.project_document.validation import document_etag
from features.projects.access import ProjectAccess

DocumentationSpecStatus = Literal["needed", "question", "complete", "na", "unknown"]


class DocumentationAxisCounts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spec_done: int = 0
    spec_total: int = 0
    ds_done: int = 0
    ds_total: int = 0
    photo_done: int = 0
    photo_total: int = 0


class DocumentationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str
    table_key: str
    field_table_key: str
    display_name: str
    sub_label: str | None = None
    spec_status: DocumentationSpecStatus
    datasheet_asset_ids: list[str]
    photo_asset_ids: list[str]
    datasheet_not_required: bool = False
    photo_not_required: bool = False
    table_path: str
    segment_ids: list[str] = []
    material_id: str | None = None


class DocumentationGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    anchor: str
    counts: DocumentationAxisCounts
    records: list[DocumentationRecord]


class DocumentationSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    title: str
    anchor: str
    counts: DocumentationAxisCounts
    groups: list[DocumentationGroup] = []
    records: list[DocumentationRecord] = []


class ProjectDocumentationSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    counts: DocumentationAxisCounts
    sections: list[DocumentationSection]


@dataclass(frozen=True)
class DocumentationTable:
    table_name: str
    field_table_key: str
    label: str
    section_key: Literal["equipment", "apertures", "thermal_bridges"]
    section_title: str
    section_anchor: str
    group_key: str
    group_title: str
    group_anchor: str
    table_path_template: str
    status_source: Literal["custom_status", "specification_status"] = "custom_status"


class _DocumentationRow(Protocol):
    id: str


class _DocumentationEnvelope(Protocol):
    rows: list[_DocumentationRow]


@dataclass(frozen=True)
class _ResolvedTableRow:
    row: _DocumentationRow
    custom_values: Mapping[str, object]


def _slug(label: str) -> str:
    return label.lower().replace(" ", "-")


def _equipment_table(table_name: str, label: str, tab: str) -> DocumentationTable:
    return DocumentationTable(
        table_name=table_name,
        field_table_key=table_name,
        label=label,
        section_key="equipment",
        section_title="Equipment",
        section_anchor="equipment",
        group_key=tab,
        group_title=label,
        group_anchor=tab,
        table_path_template=f"/projects/{{project_id}}/equipment?tab={tab}&focus={{record_id}}",
    )


def _heat_pump_leaf(table_name: str, field_table_key: str, label: str, leaf: str) -> DocumentationTable:
    group_key = f"heat-pumps-{_slug(label)}"
    return DocumentationTable(
        table_name=table_name,
        field_table_key=field_table_key,
        label=label,
        section_key="equipment",
        section_title="Equipment",
        section_anchor="equipment",
        group_key=group_key,
        group_title=f"Heat Pumps - {label}",
        group_anchor=group_key,
        table_path_template=f"/projects/{{project_id}}/equipment/heat-pumps/{leaf}?focus={{record_id}}",
    )


def _aperture_table(table_name: str, label: str, route_leaf: str) -> DocumentationTable:
    group_key = _slug(label)
    return DocumentationTable(
        table_name=table_name,
        field_table_key=table_name,
        label=label,
        section_key="apertures",
        section_title="Apertures",
        section_anchor="apertures",
        group_key=group_key,
        group_title=label,
        group_anchor=group_key,
        table_path_template=f"/projects/{{project_id}}/apertures/{route_leaf}?focus={{record_id}}",
        status_source="specification_status",
    )


def _thermal_bridge_table() -> DocumentationTable:
    return DocumentationTable(
        table_name="thermal_bridges",
        field_table_key="thermal_bridges",
        label="Thermal Bridges",
        section_key="thermal_bridges",
        section_title="Thermal Bridges",
        section_anchor="thermal-bridges",
        group_key="thermal-bridges",
        group_title="Thermal Bridges",
        group_anchor="thermal-bridges",
        table_path_template="/projects/{project_id}/thermal-bridges?focus={record_id}",
    )


DOCUMENTATION_TABLES: tuple[DocumentationTable, ...] = (
    _equipment_table("ventilators", "Ventilators", "ventilators"),
    _heat_pump_leaf("heat_pumps_outdoor_equip", "heat_pump_outdoor_equip", "Outdoor Equipment", "equipment-outdoor"),
    _heat_pump_leaf("heat_pumps_indoor_equip", "heat_pump_indoor_equip", "Indoor Equipment", "equipment-indoor"),
    _heat_pump_leaf("heat_pumps_outdoor_units", "heat_pump_outdoor_units", "Outdoor Units", "units-outdoor"),
    _heat_pump_leaf("heat_pumps_indoor_units", "heat_pump_indoor_units", "Indoor Units", "units-indoor"),
    _equipment_table("pumps", "Pumps", "pumps"),
    _equipment_table("fans", "Fans", "fans"),
    _equipment_table("electric_heaters", "Electric Heaters", "electric-heaters"),
    _equipment_table("hot_water_heaters", "Hot Water Heaters", "hot-water-heaters"),
    _equipment_table("hot_water_tanks", "Hot Water Tanks", "hot-water-tanks"),
    _equipment_table("appliances", "Appliances", "appliances"),
    _aperture_table("project_glazings", "Glazings", "glazings"),
    _aperture_table("project_frames", "Frames", "frames"),
    _thermal_bridge_table(),
)

_STATUS_BY_OPTION_ID: dict[str, DocumentationSpecStatus] = {
    STATUS_OPTION_NEEDED: "needed",
    STATUS_OPTION_QUESTION: "question",
    STATUS_OPTION_COMPLETE: "complete",
    STATUS_OPTION_NA: "na",
}

_STATUS_BY_SPECIFICATION_STATUS: dict[SpecificationStatus, DocumentationSpecStatus] = {
    "missing": "needed",
    "question": "question",
    "complete": "complete",
    "na": "na",
}


def get_draft_documentation_summary(version_id: UUID, access: ProjectAccess) -> ProjectDocumentationSummaryResponse:
    from features.project_document.store import get_current_document_view

    return project_documentation_summary(get_current_document_view(version_id, access))


def get_saved_documentation_summary(version_id: UUID, access: ProjectAccess) -> ProjectDocumentationSummaryResponse:
    from features.project_document.store import get_saved_document

    body = get_saved_document(version_id, access)
    return project_documentation_summary(
        ProjectDocumentView(
            project_id=access.project_id,
            version_id=version_id,
            source="version",
            version_etag=document_etag(body),
            draft_etag=None,
            body=body,
        )
    )


def project_documentation_summary(view: ProjectDocumentView) -> ProjectDocumentationSummaryResponse:
    option_labels = _option_label_index(view)
    sections = [
        _envelope_section(view),
        *_table_sections(view, option_labels),
    ]
    return ProjectDocumentationSummaryResponse(
        project_id=view.project_id,
        version_id=view.version_id,
        source=view.source,
        version_etag=view.version_etag,
        draft_etag=view.draft_etag,
        counts=_sum_counts(section.counts for section in sections),
        sections=sections,
    )


def _envelope_section(view: ProjectDocumentView) -> DocumentationSection:
    materials = {material.id: material for material in view.body.tables.project_materials}
    groups = [_assembly_group(view, assembly, materials) for assembly in view.body.tables.assemblies]
    return DocumentationSection(
        key="envelope",
        title="Envelope",
        anchor="envelope",
        counts=_sum_counts(group.counts for group in groups),
        groups=groups,
    )


def _assembly_group(
    view: ProjectDocumentView,
    assembly: Assembly,
    materials: Mapping[str, ProjectMaterial],
) -> DocumentationGroup:
    records = _assembly_material_records(view, assembly, materials)
    return DocumentationGroup(
        key=assembly.id,
        title=assembly.name,
        anchor=f"assembly-{assembly.id}",
        counts=_count_records(records),
        records=records,
    )


def _assembly_material_records(
    view: ProjectDocumentView,
    assembly: Assembly,
    materials: Mapping[str, ProjectMaterial],
) -> list[DocumentationRecord]:
    segments_by_material: dict[str, list[AssemblySegment]] = {}
    for layer in assembly.layers_outside_to_inside():
        for segment in sorted(layer.segments, key=lambda item: item.order):
            if segment.project_material_id is None:
                continue
            segments_by_material.setdefault(segment.project_material_id, []).append(segment)

    records: list[DocumentationRecord] = []
    for material_id, segments in segments_by_material.items():
        material = materials.get(material_id)
        if material is None:
            continue
        photo_asset_ids = _unique_assets(asset_id for segment in segments for asset_id in segment.photo_asset_ids)
        records.append(
            _record(
                record_id=f"{assembly.id}:{material.id}",
                table_key="assembly_segments",
                field_table_key="assembly_segments",
                display_name=material.name,
                sub_label=f"{assembly.name} · {material.category} · used in {len(segments)} segment(s)",
                spec_status=_specification_status(material.specification_status),
                datasheet_asset_ids=material.datasheet_asset_ids,
                photo_asset_ids=photo_asset_ids,
                datasheet_not_required=material.datasheet_not_required,
                photo_not_required=all(segment.photo_not_required for segment in segments),
                table_path=f"/projects/{view.project_id}/envelope/materials?focus={material.id}",
                segment_ids=[segment.id for segment in segments],
                material_id=material.id,
            )
        )
    return records


def _table_sections(view: ProjectDocumentView, option_labels: Mapping[str, str]) -> list[DocumentationSection]:
    sections: list[DocumentationSection] = []
    for section_key in ("equipment", "apertures", "thermal_bridges"):
        section_tables = [table for table in DOCUMENTATION_TABLES if table.section_key == section_key]
        groups = [_table_group(view, table, option_labels) for table in section_tables]
        if not section_tables:
            continue
        sections.append(
            DocumentationSection(
                key=section_key,
                title=section_tables[0].section_title,
                anchor=section_tables[0].section_anchor,
                counts=_sum_counts(group.counts for group in groups),
                groups=groups,
            )
        )
    return sections


def _table_group(
    view: ProjectDocumentView,
    table: DocumentationTable,
    option_labels: Mapping[str, str],
) -> DocumentationGroup:
    records = [_table_record(view, table, source, option_labels) for source in _table_rows(view, table)]
    return DocumentationGroup(
        key=table.group_key,
        title=table.group_title,
        anchor=table.group_anchor,
        counts=_count_records(records),
        records=records,
    )


def _table_rows(view: ProjectDocumentView, table: DocumentationTable) -> list[_ResolvedTableRow]:
    if table.status_source == "custom_status":
        contract = get_table_contract(table.table_name)
        registry = contract.field_registry
        assert registry is not None
        envelope = cast("_DocumentationEnvelope", read_table_envelope(view.body, contract.table_path))
        return [_ResolvedTableRow(row=row, custom_values=registry.read_row_custom_values(row)) for row in envelope.rows]
    return [
        _ResolvedTableRow(row=row, custom_values={})
        for row in cast("list[_DocumentationRow]", getattr(view.body.tables, table.table_name))
    ]


def _table_record(
    view: ProjectDocumentView,
    table: DocumentationTable,
    source: _ResolvedTableRow,
    option_labels: Mapping[str, str],
) -> DocumentationRecord:
    row = source.row
    custom_values = source.custom_values
    spec_status = _custom_status(custom_values) if table.status_source == "custom_status" else _row_spec_status(row)
    return _record(
        record_id=row.id,
        table_key=table.table_name,
        field_table_key=table.field_table_key,
        display_name=_display_name(row, custom_values),
        sub_label=_sub_label(row, custom_values, option_labels),
        spec_status=spec_status,
        datasheet_asset_ids=_asset_ids(row, "datasheet_asset_ids"),
        photo_asset_ids=_asset_ids(row, "photo_asset_ids"),
        datasheet_not_required=bool(getattr(row, "datasheet_not_required", False)),
        photo_not_required=bool(getattr(row, "photo_not_required", False)),
        table_path=table.table_path_template.format(project_id=view.project_id, record_id=row.id),
    )


def _record(
    *,
    record_id: str,
    table_key: str,
    field_table_key: str,
    display_name: str,
    sub_label: str | None,
    spec_status: DocumentationSpecStatus,
    datasheet_asset_ids: Sequence[str],
    photo_asset_ids: Sequence[str],
    datasheet_not_required: bool,
    photo_not_required: bool,
    table_path: str,
    segment_ids: Sequence[str] = (),
    material_id: str | None = None,
) -> DocumentationRecord:
    if spec_status == "na":
        datasheet_not_required = True
        photo_not_required = True
    return DocumentationRecord(
        record_id=record_id,
        table_key=table_key,
        field_table_key=field_table_key,
        display_name=display_name,
        sub_label=sub_label,
        spec_status=spec_status,
        datasheet_asset_ids=list(datasheet_asset_ids),
        photo_asset_ids=list(photo_asset_ids),
        datasheet_not_required=datasheet_not_required,
        photo_not_required=photo_not_required,
        table_path=table_path,
        segment_ids=list(segment_ids),
        material_id=material_id,
    )


def _custom_status(custom_values: Mapping[str, object]) -> DocumentationSpecStatus:
    raw_status = custom_values.get("status")
    return _STATUS_BY_OPTION_ID.get(raw_status, "unknown") if isinstance(raw_status, str) else "unknown"


def _row_spec_status(row: object) -> DocumentationSpecStatus:
    raw_status = getattr(row, "specification_status", None)
    return _specification_status(cast("SpecificationStatus", raw_status)) if isinstance(raw_status, str) else "unknown"


def _specification_status(status: SpecificationStatus) -> DocumentationSpecStatus:
    return _STATUS_BY_SPECIFICATION_STATUS.get(status, "unknown")


def _display_name(row: object, custom_values: Mapping[str, object]) -> str:
    return (
        _string_value(row, custom_values, "name")
        or _string_value(row, custom_values, "record_id")
        or _string_value(row, custom_values, "tag")
        or "Untitled record"
    )


def _sub_label(row: object, custom_values: Mapping[str, object], option_labels: Mapping[str, str]) -> str | None:
    manufacturer = _string_value(row, custom_values, "manufacturer")
    model = _string_value(row, custom_values, "model") or _string_value(row, custom_values, "model_number")
    manufacturer = _option_label(option_labels, manufacturer) or manufacturer
    parts = [part for part in (manufacturer, model) if part]
    return " · ".join(parts) if parts else None


def _option_label(option_labels: Mapping[str, str], option_id: str | None) -> str | None:
    if option_id is None or not option_id.startswith("opt_"):
        return None
    return option_labels.get(option_id)


def _option_label_index(view: ProjectDocumentView) -> dict[str, str]:
    return {option.id: option.label for options in view.body.single_select_options.values() for option in options}


def _string_value(row: object, custom_values: Mapping[str, object], key: str) -> str | None:
    value = getattr(row, key, None)
    if not isinstance(value, str):
        value = custom_values.get(key)
    if not isinstance(value, str):
        return None
    return value.strip() or None


def _asset_ids(row: object, key: str) -> list[str]:
    value = getattr(row, key, [])
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


def _count_records(records: list[DocumentationRecord]) -> DocumentationAxisCounts:
    return DocumentationAxisCounts(
        spec_done=sum(record.spec_status in {"complete", "na"} for record in records),
        spec_total=len(records),
        ds_done=sum(
            _axis_done(record.datasheet_asset_ids, record.datasheet_not_required, record.spec_status)
            for record in records
        ),
        ds_total=len(records),
        photo_done=sum(
            _axis_done(record.photo_asset_ids, record.photo_not_required, record.spec_status) for record in records
        ),
        photo_total=len(records),
    )


def _axis_done(asset_ids: Sequence[str], not_required: bool, spec_status: DocumentationSpecStatus) -> bool:
    return bool(asset_ids) or not_required or spec_status == "na"


def _sum_counts(counts: Iterable[DocumentationAxisCounts]) -> DocumentationAxisCounts:
    values = list(counts)
    return DocumentationAxisCounts(
        spec_done=sum(count.spec_done for count in values),
        spec_total=sum(count.spec_total for count in values),
        ds_done=sum(count.ds_done for count in values),
        ds_total=sum(count.ds_total for count in values),
        photo_done=sum(count.photo_done for count in values),
        photo_total=sum(count.photo_total for count in values),
    )


def _unique_assets(asset_ids: Iterable[str]) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for asset_id in asset_ids:
        if asset_id in seen:
            continue
        values.append(asset_id)
        seen.add(asset_id)
    return values
