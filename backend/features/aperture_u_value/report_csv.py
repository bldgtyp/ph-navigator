"""Flat, formula-free CSV serialization for aperture U-value reports."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable

from features.aperture_u_value.models import (
    ApertureReportEdge,
    ApertureReportElement,
    ApertureReportSection,
    ApertureUValueReport,
)
from features.aperture_u_value.report import (
    neutralize_spreadsheet_text,
    report_element_warning_text,
)
from features.aperture_u_value.units import (
    ExportUnitSystem,
    area_from_m2,
    area_label,
    frame_width_from_m,
    frame_width_label,
    heat_flow_from_w_k,
    heat_flow_label,
    length_from_m,
    length_label,
    psi_from_w_mk,
    psi_label,
    u_value_from_w_m2k,
    u_value_label,
)
from features.project_document.aperture_commands.models import APERTURE_SIDES

UTF8_BOM = "\ufeff"


def render_aperture_u_value_csv(
    report: ApertureUValueReport,
    *,
    units: ExportUnitSystem,
) -> str:
    """Render one RFC-4180 row per glazed element at full float precision."""
    output = io.StringIO(newline="")
    output.write(UTF8_BOM)
    writer = csv.writer(output, lineterminator="\r\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(_headers(units))
    for section in report.apertures:
        for element in section.elements:
            writer.writerow(_row(report, section, element, units))
    return output.getvalue()


def _headers(units: ExportUnitSystem) -> list[str]:
    length_unit = length_label(units)
    width_unit = frame_width_label(units)
    area_unit = area_label(units)
    u_unit = u_value_label(units)
    psi_unit = psi_label(units)
    heat_unit = heat_flow_label(units)
    headers = [
        "project_name",
        "bt_number",
        "version_label",
        "aperture_type_id",
        "aperture_name",
        "element_id",
        "element_name",
        "grid_position",
        "status",
        f"width [{length_unit}]",
        f"height [{length_unit}]",
        f"area [{area_unit}]",
        "glazing_id",
        "glazing_name",
        f"glazing_u [{u_unit}]",
        "glazing_shgc",
    ]
    for side in APERTURE_SIDES:
        prefix = side
        headers.extend(
            [
                f"{prefix}_frame_name",
                f"{prefix}_frame_width [{width_unit}]",
                f"{prefix}_frame_u [{u_unit}]",
                f"{prefix}_psi_g [{psi_unit}]",
                f"{prefix}_psi_install_excluded_from_u_w [{psi_unit}]",
                f"{prefix}_edge_length [{length_unit}]",
                f"{prefix}_interior_length [{length_unit}]",
                f"{prefix}_frame_area [{area_unit}]",
                f"{prefix}_q_frame [{heat_unit}]",
                f"{prefix}_q_spacer [{heat_unit}]",
            ]
        )
    headers.extend(
        [
            f"interior_width [{length_unit}]",
            f"interior_height [{length_unit}]",
            f"glazing_area [{area_unit}]",
            f"frame_area [{area_unit}]",
            f"q_glazing [{heat_unit}]",
            f"q_frame_total [{heat_unit}]",
            f"q_spacer_total [{heat_unit}]",
            f"element_u [{u_unit}]",
            f"aperture_area [{area_unit}]",
            f"aperture_u_w [{u_unit}]",
            "aperture_shgc_glazing_area_weighted",
            "unfinished_count",
            "void_count",
            "warnings",
        ]
    )
    return headers


def _row(
    report: ApertureUValueReport,
    section: ApertureReportSection,
    element: ApertureReportElement,
    units: ExportUnitSystem,
) -> list[object]:
    edges = {edge.side: edge for edge in element.edges}
    row: list[object] = [
        report.provenance.project_name,
        report.provenance.bt_number,
        report.provenance.version_label,
        section.aperture_type_id,
        section.name,
        element.element_id,
        element.element_name,
        element.grid_label,
        "UNFINISHED" if element.unfinished else "COMPLETE",
        length_from_m(element.width_m, units),
        length_from_m(element.height_m, units),
        area_from_m2(element.area_m2, units),
        element.glazing_id or "",
        element.glazing_name or "",
        u_value_from_w_m2k(element.glazing_u_w_m2k, units),
        element.glazing_g_value,
    ]
    for side in APERTURE_SIDES:
        row.extend(_edge_values(edges[side], units))

    row.extend(
        [
            length_from_m(element.interior_width_m, units),
            length_from_m(element.interior_height_m, units),
            _computed(element, area_from_m2(element.glazing_area_m2, units)),
            _computed(element, area_from_m2(element.frame_area_m2, units)),
            _computed(element, heat_flow_from_w_k(element.q_glazing_w_k, units)),
            _computed(element, heat_flow_from_w_k(element.q_frame_total_w_k, units)),
            _computed(element, heat_flow_from_w_k(element.q_spacer_total_w_k, units)),
            _computed(element, u_value_from_w_m2k(element.u_value_w_m2k, units)),
            area_from_m2(section.total_area_m2, units),
            u_value_from_w_m2k(section.window_u_value_w_m2k, units),
            section.shgc_glazing_area_weighted,
            section.unfinished_count,
            section.void_count,
            report_element_warning_text(element, section),
        ]
    )
    return [_blank_none(value) for value in row]


def _edge_values(
    edge: ApertureReportEdge,
    units: ExportUnitSystem,
) -> Iterable[object]:
    return (
        edge.frame_name or "",
        frame_width_from_m(edge.width_m, units),
        u_value_from_w_m2k(edge.u_value_w_m2k, units),
        psi_from_w_mk(edge.psi_g_w_mk, units),
        psi_from_w_mk(edge.psi_install_w_mk, units),
        length_from_m(edge.edge_length_m, units),
        length_from_m(edge.interior_length_m, units),
        area_from_m2(edge.frame_area_m2, units),
        heat_flow_from_w_k(edge.q_frame_w_k, units),
        heat_flow_from_w_k(edge.q_spacer_w_k, units),
    )


def _computed(element: ApertureReportElement, value: float | None) -> float | str:
    return "" if element.unfinished or value is None else value


def _blank_none(value: object) -> object:
    if value is None:
        return ""
    return neutralize_spreadsheet_text(value) if isinstance(value, str) else value
