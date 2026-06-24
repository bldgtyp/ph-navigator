"""PHPP U-Value worksheet export for saved Assembly Builder versions.

This module is the pure-logic sibling of :mod:`hbjson_export`. It turns a
saved ``ProjectDocumentV1`` into one CSV per assembly, each laid out to mirror
the PHPP **U-Values** worksheet so a consultant can paste a block straight in,
and bundles them into one in-memory ZIP. There is no HTTP and no I/O here; the
routes layer (Phase 2) reads the saved document, calls these functions, and
streams the bytes.

Key divergences from HBJSON export, all by design (see the feature PRD):

- **No partial output.** An assembly that cannot be represented in PHPP (too
  many layers, too many / inconsistent heat-flow pathways, or incomplete
  materials) still produces exactly one CSV — an *error CSV* whose single line
  states the reason — rather than blocking the whole export with a 422.
- **Per-layer parallel segments → PHPP's three global "Area sections".** PHN
  lets each layer split independently; PHPP has one global percentage split and
  one thickness per row. We infer aligned sections from equal per-layer
  width-fraction profiles (§ :func:`build_assembly_export_plan`).
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from dataclasses import dataclass, field

from features.envelope.phpp_types import ExportReason, UnitSystem
from features.envelope.thermal import calculate_assembly_thermal
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    ProjectDocumentV1,
    ProjectMaterial,
)

# PHPP's U-Values worksheet holds at most eight material rows and three
# parallel "Area sections" per assembly block (decisions Q3 / Q1).
PHPP_MAX_UVALUE_ROWS = 8
PHPP_MAX_SECTIONS = 3

# Width-fraction profiles are compared with a small tolerance so that splits
# stored as e.g. 850/150 vs 849.9/150.1 still read as the same section layout.
FRACTION_TOLERANCE = 1e-6

# IP mode annotates each material name with its thickness in inches; λ and
# thickness themselves stay metric in both unit systems (the worksheet is
# metric). Only the annotation uses this conversion factor.
MM_PER_IN = 25.4

# Thermal-status flags that mean "this assembly is missing the material data
# PHPP needs" — collapsed into the single ``incomplete_materials`` reason.
_INCOMPLETE_MATERIAL_CODES = {"missing_material", "missing_conductivity", "broken_material_reference"}

# Filesystem-hostile characters stripped from CSV entry names (PRD §3).
_HOSTILE_FILENAME_CHARS = re.compile(r'[/\\:*?"<>|]')
_WHITESPACE_RUN = re.compile(r"\s+")
_MAX_FILENAME_STEM = 120


@dataclass(frozen=True)
class SectionAssignment:
    """One section cell of one material row: a (material, λ) pair or blank."""

    material_name: str | None = None
    conductivity_w_mk: float | None = None


@dataclass(frozen=True)
class ExportRow:
    """One material row, ext→int: a section assignment per global section."""

    sections: list[SectionAssignment]
    thickness_mm: float


@dataclass(frozen=True)
class AssemblyExportPlan:
    """The fully-resolved export decision for one assembly.

    ``exportable`` data plans carry ``rows`` (ext→int), the global
    ``section_percentages`` (one per section), and reference values. A
    non-exportable plan carries the typed ``reason`` (consumed by the preflight
    JSON / frontend modal) plus the already-rendered ``error_message`` for its
    one-line CSV, and empty rows.
    """

    assembly_id: str
    assembly_name: str
    exportable: bool
    reason: ExportReason | None = None
    error_message: str | None = None
    rows: list[ExportRow] = field(default_factory=list)
    section_percentages: list[float] = field(default_factory=list)
    total_thickness_cm: float = 0.0
    u_value_w_m2k: float | None = None


def build_assembly_export_plan(
    assembly: Assembly,
    materials_by_id: dict[str, ProjectMaterial],
) -> AssemblyExportPlan:
    """Resolve one assembly into an exportable plan or a typed failure reason.

    Failure precedence (only one reason is surfaced) is most-actionable first:
    ``incomplete_materials`` → ``too_many_layers`` → ``too_many_pathways``.
    """
    layers = _layers_outside_to_inside(assembly)
    # One thermal pass yields both the completeness flags and the reference
    # U-value; ``status.flags`` carries the same codes ``thermal_issues`` would.
    thermal = calculate_assembly_thermal(assembly, materials_by_id)

    # 1. Completeness — a missing material/conductivity makes a row unrenderable.
    if set(thermal.status.flags) & _INCOMPLETE_MATERIAL_CODES:
        return _failed_plan(assembly, "incomplete_materials")

    # 2. Row budget.
    if len(layers) > PHPP_MAX_UVALUE_ROWS:
        return _failed_plan(assembly, "too_many_layers", layer_count=len(layers))

    # 3. Section resolution from per-layer width-fraction profiles.
    shared_profile = _resolve_section_profile(layers)
    if shared_profile is None or len(shared_profile) > PHPP_MAX_SECTIONS:
        return _failed_plan(assembly, "too_many_pathways")

    rows = [_build_export_row(layer, materials_by_id, len(shared_profile)) for layer in layers]
    return AssemblyExportPlan(
        assembly_id=assembly.id,
        assembly_name=assembly.name,
        exportable=True,
        rows=rows,
        section_percentages=[fraction * 100.0 for fraction in shared_profile],
        total_thickness_cm=sum(layer.thickness_mm for layer in layers) / 10.0,
        u_value_w_m2k=thermal.u_effective_w_m2k,
    )


def phpp_preflight(body: ProjectDocumentV1) -> list[AssemblyExportPlan]:
    """Plan every assembly in the saved body (routes project this to JSON)."""
    materials_by_id = {material.id: material for material in body.tables.project_materials}
    return [build_assembly_export_plan(assembly, materials_by_id) for assembly in body.tables.assemblies]


def build_phpp_zip(body: ProjectDocumentV1, *, units: UnitSystem = "SI") -> bytes:
    """Render one CSV per assembly into a single in-memory ZIP (PRD §3)."""
    materials_by_id = {material.id: material for material in body.tables.project_materials}
    buffer = io.BytesIO()
    used_filenames: set[str] = set()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for assembly in body.tables.assemblies:
            plan = build_assembly_export_plan(assembly, materials_by_id)
            filename = _dedupe_filename(sanitize_csv_filename(assembly.name), used_filenames)
            used_filenames.add(filename)
            archive.writestr(filename, render_assembly_csv(plan, units=units))
    return buffer.getvalue()


def render_assembly_csv(plan: AssemblyExportPlan, *, units: UnitSystem = "SI") -> str:
    """Render a plan as either a full worksheet block or a one-line error CSV."""
    if not plan.exportable:
        return _render_csv_rows([[plan.error_message or ""]])
    return _render_csv_rows(_worksheet_grid(plan, units))


def sanitize_csv_filename(name: str) -> str:
    """Map an assembly name to a safe ``<name>.csv`` entry name (PRD §3)."""
    cleaned = _HOSTILE_FILENAME_CHARS.sub(" ", name)
    cleaned = _WHITESPACE_RUN.sub(" ", cleaned).strip()
    cleaned = cleaned[:_MAX_FILENAME_STEM].strip() or "assembly"
    return f"{cleaned}.csv"


# --- internal helpers -------------------------------------------------------


def _failed_plan(assembly: Assembly, reason: ExportReason, *, layer_count: int | None = None) -> AssemblyExportPlan:
    """A non-exportable plan carrying its typed reason and rendered CSV message.

    The message is resolved here, where the failing detail (``layer_count``) is
    in scope, so the plan does not have to carry that detail downstream.
    """
    return AssemblyExportPlan(
        assembly_id=assembly.id,
        assembly_name=assembly.name,
        exportable=False,
        reason=reason,
        error_message=_failure_message(reason, layer_count),
    )


def _failure_message(reason: ExportReason, layer_count: int | None) -> str:
    if reason == "too_many_layers":
        return f"Cannot export: {layer_count} layers exceeds the PHPP U-Value maximum of {PHPP_MAX_UVALUE_ROWS} rows."
    if reason == "too_many_pathways":
        return (
            f"Cannot export: assembly needs more than {PHPP_MAX_SECTIONS} heat-flow pathways "
            f"(PHPP allows up to {PHPP_MAX_SECTIONS} area sections)."
        )
    return "Cannot export: assembly has missing materials or conductivities."


def _layers_outside_to_inside(assembly: Assembly) -> list[AssemblyLayer]:
    """Order layers exterior → interior (decisions Q2).

    Mirrors ``hbjson_export._layers_outside_to_inside`` so both exports agree
    on row order; the two modules stay otherwise decoupled.
    """
    layers = sorted(assembly.layers, key=lambda layer: layer.order)
    if assembly.orientation == "last_layer_outside":
        return list(reversed(layers))
    return layers


def _layer_width_profile(layer: AssemblyLayer) -> tuple[float, ...]:
    """Width fractions of a layer's segments in ``order`` (uniform → ``(1.0,)``)."""
    segments = sorted(layer.segments, key=lambda segment: segment.order)
    total_width = sum(segment.width_mm for segment in segments)
    return tuple(segment.width_mm / total_width for segment in segments)


