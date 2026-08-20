"""Assembly PDF layout primitives and renderer contract proof."""

from __future__ import annotations

from dataclasses import dataclass
from importlib.resources import files
from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

LETTER_LANDSCAPE_PT = landscape(letter)
PAGE_MARGIN_PT = 36.0
DRAWING_TABLE_GAP_PT = 24.0
MATERIAL_TABLE_COLUMN_SPECS = (
    ("Color", None),
    ("Material", None),
    ("Conductivity", "W/(m-K)"),
    ("Density", "kg/m3"),
    ("Specific heat", "J/(kg-K)"),
    ("Emissivity", None),
)
MATERIAL_TABLE_COLUMNS = tuple(f"{label} [{unit}]" if unit else label for label, unit in MATERIAL_TABLE_COLUMN_SPECS)

_FONT_NAME = "PHN-Vera"
_FONT_BOLD_NAME = "PHN-Vera-Bold"


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


def _register_fonts() -> None:
    registered = set(pdfmetrics.getRegisteredFontNames())
    font_root = files("reportlab").joinpath("fonts")
    if _FONT_NAME not in registered:
        pdfmetrics.registerFont(TTFont(_FONT_NAME, str(font_root.joinpath("Vera.ttf"))))
    if _FONT_BOLD_NAME not in registered:
        pdfmetrics.registerFont(TTFont(_FONT_BOLD_NAME, str(font_root.joinpath("VeraBd.ttf"))))


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
    left = 448.0
    top = 472.0
    widths = (24.0, 72.0, 62.0, 45.0, 62.0, 38.0)
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
    for (label, unit), width in zip(MATERIAL_TABLE_COLUMN_SPECS, widths, strict=True):
        lines = (label, f"[{unit}]") if unit else (label,)
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
