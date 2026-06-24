"""Parse a PHN-native HBJSON construction library into an import IR.

The direct reverse of ``hbjson_export.py`` for the
``PHNavigatorOpaqueConstructionLibrary`` shape (PRD §2A). The file only
*mimics* the Honeybee object model, so there is no honeybee runtime
dependency here — ``json.loads`` plus the field mapping below. The raw
Honeybee-PH front-end (PRD §2B) lands in Phase 2 and will normalize into
the same :class:`ParsedConstructionLibrary` IR so the matching/apply
stages stay source-agnostic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, cast

from starlette import status

from features.project_document.envelope_models import (
    AssemblyOrientation,
    AssemblyType,
    SpecificationStatus,
)
from features.shared.errors import api_error

LIBRARY_TYPE = "PHNavigatorOpaqueConstructionLibrary"

# Default span for a homogeneous (single-segment) layer. The width of a
# full-width segment is thermally irrelevant (it is 100% of the layer); the
# export does not emit one, so import mints this canonical value (matching
# ``create_assembly``'s default).
DEFAULT_LAYER_WIDTH_MM = 1000.0

_ASSEMBLY_TYPES = frozenset({"wall", "floor", "roof", "other"})
_ASSEMBLY_TYPE_PREFIXES: dict[str, AssemblyType] = {"W_": "wall", "R_": "roof", "F_": "floor"}
_ORIENTATIONS = frozenset({"first_layer_outside", "last_layer_outside"})
_SPECIFICATION_STATUSES = frozenset({"complete", "missing", "question", "na"})


class ImportParseError(Exception):
    """A structurally invalid or unsupported construction-library file.

    Carries an error ``code`` + ``details`` so the route layer can surface a
    typed 422 (see ``service.preview_envelope_hbjson_import`` /
    ``commands.envelope_import``).
    """

    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


@dataclass(frozen=True)
class ImportedMaterial:
    """One distinct source material, deduped by ``source_key``.

    ``catalog_origin`` is the raw exported dict (or ``None``); the matching
    ladder reads ``catalog_record_id`` off it without re-validating until a
    material is actually created.
    """

    source_key: str
    name: str
    catalog_origin: dict[str, Any] | None
    conductivity_w_mk: float | None
    density_kg_m3: float | None
    specific_heat_j_kgk: float | None
    emissivity: float | None
    color: str | None
    specification_status: SpecificationStatus | None


@dataclass(frozen=True)
class ImportedSegment:
    source_material_key: str
    width_mm: float
    is_continuous_insulation: bool
    steel_stud_spacing_mm: float | None
    source_segment_id: str | None


@dataclass(frozen=True)
class ImportedLayer:
    thickness_mm: float
    segments: list[ImportedSegment]
    source_layer_id: str | None


@dataclass(frozen=True)
class ImportedConstruction:
    # Stable per-file identity used to match user resolutions to constructions.
    # The file's construction identifier works for both native and foreign
    # files (`source_assembly_id` is null for foreign, so it cannot serve here).
    resolution_key: str
    source_assembly_id: str | None
    name: str
    type: AssemblyType
    orientation: AssemblyOrientation
    layers: list[ImportedLayer]


@dataclass
class ParsedConstructionLibrary:
    schema_version: int
    constructions: list[ImportedConstruction]
    materials: dict[str, ImportedMaterial]
    warnings: list[str] = field(default_factory=list)


def parse_construction_library(raw: object, *, current_schema_version: int) -> ParsedConstructionLibrary:
    """Parse a construction-library file into the import IR.

    Dispatches on the envelope: the PHN-native
    ``PHNavigatorOpaqueConstructionLibrary`` is the reverse of
    ``export_hbjson_constructions`` (id/catalog provenance preserved); any
    other shape is treated as raw honeybee-PH (a single ``OpaqueConstruction``,
    a name-keyed group, or a full ``Model`` — PRD §2B). Both normalize into the
    same :class:`ParsedConstructionLibrary`.

    Raises :class:`ImportParseError` for an unreadable file, a schema newer
    than this app, multi-row divisions, or a cell referencing a missing
    material.
    """
    if not isinstance(raw, dict):
        raise ImportParseError("import_invalid_file", "Construction library must be a JSON object.")
    envelope = cast(dict[str, Any], raw)

    if envelope.get("type") == LIBRARY_TYPE:
        return _parse_native_library(envelope, current_schema_version)
    return _parse_foreign_constructions(envelope, current_schema_version)


def _parse_native_library(envelope: dict[str, Any], current_schema_version: int) -> ParsedConstructionLibrary:
    schema_version = envelope.get("schema_version")
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise ImportParseError("import_invalid_file", "schema_version must be an integer.")
    if schema_version > current_schema_version:
        raise ImportParseError(
            "import_schema_too_new",
            "This file was exported by a newer version of PH-Navigator.",
            {"schema_version": schema_version, "current_schema_version": current_schema_version},
        )

    constructions_raw = envelope.get("constructions")
    if not isinstance(constructions_raw, dict):
        raise ImportParseError("import_invalid_file", "constructions must be a JSON object.")

    materials: dict[str, ImportedMaterial] = {}
    constructions = [
        _parse_construction(identifier, payload, materials)
        for identifier, payload in cast(dict[str, Any], constructions_raw).items()
    ]
    return ParsedConstructionLibrary(schema_version=schema_version, constructions=constructions, materials=materials)


def _parse_foreign_constructions(envelope: dict[str, Any], current_schema_version: int) -> ParsedConstructionLibrary:
    materials: dict[str, ImportedMaterial] = {}
    constructions = [
        _parse_construction(identifier, payload, materials)
        for identifier, payload in _foreign_constructions(envelope).items()
    ]
    # Foreign files carry no PHN schema; tag them with the current version so the
    # preview/response shape is consistent (there is nothing to "upgrade").
    return ParsedConstructionLibrary(
        schema_version=current_schema_version,
        constructions=constructions,
        materials=materials,
    )


def _foreign_constructions(envelope: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Extract ``{identifier: OpaqueConstruction-dict}`` from a honeybee file."""
    file_type = envelope.get("type")
    if file_type == "OpaqueConstruction":
        return {_as_optional_str(envelope.get("identifier")) or "Imported construction": envelope}

    if file_type == "Model":
        opaque = _opaque_from_list(_as_dict(_as_dict(envelope.get("properties")).get("energy")).get("constructions"))
        if not opaque:
            raise ImportParseError("import_no_constructions", "The model has no opaque constructions to import.")
        return opaque

    # A honeybee "dump objects" group: a name-keyed dict of object dicts.
    group = {
        identifier: cast(dict[str, Any], value)
        for identifier, value in envelope.items()
        if isinstance(value, dict) and value.get("type") == "OpaqueConstruction"
    }
    if group:
        return group
    raise ImportParseError(
        "import_wrong_file_type",
        "File is not a PH-Navigator construction library or a recognizable honeybee opaque construction.",
        {"type": file_type},
    )