def _resolve_section_profile(layers: list[AssemblyLayer]) -> tuple[float, ...] | None:
    """Resolve the assembly's global section split from its split layers.

    All split layers (segment count > 1) must share one identical width-fraction
    profile; that shared profile defines the global sections. Assemblies with no
    split layers are a single 100% section. Returns ``None`` when split layers
    disagree, signalling ``too_many_pathways``.
    """
    shared_profile: tuple[float, ...] | None = None
    for layer in layers:
        if len(layer.segments) == 1:
            continue
        profile = _layer_width_profile(layer)
        if shared_profile is None:
            shared_profile = profile
        elif not _profiles_match(shared_profile, profile):
            return None
    return shared_profile or (1.0,)


def _profiles_match(left: tuple[float, ...], right: tuple[float, ...]) -> bool:
    return len(left) == len(right) and all(abs(a - b) <= FRACTION_TOLERANCE for a, b in zip(left, right, strict=True))


def _build_export_row(
    layer: AssemblyLayer,
    materials_by_id: dict[str, ProjectMaterial],
    num_sections: int,
) -> ExportRow:
    """Map one layer onto ``num_sections`` section cells.

    A uniform layer broadcasts its single material across every section (it
    spans all heat-flow paths); a split layer maps segment ``i`` → section ``i``.
    """
    segments = sorted(layer.segments, key=lambda segment: segment.order)
    if len(segments) == 1:
        assignment = _segment_assignment(segments[0].project_material_id, materials_by_id)
        sections = [assignment] * num_sections
    else:
        sections = [_segment_assignment(segment.project_material_id, materials_by_id) for segment in segments]
    return ExportRow(sections=sections, thickness_mm=layer.thickness_mm)


