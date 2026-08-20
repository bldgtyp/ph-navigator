"""Assembly PDF layout primitives and renderer contract proof."""

from __future__ import annotations

from dataclasses import dataclass
from importlib.resources import files
from io import BytesIO

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from features.envelope.assembly_report import AssemblyReport, AssemblyReportPage

LETTER_LANDSCAPE_PT = landscape(letter)
PAGE_MARGIN_PT = 36.0
DRAWING_TABLE_GAP_PT = 24.0
_FONT_NAME = "PHN-Vera"
_FONT_BOLD_NAME = "PHN-Vera-Bold"
_INK = HexColor("#111827")
_LINE = HexColor("#59636e")


@dataclass(frozen=True, slots=True)
class MaterialTableColumnSpec:
    label_si: str
    unit_si: str | None
    width_pt: float
    label_ip: str | None = None
    unit_ip: str | None = None


MATERIAL_TABLE_COLUMN_SPECS = (
    MaterialTableColumnSpec("Color", None, 23.0),
    MaterialTableColumnSpec("Material", None, 82.0),
    MaterialTableColumnSpec("Conductivity", "W/(m-K)", 65.0, "Resistivity", "R/inch"),
    MaterialTableColumnSpec("Density", "kg/m3", 46.0, unit_ip="lb/ft3"),
    MaterialTableColumnSpec("Specific heat", "J/(kg-K)", 68.0, unit_ip="Btu/(lb-F)"),
    MaterialTableColumnSpec("Emissivity", None, 40.0),
)
MATERIAL_TABLE_COLUMNS = tuple(
    f"{column.label_si} [{column.unit_si}]" if column.unit_si else column.label_si
    for column in MATERIAL_TABLE_COLUMN_SPECS
)


@dataclass(frozen=True, slots=True)
class _ProofLayer:
    thickness_mm: float
    segments: tuple[tuple[float, str], ...]
    display_height_pt: float
    is_membrane: bool = False


def render_renderer_proof() -> bytes:
    """Return a deterministic one-page vector/text renderer proof."""
    _register_fonts()
    stream = BytesIO()
    pdf = Canvas(
        stream,
        pagesize=LETTER_LANDSCAPE_PT,
        bottomup=True,
        pageCompression=1,
        invariant=1,
    )
    pdf.setTitle("Assembly renderer proof")
    pdf.setAuthor("PH-Navigator")
    pdf.setCreator("PH-Navigator Assembly PDF")

    page_width, page_height = LETTER_LANDSCAPE_PT
    pdf.setFont(_FONT_BOLD_NAME, 15)
    pdf.drawString(PAGE_MARGIN_PT, page_height - PAGE_MARGIN_PT, "Assembly renderer proof")
    pdf.setFont(_FONT_NAME, 8)
    pdf.drawRightString(page_width - PAGE_MARGIN_PT, page_height - PAGE_MARGIN_PT, "US Letter landscape")

    _draw_proof_assembly(pdf)
    _draw_proof_material_table(pdf)
    pdf.showPage()
    pdf.save()
    return stream.getvalue()


def render_assembly_report_pdf(report: AssemblyReport) -> bytes:
    """Compose one deterministic vector page per Assembly report page."""
    _register_fonts()
    stream = BytesIO()
    pdf = Canvas(
        stream,
        pagesize=LETTER_LANDSCAPE_PT,
        bottomup=True,
        pageCompression=1,
        invariant=1,
    )
    pdf.setTitle(f"{report.project_bt_number} Assemblies — {report.version_name}")
    pdf.setAuthor("PH-Navigator")
    pdf.setCreator("PH-Navigator Assembly PDF")
    for page_number, page in enumerate(report.pages, start=1):
        _draw_report_header(pdf, report, page, page_number)
        _draw_report_assembly(pdf, page, report.units)
        _draw_report_material_table(pdf, page, report.units)
        pdf.showPage()
    pdf.save()
    return stream.getvalue()


def _register_fonts() -> None:
    registered = set(pdfmetrics.getRegisteredFontNames())
    font_root = files("reportlab").joinpath("fonts")
    if _FONT_NAME not in registered:
        pdfmetrics.registerFont(TTFont(_FONT_NAME, str(font_root.joinpath("Vera.ttf"))))
    if _FONT_BOLD_NAME not in registered:
        pdfmetrics.registerFont(TTFont(_FONT_BOLD_NAME, str(font_root.joinpath("VeraBd.ttf"))))