def _opaque_from_list(value: object) -> dict[str, dict[str, Any]]:
    return {
        _as_optional_str(item.get("identifier")) or f"Imported construction {index}": cast(dict[str, Any], item)
        for index, item in enumerate(_as_list(value))
        if isinstance(item, dict) and item.get("type") == "OpaqueConstruction"
    }


def parse_or_422(file: object, *, current_schema_version: int) -> ParsedConstructionLibrary:
    """Parse a construction-library file, mapping parse failures to typed 422s.

    Lives beside the parser so both consumers — the preview route (service)
    and the apply command — share one parse-and-map boundary.
    """
    try:
        return parse_construction_library(file, current_schema_version=current_schema_version)
    except ImportParseError as error:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            error.code,
            error.message,
            error.details,
        ) from error


def _parse_construction(
    identifier: str,
    payload: object,
    materials: dict[str, ImportedMaterial],
) -> ImportedConstruction:
    if not isinstance(payload, dict):
        raise ImportParseError("import_invalid_file", "Each construction must be a JSON object.", {"id": identifier})
    construction = cast(dict[str, Any], payload)
    ph_nav = _as_dict(construction.get("ph_nav"))

    layers_outside_in = [
        _parse_layer(layer_payload, materials) for layer_payload in _as_list(construction.get("materials"))
    ]
    orientation = _coerce_orientation(ph_nav.get("orientation"))
    # ``materials[]`` is canonically outside → inside. Reversing for
    # ``last_layer_outside`` restores the original document order (the inverse
    # of ``_layers_outside_to_inside``), so a round-trip yields identical rows.
    layers = list(reversed(layers_outside_in)) if orientation == "last_layer_outside" else layers_outside_in

    name = construction.get("display_name") or identifier
    return ImportedConstruction(
        resolution_key=identifier,
        source_assembly_id=_as_optional_str(ph_nav.get("assembly_id")),
        name=str(name),
        type=_resolve_assembly_type(ph_nav.get("assembly_type"), identifier),
        orientation=orientation,
        layers=layers,
    )