def _segment_assignment(
    project_material_id: str | None,
    materials_by_id: dict[str, ProjectMaterial],
) -> SectionAssignment:
    material = materials_by_id.get(project_material_id or "")
    if material is None:
        return SectionAssignment()
    return SectionAssignment(material_name=material.name, conductivity_w_mk=material.conductivity_w_mk)


def _worksheet_grid(plan: AssemblyExportPlan, units: UnitSystem) -> list[list[str]]:
    """Build the full 7-column worksheet block (PRD §4), padded to 8 rows.

    The worksheet labels and units stay metric-English in both unit systems
    (PRD §5 / research §9): only the material name varies by ``units`` (the IP
    inch annotation), so ``units`` is threaded solely to ``_material_row``.
    Exact placement of the soft cells (Q-A) is the working assumption locked by
    the golden tests.
    """
    lam = "λ [W/(mK)]"
    grid: list[list[str]] = [
        _grid_row(a="Description of building assembly", f="Assembly no."),
        _grid_row(a=plan.assembly_name),
        _grid_row(),
        _grid_row(a="Orientation of building assembly (or Rsi)", b="0", f="Interior insulation?"),
        _grid_row(a="Adjacent to (or Rse)", b="0", f="U-value supplement [W/(m²K)]"),
        _grid_row(
            a="Area section 1",
            b=lam,
            c="Area section 2 (optional)",
            d=lam,
            e="Area section 3 (optional)",
            f=lam,
            g="Thickness [mm]",
        ),
    ]
    grid.extend(_material_row(row, units) for row in plan.rows)
    grid.extend(_grid_row() for _ in range(PHPP_MAX_UVALUE_ROWS - len(plan.rows)))
    grid.extend(
        [
            _percentages_row(plan.section_percentages),
            _grid_row(),
            _grid_row(a="Heat transmission resistance coefficients"),
            _grid_row(a="Interior Rsi:", b="0.00", c="m²K/W"),
            _grid_row(a="Exterior Rse:", b="0.00", c="m²K/W"),
            _grid_row(f="Total thickness [cm]:", g=f"{plan.total_thickness_cm:.1f}"),
            _grid_row(f="U-value [W/(m²K)]:", g=_format_u_value(plan.u_value_w_m2k)),
        ]
    )
    return grid


