"""Name-bearing aperture U-value report assembly.

Report results are intentionally uncached: the legacy calculation hash omits
names, operation, SHGC, and ψ-install because they do not affect U-w. Reusing
that cache for this DTO could therefore return stale audit data.
"""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from starlette import status

from features.aperture_u_value.models import (
    ApertureReportEdge,
    ApertureReportElement,
    ApertureReportProvenance,
    ApertureReportSection,
    ApertureUValueReport,
    ApertureUValueWarning,
    UValueWarningKind,
)
from features.aperture_u_value.service import calculate_aperture_u_value_terms
from features.project_document.document import (
    ApertureTypeEntry,
    ProjectDocumentTables,
    ProjectDocumentV1,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.store import (
    get_project_version_public,
    load_document_body,
)
from features.projects.access import ProjectAccess
from features.shared.errors import api_error

REPORT_GENERATED_NOTE = (
    "ISO 10077-1:2006 · uninstalled U-w (excludes ψ-install) · 45° corner split · edges as seen from outside"
)

MAX_REPORT_APERTURE_FILTER = 100

_UNFINISHED_WARNING_KINDS: frozenset[UValueWarningKind] = frozenset(
    {
        "missing_frame",
        "incomplete_frame_data",
        "missing_glazing",
        "missing_dimension",
        "non_positive_glazing_area",
    }
)


def get_aperture_u_value_report(
    *,
    version_id: UUID,
    access: ProjectAccess,
    source: ProjectDocumentSource,
    aperture_type_ids: Sequence[str] | None = None,
    body: ProjectDocumentV1 | None = None,
) -> ApertureUValueReport:
    """Load one document and its version metadata, then build fresh report detail."""
    document = body or load_document_body(version_id, access, source)
    version = get_project_version_public(version_id, access)
    targets = _select_apertures(document.tables.apertures, aperture_type_ids)
    return build_aperture_u_value_report(
        project_id=access.project_id,
        version_id=version_id,
        source=source,
        project_name=access.project.display_name,
        bt_number=access.project.bt_number,
        version_label=version.name,
        tables=document.tables,
        apertures=targets,
    )


def build_aperture_u_value_report(
    *,
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    project_name: str,
    bt_number: str,
    version_label: str,
    tables: ProjectDocumentTables,
    apertures: Sequence[ApertureTypeEntry] | None = None,
) -> ApertureUValueReport:
    """Build fresh display/export detail from one loaded document body."""
    frame_names = {frame.id: frame.name for frame in tables.project_frames}
    glazing_names = {glazing.id: glazing.name for glazing in tables.project_glazings}
    targets = tables.apertures if apertures is None else apertures
    return ApertureUValueReport(
        project_id=project_id,
        version_id=version_id,
        source=source,
        provenance=ApertureReportProvenance(
            project_name=project_name,
            bt_number=bt_number,
            version_label=version_label,
            source=source,
            generated_note=REPORT_GENERATED_NOTE,
        ),
        apertures=[
            _build_section(
                entry,
                tables,
                frame_names=frame_names,
                glazing_names=glazing_names,
            )
            for entry in targets
        ],
    )


def _build_section(
    entry: ApertureTypeEntry,
    tables: ProjectDocumentTables,
    *,
    frame_names: dict[str, str],
    glazing_names: dict[str, str],
) -> ApertureReportSection:
    detail = calculate_aperture_u_value_terms(entry, tables)
    elements_by_id = {element.id: element for element in entry.elements}
    report_elements: list[ApertureReportElement] = []
    section_warnings = list(detail.warnings)
    shgc_numerator = 0.0
    shgc_denominator = 0.0

    for element_detail in detail.elements:
        element = elements_by_id[element_detail.element_id]
        element_warnings = list(element_detail.warnings)
        if element_detail.glazing_id is not None and element_detail.glazing_g_value is None:
            warning = ApertureUValueWarning(
                kind="missing_glazing_g_value",
                element_id=element.id,
                message=f"Element {element.id}'s glazing is missing an SHGC (g-value).",
            )
            element_warnings.append(warning)
            section_warnings.append(warning)

        if element_detail.glazing_g_value is not None and element_detail.glazing_area_m2 > 0:
            shgc_numerator += element_detail.glazing_g_value * element_detail.glazing_area_m2
            shgc_denominator += element_detail.glazing_area_m2

        unfinished = any(warning.kind in _UNFINISHED_WARNING_KINDS for warning in element_warnings)
        report_elements.append(
            ApertureReportElement(
                **element_detail.model_dump(exclude={"edges", "warnings"}),
                element_name=element.name,
                grid_label=f"C{element.column_span[0]}_R{element.row_span[0]}",
                glazing_name=(
                    glazing_names.get(element_detail.glazing_id) if element_detail.glazing_id is not None else None
                ),
                unfinished=unfinished,
                edges=tuple(
                    ApertureReportEdge(
                        **edge.model_dump(),
                        frame_name=(frame_names.get(edge.frame_id) if edge.frame_id is not None else None),
                    )
                    for edge in element_detail.edges
                ),
                warnings=element_warnings,
            )
        )

    return ApertureReportSection(
        aperture_type_id=entry.id,
        name=entry.name,
        overall_width_m=sum(entry.column_widths_mm) / 1000.0,
        overall_height_m=sum(entry.row_heights_mm) / 1000.0,
        element_count=len(entry.elements),
        void_count=sum(element.kind == "void" for element in entry.elements),
        unfinished_count=sum(element.unfinished for element in report_elements),
        total_area_m2=detail.total_area_m2,
        window_u_value_w_m2k=detail.window_u_value_w_m2k,
        shgc_glazing_area_weighted=(shgc_numerator / shgc_denominator if shgc_denominator > 0 else None),
        warnings=section_warnings,
        elements=report_elements,
    )


def _select_apertures(
    apertures: Sequence[ApertureTypeEntry],
    aperture_type_ids: Sequence[str] | None,
) -> Sequence[ApertureTypeEntry]:
    if aperture_type_ids is None:
        return apertures
    if len(aperture_type_ids) > MAX_REPORT_APERTURE_FILTER:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_type_filter_too_large",
            f"At most {MAX_REPORT_APERTURE_FILTER} aperture type ids may be requested.",
        )

    by_id = {aperture.id: aperture for aperture in apertures}
    unique_ids = list(dict.fromkeys(aperture_type_ids))
    missing_ids = [aperture_id for aperture_id in unique_ids if aperture_id not in by_id]
    if missing_ids:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "aperture_type_not_found",
            "No aperture type matches one or more requested ids.",
            {"aperture_type_ids": missing_ids},
        )
    return tuple(by_id[aperture_id] for aperture_id in unique_ids)