def _parse_layer(
    payload: object,
    materials: dict[str, ImportedMaterial],
) -> ImportedLayer:
    if not isinstance(payload, dict):
        raise ImportParseError("import_invalid_file", "Each layer material must be a JSON object.")
    material = cast(dict[str, Any], payload)
    thickness_mm = _meters_to_mm(material.get("thickness"))
    divisions = _as_dict(_as_dict(_as_dict(material.get("properties")).get("ph")).get("divisions"))

    # honeybee-PH stamps an empty `divisions` block on every material; only a
    # populated `cells` list marks a genuine hybrid (heterogeneous) layer.
    if _as_list(divisions.get("cells")):
        return _parse_hybrid_layer(material, divisions, thickness_mm, materials)
    return _parse_homogeneous_layer(material, thickness_mm, materials)


def _parse_homogeneous_layer(
    material: dict[str, Any],
    thickness_mm: float,
    materials: dict[str, ImportedMaterial],
) -> ImportedLayer:
    ph_nav = _as_dict(material.get("ph_nav"))
    source_key = _register_material(material, materials)
    segment = ImportedSegment(
        source_material_key=source_key,
        width_mm=DEFAULT_LAYER_WIDTH_MM,
        is_continuous_insulation=bool(ph_nav.get("is_continuous_insulation", False)),
        steel_stud_spacing_mm=_as_optional_float(ph_nav.get("steel_stud_spacing_mm")),
        source_segment_id=_as_optional_str(ph_nav.get("segment_id")),
    )
    return ImportedLayer(
        thickness_mm=thickness_mm,
        segments=[segment],
        source_layer_id=_as_optional_str(ph_nav.get("layer_id")),
    )


def _parse_hybrid_layer(
    material: dict[str, Any],
    divisions: dict[str, Any],
    thickness_mm: float,
    materials: dict[str, ImportedMaterial],
) -> ImportedLayer:
    row_heights = _as_list(divisions.get("row_heights"))
    if len(row_heights) > 1:
        # The export only ever emits a single row; >1 means a malformed or
        # foreign multi-row grid we do not model (V1 also rejected this).
        raise ImportParseError("import_unsupported_divisions", "Multi-row layer divisions are not supported.")

    cells = _as_list(divisions.get("cells"))
    if not cells:
        raise ImportParseError("import_invalid_file", "A hybrid layer must carry at least one division cell.")

    segments: list[ImportedSegment] = []
    for cell in cells:
        cell_dict = _as_dict(cell)
        cell_material = _as_dict(cell_dict.get("material"))
        if not cell_material:
            raise ImportParseError("import_missing_cell_material", "A division cell is missing its material.")
        cell_ph_nav = _as_dict(cell_dict.get("ph_nav"))
        segments.append(
            ImportedSegment(
                source_material_key=_register_material(cell_material, materials),
                width_mm=_meters_to_mm(cell_dict.get("column_width")),
                is_continuous_insulation=bool(cell_ph_nav.get("is_continuous_insulation", False)),
                steel_stud_spacing_mm=_as_optional_float(cell_ph_nav.get("steel_stud_spacing_mm")),
                source_segment_id=_as_optional_str(cell_ph_nav.get("segment_id")),
            )
        )
    return ImportedLayer(
        thickness_mm=thickness_mm,
        segments=segments,
        source_layer_id=_as_optional_str(_as_dict(material.get("ph_nav")).get("layer_id")),
    )