def _draw_report_header(
    pdf: Canvas,
    report: AssemblyReport,
    page: AssemblyReportPage,
    page_number: int,
) -> None:
    page_width, page_height = LETTER_LANDSCAPE_PT
    pdf.setFillColor(_INK)
    _draw_fitted_text(
        pdf,
        f"{report.project_bt_number} — {report.project_name}",
        PAGE_MARGIN_PT,
        page_height - PAGE_MARGIN_PT,
        470.0,
        font_name=_FONT_BOLD_NAME,
        font_size=13.0,
    )
    pdf.setFont(_FONT_NAME, 8)
    pdf.drawRightString(
        page_width - PAGE_MARGIN_PT,
        page_height - PAGE_MARGIN_PT,
        f"Version: {report.version_name} · {report.units} · {page_number}/{len(report.pages)}",
    )
    _draw_fitted_text(
        pdf,
        f"{page.name} · {page.assembly_type.title()}",
        PAGE_MARGIN_PT,
        page_height - 58.0,
        page_width - PAGE_MARGIN_PT * 2,
        font_name=_FONT_BOLD_NAME,
        font_size=11.0,
    )


def _draw_report_assembly(pdf: Canvas, page: AssemblyReportPage, units: str) -> None:
    box_left = 86.0
    box_bottom = 102.0
    box_width = 320.0
    box_height = 362.0
    scale = min(box_width / page.width_mm, box_height / page.height_mm)
    drawn_width = page.width_mm * scale
    drawn_height = page.height_mm * scale
    origin_x = box_left + (box_width - drawn_width) / 2
    origin_y = box_bottom + (box_height - drawn_height) / 2

    pdf.setFillColor(_INK)
    pdf.setFont(_FONT_NAME, 8)
    pdf.drawString(origin_x, origin_y + drawn_height + 9.0, page.orientation_top)
    pdf.drawString(origin_x, origin_y - 14.0, page.orientation_bottom)

    for layer in page.layers:
        layer_y = origin_y + (page.height_mm - layer.y_mm - layer.height_mm) * scale
        layer_height = layer.height_mm * scale
        if layer.is_membrane:
            for segment in layer.segments:
                stroke = "#b91c1c" if segment.is_air_barrier else segment.color
                pdf.setStrokeColor(_pdf_color(stroke, fallback="#59636e"))
                pdf.setLineWidth(2.0)
                x = origin_x + segment.x_mm * scale
                pdf.line(x, layer_y + layer_height / 2, x + segment.width_mm * scale, layer_y + layer_height / 2)
            continue

        for segment in layer.segments:
            x = origin_x + segment.x_mm * scale
            width = segment.width_mm * scale
            pdf.setFillColor(_pdf_color(segment.color, fallback="#f3f4f6"))
            pdf.setStrokeColor(_LINE)
            pdf.setLineWidth(0.45)
            pdf.rect(x, layer_y, width, layer_height, fill=1, stroke=1)
            if segment.is_missing_material:
                _draw_missing_hatch(pdf, x, layer_y, width, layer_height)

        axis_x = origin_x - 13.0
        pdf.setStrokeColor(_LINE)
        pdf.setLineWidth(0.45)
        pdf.line(axis_x, layer_y, axis_x, layer_y + layer_height)
        pdf.line(axis_x - 3.0, layer_y, origin_x - 3.0, layer_y)
        pdf.line(axis_x - 3.0, layer_y + layer_height, origin_x - 3.0, layer_y + layer_height)
        if layer.thickness_label is not None:
            suffix = " in" if units == "IP" else " mm"
            _draw_fitted_text(
                pdf,
                f"{layer.thickness_label}{suffix}",
                box_left - 50.0,
                layer_y + layer_height / 2 - 2.0,
                36.0,
                font_name=_FONT_NAME,
                font_size=6.5,
                align="right",
            )

    if page.air_barrier is not None:
        barrier_y = origin_y + (page.height_mm - page.air_barrier.y_mm) * scale
        pdf.setStrokeColor(HexColor("#b91c1c"))
        pdf.setLineWidth(2.0)
        pdf.line(origin_x, barrier_y, origin_x + page.air_barrier.width_mm * scale, barrier_y)