# Each PHPP area section occupies one (label/name, value/λ) column pair: section
# 1 → A/B, section 2 → C/D, section 3 → E/F (column G is the shared thickness).
_SECTION_COLUMN_PAIRS = ((0, 1), (2, 3), (4, 5))


def _grid_row(
    *, a: str = "", b: str = "", c: str = "", d: str = "", e: str = "", f: str = "", g: str = ""
) -> list[str]:
    """A 7-cell grid row (columns A–G) populated by column letter."""
    return [a, b, c, d, e, f, g]


def _section_pair_cells(pairs: list[tuple[str, str]]) -> list[str]:
    """Lay (label, value) pairs into the section column pairs, rest blank."""
    cells = ["", "", "", "", "", "", ""]
    for (label_col, value_col), (label, value) in zip(_SECTION_COLUMN_PAIRS, pairs, strict=False):
        cells[label_col] = label
        cells[value_col] = value
    return cells


def _material_row(row: ExportRow, units: UnitSystem) -> list[str]:
    cells = _section_pair_cells(
        [
            (
                _material_label(section.material_name, row.thickness_mm, units),
                _format_conductivity(section.conductivity_w_mk),
            )
            for section in row.sections
        ]
    )
    cells[6] = f"{row.thickness_mm:.0f}"
    return cells


def _percentages_row(percentages: list[float]) -> list[str]:
    single_section = len(percentages) == 1
    return _section_pair_cells(
        [
            (f"Percentage of sec. {index + 1}:", _format_percentage(percentage, single_section))
            for index, percentage in enumerate(percentages)
        ]
    )


def _material_label(name: str | None, thickness_mm: float, units: UnitSystem) -> str:
    if name is None:
        return ""
    if units == "IP":
        return f"{name} [ {thickness_mm / MM_PER_IN:.1f} in ]"
    return name


def _format_conductivity(conductivity_w_mk: float | None) -> str:
    return "" if conductivity_w_mk is None else f"{conductivity_w_mk:.3f}"


def _format_percentage(percentage: float, single_section: bool) -> str:
    # A single section is always the whole assembly; PHPP shows it as "100%"
    # with no decimal (PRD §4 / decisions Q-C).
    return "100%" if single_section else f"{percentage:.1f}%"


def _format_u_value(u_value_w_m2k: float | None) -> str:
    return "" if u_value_w_m2k is None else f"{u_value_w_m2k:.3f}"


def _render_csv_rows(rows: list[list[str]]) -> str:
    output = io.StringIO()
    csv.writer(output, quoting=csv.QUOTE_MINIMAL).writerows(rows)
    return output.getvalue()


def _dedupe_filename(filename: str, used: set[str]) -> str:
    """Disambiguate a colliding CSV name as ``stem (2).csv`` (mirrors assets)."""
    if filename not in used:
        return filename
    stem, dot, suffix = filename.rpartition(".")
    base = stem if dot else filename
    ext = f".{suffix}" if dot else ""
    index = 2
    while f"{base} ({index}){ext}" in used:
        index += 1
    return f"{base} ({index}){ext}"