def _register_material(material: dict[str, Any], materials: dict[str, ImportedMaterial]) -> str:
    """Intern one source material, returning its dedup key.

    Native files share one ``pmat_*`` per distinct material, so the first
    occurrence wins and later layers referencing the same id collapse onto it
    (PRD §5 intra-file dedup). Materials without an id get a synthetic key off
    their identifier so two truly distinct anonymous materials stay separate.
    """
    ph_nav = _as_dict(material.get("ph_nav"))
    source_key = _as_optional_str(ph_nav.get("project_material_id")) or f"__anon__{material.get('identifier', '')}"
    if source_key not in materials:
        materials[source_key] = _imported_material(source_key, material, ph_nav)
    return source_key


def _imported_material(source_key: str, material: dict[str, Any], ph_nav: dict[str, Any]) -> ImportedMaterial:
    catalog_origin = ph_nav.get("catalog_origin")
    return ImportedMaterial(
        source_key=source_key,
        name=str(material.get("display_name") or material.get("identifier") or "Imported material"),
        catalog_origin=catalog_origin if isinstance(catalog_origin, dict) else None,
        conductivity_w_mk=_as_optional_float(material.get("conductivity")),
        density_kg_m3=_as_optional_float(material.get("density")),
        specific_heat_j_kgk=_as_optional_float(material.get("specific_heat")),
        # Export writes all three absorptances from the single emissivity; read any one back.
        emissivity=_as_optional_float(material.get("thermal_absorptance")),
        color=_material_color(material),
        specification_status=_coerce_specification_status(_ref_status(material)),
    )


def _material_color(material: dict[str, Any]) -> str | None:
    return _as_optional_str(_as_dict(_as_dict(material.get("properties")).get("ph")).get("ph_color"))


def _ref_status(material: dict[str, Any]) -> object:
    return _as_dict(_as_dict(material.get("properties")).get("ref")).get("ref_status")


def _resolve_assembly_type(explicit: object, identifier: str) -> AssemblyType:
    """Use an explicit native type when present, else the identifier prefix.

    Honeybee-PH conventionally prefixes construction identifiers `W_`/`R_`/`F_`;
    native exports always carry an explicit type, so the heuristic only fires on
    foreign files (and the user can still override it in the preview).
    """
    if isinstance(explicit, str) and explicit in _ASSEMBLY_TYPES:
        return cast(AssemblyType, explicit)
    return _ASSEMBLY_TYPE_PREFIXES.get(identifier[:2].upper(), "other")


def _coerce_orientation(value: object) -> AssemblyOrientation:
    if isinstance(value, str) and value in _ORIENTATIONS:
        return cast(AssemblyOrientation, value)
    return "first_layer_outside"


def _coerce_specification_status(value: object) -> SpecificationStatus | None:
    if isinstance(value, str) and value in _SPECIFICATION_STATUSES:
        return cast(SpecificationStatus, value)
    return None


def _meters_to_mm(value: object) -> float:
    number = _as_optional_float(value)
    if number is None or number <= 0:
        raise ImportParseError("import_invalid_file", "A dimension is missing or non-positive.", {"value": value})
    return number * 1000.0


def _as_dict(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def _as_list(value: object) -> list[Any]:
    return cast(list[Any], value) if isinstance(value, list) else []


def _as_optional_str(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _as_optional_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None