def _draw_report_material_table(pdf: Canvas, page: AssemblyReportPage, units: str) -> None:
    left = 432.0
    top = 476.0
    table_width = 324.0
    header_height = 25.0
    review_height = 18.0 if page.needs_review_missing_material_data else 0.0
    available_rows_height = top - 90.0 - header_height - review_height
    row_height = min(24.0, available_rows_height / max(1, len(page.materials)))
    widths = tuple(column.width_pt for column in MATERIAL_TABLE_COLUMN_SPECS)
    assert sum(widths) == table_width
    headers = _material_table_headers(units)

    pdf.setFillColor(_INK)
    pdf.setFont(_FONT_BOLD_NAME, 9)
    pdf.drawString(left, top + 13.0, "Unique materials")
    x = left
    for lines, width in zip(headers, widths, strict=True):
        pdf.setFillColor(HexColor("#e5e7eb"))
        pdf.setStrokeColor(_LINE)
        pdf.rect(x, top - header_height, width, header_height, fill=1, stroke=1)
        line_y = top - 11.0 if len(lines) == 2 else top - 15.0
        for line_index, label in enumerate(lines):
            _draw_fitted_text(
                pdf,
                label,
                x + 2.0,
                line_y - line_index * 7.0,
                width - 4.0,
                font_name=_FONT_BOLD_NAME,
                font_size=5.2,
                align="center",
            )
        x += width

    for row_index, material in enumerate(page.materials, start=1):
        row_top = top - header_height - row_height * (row_index - 1)
        values = (
            material.color,
            material.name,
            material.value_label,
            material.density_label,
            material.specific_heat_label,
            material.emissivity_label,
        )
        x = left
        for column_index, (value, width) in enumerate(zip(values, widths, strict=True)):
            pdf.setFillColor(HexColor("#ffffff"))
            pdf.setStrokeColor(_LINE)
            pdf.rect(x, row_top - row_height, width, row_height, fill=1, stroke=1)
            if column_index == 0:
                swatch = min(12.0, max(3.0, row_height - 6.0))
                pdf.setFillColor(_pdf_color(value, fallback="#f3f4f6"))
                pdf.rect(
                    x + (width - swatch) / 2, row_top - (row_height + swatch) / 2, swatch, swatch, fill=1, stroke=0
                )
            else:
                _draw_fitted_text(
                    pdf,
                    value,
                    x + 3.0,
                    row_top - row_height / 2 - 2.0,
                    width - 6.0,
                    font_name=_FONT_NAME,
                    font_size=min(6.0, max(3.0, row_height * 0.35)),
                )
            x += width

    if page.needs_review_missing_material_data:
        pdf.setFillColor(HexColor("#9a3412"))
        pdf.setFont(_FONT_BOLD_NAME, 7)
        pdf.drawString(
            left,
            top - header_height - row_height * len(page.materials) - 12.0,
            "Needs review: missing material data",
        )


def _draw_missing_hatch(pdf: Canvas, x: float, y: float, width: float, height: float) -> None:
    pdf.saveState()
    path = pdf.beginPath()
    path.rect(x, y, width, height)
    pdf.clipPath(path, stroke=0, fill=0)
    pdf.setStrokeColor(HexColor("#9ca3af"))
    pdf.setLineWidth(0.35)
    step = 8.0
    offset = -height
    while offset < width:
        pdf.line(x + offset, y, x + offset + height, y + height)
        offset += step
    pdf.restoreState()


def _draw_fitted_text(
    pdf: Canvas,
    value: str,
    x: float,
    y: float,
    max_width: float,
    *,
    font_name: str,
    font_size: float,
    align: str = "left",
) -> None:
    measured = pdfmetrics.stringWidth(value, font_name, font_size)
    fitted_size = max(2.5, min(font_size, font_size * max_width / measured)) if measured else font_size
    fitted_value = _truncate_text_to_width(value, font_name, fitted_size, max_width)
    pdf.setFillColor(_INK)
    pdf.setFont(font_name, fitted_size)
    if align == "right":
        pdf.drawRightString(x + max_width, y, fitted_value)
    elif align == "center":
        pdf.drawCentredString(x + max_width / 2, y, fitted_value)
    else:
        pdf.drawString(x, y, fitted_value)


def _truncate_text_to_width(value: str, font_name: str, font_size: float, max_width: float) -> str:
    if pdfmetrics.stringWidth(value, font_name, font_size) <= max_width:
        return value
    suffix = "..."
    available = max_width - pdfmetrics.stringWidth(suffix, font_name, font_size)
    if available <= 0:
        return ""
    end = len(value)
    while end > 0 and pdfmetrics.stringWidth(value[:end], font_name, font_size) > available:
        end -= 1
    return f"{value[:end]}{suffix}"


def _material_table_headers(units: str) -> tuple[tuple[str, ...], ...]:
    headers: list[tuple[str, ...]] = []
    for column in MATERIAL_TABLE_COLUMN_SPECS:
        label = column.label_ip if units == "IP" and column.label_ip else column.label_si
        unit = column.unit_ip if units == "IP" else column.unit_si
        headers.append((label, f"[{unit}]") if unit else (label,))
    return tuple(headers)


def _pdf_color(value: str, *, fallback: str) -> Color:
    return HexColor(value if value.startswith("#") else fallback)


def _draw_proof_assembly(pdf: Canvas) -> None:
    origin_x = PAGE_MARGIN_PT + 50
    origin_y = 154.0
    drawing_width = 326.0
    scale = drawing_width / 3000.0
    layers = (
        _ProofLayer(140.0, ((3000.0, "#d9d2c3"),), 52.0),
        _ProofLayer(0.15, ((3000.0, "#3a7bd5"),), 8.0, is_membrane=True),
        _ProofLayer(184.0, ((400.0, "#b08968"), (2600.0, "#e9c46a")), 70.0),
        _ProofLayer(12.7, ((3000.0, "#f4f1de"),), 22.0),
    )
    y = origin_y

    pdf.setFont(_FONT_BOLD_NAME, 10)
    pdf.drawString(PAGE_MARGIN_PT, 536.0, "BT-PROOF — Renderer fixture")
    pdf.setFont(_FONT_NAME, 9)
    pdf.drawString(PAGE_MARGIN_PT, 520.0, "Representative segmented wall assembly")
    pdf.drawString(origin_x, origin_y - 18.0, "Exterior")

    for layer in layers:
        if layer.is_membrane:
            centre_y = y + layer.display_height_pt / 2
            pdf.setStrokeColor(HexColor(layer.segments[0][1]))
            pdf.setLineWidth(2)
            pdf.line(origin_x, centre_y, origin_x + drawing_width, centre_y)
        else:
            x = origin_x
            for width_mm, color in layer.segments:
                width = width_mm * scale
                pdf.setFillColor(HexColor(color))
                pdf.setStrokeColor(HexColor("#3f4650"))
                pdf.setLineWidth(0.5)
                pdf.rect(x, y, width, layer.display_height_pt, fill=1, stroke=1)
                x += width

            pdf.setStrokeColor(HexColor("#59636e"))
            pdf.setLineWidth(0.5)
            pdf.line(origin_x - 31, y, origin_x - 5, y)
            pdf.line(origin_x - 31, y + layer.display_height_pt, origin_x - 5, y + layer.display_height_pt)
            pdf.line(origin_x - 24, y, origin_x - 24, y + layer.display_height_pt)
            pdf.setFillColor(HexColor("#111827"))
            pdf.setFont(_FONT_NAME, 7)
            pdf.drawRightString(
                origin_x - 34,
                y + layer.display_height_pt / 2 - 2,
                f"{layer.thickness_mm:g} mm",
            )
        y += layer.display_height_pt

    pdf.setFillColor(HexColor("#111827"))
    pdf.setFont(_FONT_NAME, 9)
    pdf.drawString(origin_x, y + 8.0, "Interior")
    pdf.setFont(_FONT_NAME, 7)
    pdf.drawString(origin_x, origin_y - 34.0, "Vector rectangles, rules, ticks, and dimension labels")


def _draw_proof_material_table(pdf: Canvas) -> None:
    left = 432.0
    top = 472.0
    widths = tuple(column.width_pt for column in MATERIAL_TABLE_COLUMN_SPECS)
    row_height = 28.0
    rows = (
        ("#b08968", "Wood stud", "0.120", "480.0", "1600", "0.90"),
        ("#e9c46a", "Dense-pack cellulose", "0.040", "55.0", "2100", "—"),
    )

    pdf.setFillColor(HexColor("#111827"))
    pdf.setFont(_FONT_BOLD_NAME, 9)
    pdf.drawString(left, top + 18.0, "Unique materials")
    x = left
    pdf.setFont(_FONT_BOLD_NAME, 5.2)
    for lines, width in zip(_material_table_headers("SI"), widths, strict=True):
        pdf.setFillColor(HexColor("#e5e7eb"))
        pdf.rect(x, top - row_height, width, row_height, fill=1, stroke=1)
        pdf.setFillColor(HexColor("#111827"))
        first_line_y = top - 13.0 if len(lines) == 2 else top - 17.0
        for line_index, label in enumerate(lines):
            pdf.drawCentredString(x + width / 2, first_line_y - line_index * 8.0, label)
        x += width

    for row_index, row in enumerate(rows, start=1):
        x = left
        row_top = top - row_height * row_index
        for column_index, (value, width) in enumerate(zip(row, widths, strict=True)):
            pdf.setFillColor(HexColor("#ffffff"))
            pdf.rect(x, row_top - row_height, width, row_height, fill=1, stroke=1)
            if column_index == 0:
                pdf.setFillColor(HexColor(value))
                pdf.rect(x + 8.0, row_top - 20.0, 12.0, 12.0, fill=1, stroke=0)
            else:
                pdf.setFillColor(HexColor("#111827"))
                pdf.setFont(_FONT_NAME, 5.7)
                pdf.drawString(x + 3.0, row_top - 17.0, value)
            x += width

    pdf.setFillColor(HexColor("#9a3412"))
    pdf.setFont(_FONT_BOLD_NAME, 7)
    pdf.drawString(left, top - row_height * 3 - 12.0, "Needs review: missing material data")
