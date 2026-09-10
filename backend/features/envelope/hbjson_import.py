"""Parse a PHN-native HBJSON construction library into an import IR.

The direct reverse of ``hbjson_export.py`` for the
``PHNavigatorOpaqueConstructionLibrary`` shape (PRD §2A). The file only
*mimics* the Honeybee object model, so there is no honeybee runtime
dependency here — ``json.loads`` plus the field mapping below. The raw
Honeybee-PH front-end (PRD §2B) normalizes a single ``OpaqueConstruction``,
a name-keyed group, or a full ``Model`` into the same
:class:`ParsedConstructionLibrary` IR so the matching/apply stages stay
source-agnostic.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any, TypeVar, cast, get_args

from starlette import status

from features.catalogs.materials.models import MEMBRANE_CATEGORY_ID
from features.envelope.honeybee_specification_status import from_external_ref_status
from features.project_document.custom_fields import normalize_display_name
from features.project_document.envelope_models import (
    SPECIFICATION_STATUSES,
    AssemblyFace,
    AssemblyOrientation,
    AssemblyType,
    ExteriorCondition,
    SpecificationStatus,
)
from features.shared.errors import api_error

LIBRARY_TYPE = "PHNavigatorOpaqueConstructionLibrary"

# ``Model.to_dict()`` writes the abridged form; a single object or a "dump
# objects" group writes the full one. Both are read.
_OPAQUE_CONSTRUCTION_TYPES: frozenset[str] = frozenset({"OpaqueConstruction", "OpaqueConstructionAbridged"})

# Two rejections a *foreign* file survives one construction at a time (in a
# native file they are still a 422, like every other parse error).
IMPORT_UNSUPPORTED_LAYER_TYPE = "import_unsupported_layer_type"
IMPORT_MATERIAL_UNRESOLVED = "import_material_unresolved"

# A honeybee-PH division grid holds one spacing for the whole layer, so an
# imported segment cannot know whether it is the stud or the cavity beside it.
WARN_STEEL_STUD_SPACING_FROM_GRID = "steel_stud_spacing_from_grid"

# Default span for a homogeneous (single-segment) layer. The width of a
# full-width segment is thermally irrelevant (it is 100% of the layer); the
# export does not emit one, so import mints this canonical value (matching
# ``create_assembly``'s default).
DEFAULT_LAYER_WIDTH_MM = 1000.0

# Fallback thickness for a membrane whose exported value is missing or
# nonsensical (a hand-edited file). 0.15 mm is 6-mil poly — the canonical
# sheet good — and the document requires a positive thickness.
DEFAULT_MEMBRANE_THICKNESS_MM = 0.15
DEFAULT_MEMBRANE_NAME = "Membrane"

# Derived from the Literals rather than transcribed, so a new member cannot be
# added to the document model while the importer silently keeps defaulting it.
_ASSEMBLY_TYPES: frozenset[str] = frozenset(get_args(AssemblyType))
_ASSEMBLY_TYPE_PREFIXES: dict[str, AssemblyType] = {"W_": "wall", "R_": "roof", "F_": "floor"}
_ORIENTATIONS: frozenset[str] = frozenset(get_args(AssemblyOrientation))
_EXTERIOR_CONDITIONS: frozenset[str] = frozenset(get_args(ExteriorCondition))
_ASSEMBLY_FACES: frozenset[str] = frozenset(get_args(AssemblyFace))

_LiteralT = TypeVar("_LiteralT", bound=str)


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
    # Only membranes carry these: a honeybee `EnergyMaterial` has no field for
    # either, so they survive a round trip solely through `ph_nav`.
    category: str | None = None
    air_permeance_l_s_m2_at_75pa: float | None = None


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
    # Codes for values the parser had to approximate (see `WARN_*`). Surfaced
    # on the construction's preview row so the user can correct them.
    warnings: list[str] = field(default_factory=list)


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
    exterior_condition: ExteriorCondition
    layers: list[ImportedLayer]
    # `{layer_id, face}` as exported, keyed by the *source* layer id — the
    # rebuilt assembly may mint fresh ids, so the caller remaps it. None for a
    # foreign file or an assembly with no designation.
    air_barrier: dict[str, Any] | None = None

    @property
    def warnings(self) -> list[str]:
        """Codes for values the parser had to approximate, layer codes deduped."""
        return list(dict.fromkeys(warning for layer in self.layers for warning in layer.warnings))


@dataclass(frozen=True)
class SkippedConstruction:
    """A foreign construction PH-Navigator cannot represent.

    Reported in the preview as its own row (action `skip`, non-overridable)
    rather than failing the file: a honeybee model mixes constructions this
    app can hold with ones it cannot, and importing the readable ones is
    worth more than an all-or-nothing rejection.
    """

    resolution_key: str
    name: str
    reason: str


@dataclass
class ParsedConstructionLibrary:
    schema_version: int
    constructions: list[ImportedConstruction]
    materials: dict[str, ImportedMaterial]
    warnings: list[str] = field(default_factory=list)
    skipped: list[SkippedConstruction] = field(default_factory=list)


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
    payloads, materials_by_identifier = _foreign_constructions(envelope)
    materials: dict[str, ImportedMaterial] = {}
    constructions: list[ImportedConstruction] = []
    skipped: list[SkippedConstruction] = []
    for identifier, payload in payloads.items():
        # Stage the material registrations so a construction that fails
        # mid-parse leaves no orphan material behind for the planner to create.
        staged = dict(materials)
        try:
            resolved = _resolve_layer_materials(payload, materials_by_identifier)
            constructions.append(_parse_construction(identifier, resolved, staged))
        except ImportParseError as error:
            skipped.append(
                SkippedConstruction(
                    resolution_key=identifier,
                    name=_construction_name(payload, identifier),
                    reason=error.code,
                )
            )
        else:
            materials = staged
    # Foreign files carry no PHN schema; tag them with the current version so the
    # preview/response shape is consistent (there is nothing to "upgrade").
    return ParsedConstructionLibrary(
        schema_version=current_schema_version,
        constructions=constructions,
        materials=materials,
        skipped=skipped,
    )


def _foreign_constructions(envelope: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Extract the opaque constructions and the material table of a honeybee file.

    The second element resolves the *abridged* form: ``Model.to_dict()`` writes
    every construction as an ``OpaqueConstructionAbridged`` whose ``materials``
    are identifier strings, with the material dicts themselves in a sibling
    ``properties.energy.materials`` list. Only a model carries that list, so the
    single-object and group shapes resolve against an empty one.
    """
    file_type = envelope.get("type")
    if file_type in _OPAQUE_CONSTRUCTION_TYPES:
        return {_as_optional_str(envelope.get("identifier")) or "Imported construction": envelope}, {}

    if file_type == "Model":
        energy = _as_dict(_as_dict(envelope.get("properties")).get("energy"))
        opaque = _opaque_from_list(energy.get("constructions"))
        if not opaque:
            raise ImportParseError("import_no_constructions", "The model has no opaque constructions to import.")
        return opaque, _materials_by_identifier(energy.get("materials"))

    # A honeybee "dump objects" group: a name-keyed dict of object dicts.
    group = {
        identifier: cast(dict[str, Any], value)
        for identifier, value in envelope.items()
        if isinstance(value, dict) and value.get("type") in _OPAQUE_CONSTRUCTION_TYPES
    }
    if group:
        return group, {}
    raise ImportParseError(
        "import_wrong_file_type",
        "File is not a PH-Navigator construction library or a recognizable honeybee opaque construction.",
        {"type": file_type},
    )


def _opaque_from_list(value: object) -> dict[str, dict[str, Any]]:
    return {
        _as_optional_str(item.get("identifier")) or f"Imported construction {index}": cast(dict[str, Any], item)
        for index, item in enumerate(_as_list(value))
        if isinstance(item, dict) and item.get("type") in _OPAQUE_CONSTRUCTION_TYPES
    }


def _materials_by_identifier(value: object) -> dict[str, dict[str, Any]]:
    return {
        identifier: cast(dict[str, Any], item)
        for item in _as_list(value)
        if isinstance(item, dict) and (identifier := _as_optional_str(item.get("identifier"))) is not None
    }


def _resolve_layer_materials(
    construction: dict[str, Any],
    materials_by_identifier: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Replace an abridged construction's material identifiers with their dicts.

    A construction naming a material the file does not carry is skipped rather
    than guessed at: inventing a layer would silently change the assembly's
    U-value.
    """
    resolved = [
        _material_by_identifier(layer, materials_by_identifier) if isinstance(layer, str) else layer
        for layer in _as_list(construction.get("materials"))
    ]
    return {**construction, "materials": resolved}


def _material_by_identifier(identifier: str, materials_by_identifier: dict[str, dict[str, Any]]) -> dict[str, Any]:
    material = materials_by_identifier.get(identifier)
    if material is None:
        raise ImportParseError(
            IMPORT_MATERIAL_UNRESOLVED,
            "A construction layer references a material the file does not contain.",
            {"identifier": identifier},
        )
    return material


def _construction_name(construction: dict[str, Any], identifier: str) -> str:
    return str(construction.get("display_name") or identifier)


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
    ph_nav = _ph_nav(construction)

    layers_outside_in = [
        _parse_layer(layer_payload, materials) for layer_payload in _as_list(construction.get("materials"))
    ]
    # Membranes were omitted from `materials[]` on export (an `EnergyMaterial`
    # needs a positive conductivity, which they have none of) and carried in
    # `ph_nav` instead. Splice them back at their recorded positions so the
    # round trip is lossless; a foreign file has no such block and is
    # unaffected.
    layers_outside_in = _splice_membrane_layers(layers_outside_in, _as_list(ph_nav.get("membrane_layers")), materials)
    orientation = _coerce_literal(ph_nav.get("orientation"), _ORIENTATIONS, "first_layer_outside")
    # ``materials[]`` is canonically outside → inside. Reversing for
    # ``last_layer_outside`` restores the original document order (the inverse
    # of ``_layers_outside_to_inside``), so a round-trip yields identical rows.
    layers = list(reversed(layers_outside_in)) if orientation == "last_layer_outside" else layers_outside_in

    return ImportedConstruction(
        resolution_key=identifier,
        source_assembly_id=_as_optional_str(ph_nav.get("assembly_id")),
        name=_construction_name(construction, identifier),
        type=_resolve_assembly_type(ph_nav.get("assembly_type"), identifier),
        orientation=orientation,
        # Honeybee keeps boundary conditions on faces, so a foreign file has no
        # construction-level equivalent to map from — it takes the document default.
        exterior_condition=_coerce_literal(ph_nav.get("exterior_condition"), _EXTERIOR_CONDITIONS, "outdoor_air"),
        layers=layers,
        air_barrier=_parse_air_barrier(ph_nav.get("air_barrier")),
    )


def _parse_air_barrier(value: object) -> dict[str, Any] | None:
    """Accept only a well-formed designation; a malformed one is dropped, not raised.

    Import is forgiving by design — a foreign or hand-edited file should lose an
    annotation, not fail the whole construction.
    """
    if not isinstance(value, dict):
        return None
    payload = cast(dict[str, Any], value)
    layer_id = _as_optional_str(payload.get("layer_id"))
    face = _as_optional_str(payload.get("face"))
    if layer_id is None or face not in _ASSEMBLY_FACES:
        return None
    return {"layer_id": layer_id, "face": face}


def _splice_membrane_layers(
    layers_outside_in: list[ImportedLayer],
    membrane_payloads: list[Any],
    materials: dict[str, ImportedMaterial],
) -> list[ImportedLayer]:
    """Reinsert the exported membrane layers at their outside→inside indices.

    Insertions are applied in ascending index order, so each one lands at the
    position it recorded — the same reason a caller inserting into a list walks
    forwards rather than backwards. An index past the end appends, which is the
    honest fallback for a hand-edited file rather than a hard failure.
    """
    if not membrane_payloads:
        return layers_outside_in

    entries: list[tuple[int, ImportedLayer]] = []
    for payload in membrane_payloads:
        if not isinstance(payload, dict):
            continue
        membrane = cast(dict[str, Any], payload)
        material = _as_dict(membrane.get("material"))
        source_key = _register_membrane_material(material, materials)
        thickness_mm = _as_optional_float(membrane.get("thickness_mm"))
        width_mm = _as_optional_float(membrane.get("width_mm"))
        entries.append(
            (
                int(_as_optional_float(membrane.get("outside_index")) or 0),
                ImportedLayer(
                    thickness_mm=thickness_mm if thickness_mm and thickness_mm > 0 else DEFAULT_MEMBRANE_THICKNESS_MM,
                    segments=[
                        ImportedSegment(
                            source_material_key=source_key,
                            width_mm=width_mm if width_mm and width_mm > 0 else DEFAULT_LAYER_WIDTH_MM,
                            is_continuous_insulation=False,
                            steel_stud_spacing_mm=None,
                            source_segment_id=_as_optional_str(membrane.get("segment_id")),
                        )
                    ],
                    source_layer_id=_as_optional_str(membrane.get("layer_id")),
                ),
            )
        )

    spliced = list(layers_outside_in)
    for index, layer in sorted(entries, key=lambda entry: entry[0]):
        # Clamp both ends. An unclamped negative index would be read as
        # Python's own insert-before-the-end, quietly landing the layer in the
        # middle of a hand-edited file rather than at the start.
        spliced.insert(max(0, min(index, len(spliced))), layer)
    return spliced


def _register_membrane_material(
    material: dict[str, Any],
    materials: dict[str, ImportedMaterial],
) -> str:
    """Register a membrane from its `ph_nav` payload — no honeybee shape to read."""
    # A membrane with no name still has a real thickness and position. Falling
    # back to a placeholder keeps the layer; returning None would delete it
    # from the assembly with nothing surfaced to the user.
    name = _as_optional_str(material.get("name")) or DEFAULT_MEMBRANE_NAME
    source_key = _as_optional_str(material.get("project_material_id")) or f"__membrane__{name}"
    if source_key not in materials:
        catalog_origin = material.get("catalog_origin")
        materials[source_key] = ImportedMaterial(
            source_key=source_key,
            name=name,
            catalog_origin=cast(dict[str, Any], catalog_origin) if isinstance(catalog_origin, dict) else None,
            # Membranes have no conductivity by design; the thermal engine
            # excludes them, so importing one must not invent a value.
            conductivity_w_mk=None,
            density_kg_m3=_as_optional_float(material.get("density_kg_m3")),
            specific_heat_j_kgk=_as_optional_float(material.get("specific_heat_j_kgk")),
            emissivity=_as_optional_float(material.get("emissivity")),
            color=_as_optional_str(material.get("color")),
            specification_status=_membrane_specification_status(material.get("specification_status")),
            category=_as_optional_str(material.get("category")) or MEMBRANE_CATEGORY_ID,
            air_permeance_l_s_m2_at_75pa=_as_optional_float(material.get("air_permeance_l_s_m2_at_75pa")),
        )
    return source_key


def _membrane_specification_status(value: object) -> SpecificationStatus | None:
    """The membrane block stores PHN's own status verbatim, not a honeybee ref status."""
    return cast(SpecificationStatus, value) if value in SPECIFICATION_STATUSES else None


def _parse_layer(
    payload: object,
    materials: dict[str, ImportedMaterial],
) -> ImportedLayer:
    if not isinstance(payload, dict):
        raise ImportParseError("import_invalid_file", "Each layer material must be a JSON object.")
    material = cast(dict[str, Any], payload)
    if material.get("thickness") is None:
        # `EnergyMaterialNoMass` — the core of honeybee-PH's declared-U
        # sandwich — carries a bare R-value, and a PH-Navigator layer has
        # nowhere to hold one.
        raise ImportParseError(
            IMPORT_UNSUPPORTED_LAYER_TYPE,
            "A construction layer uses a honeybee material with no thickness.",
            {"type": _as_optional_str(material.get("type"))},
        )
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
    ph_nav = _ph_nav(material)
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

    # Widths live on the grid, not the cell: `PhDivisionCell.to_dict` writes
    # `{row, column, material}`, and the web download format writes
    # `column_widths` alongside its own per-cell copy.
    column_widths = _as_list(divisions.get("column_widths"))
    grid_spacing = _as_optional_float(divisions.get("steel_stud_spacing_mm"))
    cells = [
        cell for cell in map(_as_dict, _as_list(divisions.get("cells"))) if not _as_optional_float(cell.get("row"))
    ]
    if not cells:
        raise ImportParseError("import_invalid_file", "A hybrid layer must carry at least one division cell.")

    warnings: list[str] = []
    segments: list[ImportedSegment] = []
    for index, cell_dict in enumerate(cells):
        cell_material = _as_dict(cell_dict.get("material"))
        if not cell_material:
            raise ImportParseError("import_missing_cell_material", "A division cell is missing its material.")
        cell_ph_nav = _ph_nav(cell_dict)
        spacing = _as_optional_float(cell_ph_nav.get("steel_stud_spacing_mm"))
        if spacing is None and grid_spacing is not None:
            # The grid's spacing describes the whole layer, so it lands on every
            # segment; the warning tells the user to trim it to the studs.
            spacing = grid_spacing
            warnings.append(WARN_STEEL_STUD_SPACING_FROM_GRID)
        segments.append(
            ImportedSegment(
                source_material_key=_register_material(cell_material, materials),
                width_mm=_cell_width_mm(cell_dict, column_widths, index),
                is_continuous_insulation=bool(cell_ph_nav.get("is_continuous_insulation", False)),
                steel_stud_spacing_mm=spacing,
                source_segment_id=_as_optional_str(cell_ph_nav.get("segment_id")),
            )
        )
    return ImportedLayer(
        thickness_mm=thickness_mm,
        segments=segments,
        source_layer_id=_as_optional_str(_ph_nav(material).get("layer_id")),
        warnings=list(dict.fromkeys(warnings)),
    )


def _cell_width_mm(cell: dict[str, Any], column_widths: list[Any], index: int) -> float:
    """The width of the grid column this cell sits in.

    honeybee-PH names the column; the web download format omits it and emits
    the cells in column order, so the position stands in.
    """
    column = int(_as_optional_float(cell.get("column")) or index)
    if 0 <= column < len(column_widths):
        return _meters_to_mm(column_widths[column])
    raise ImportParseError("import_invalid_file", "A division cell has no width.", {"column": column})


def _register_material(material: dict[str, Any], materials: dict[str, ImportedMaterial]) -> str:
    """Intern one source material, returning its dedup key.

    Native files share one ``pmat_*`` per distinct material, so the first
    occurrence wins and later layers referencing the same id collapse onto it
    (PRD §5 intra-file dedup). A foreign material has no such id, and its
    honeybee identifier is per-layer (one product used in three layers is three
    identifiers), so it keys on the values that make it that product instead.
    """
    ph_nav = _ph_nav(material)
    imported = _imported_material(material, ph_nav)
    source_key = _project_material_id(material, ph_nav) or _value_key(imported)
    if source_key not in materials:
        materials[source_key] = replace(imported, source_key=source_key)
    return source_key


def _project_material_id(material: dict[str, Any], ph_nav: dict[str, Any]) -> str | None:
    """The material's PH-Navigator id, from either slot an exporter writes it to.

    The download format puts it in its own `ph_nav` block; the Grasshopper
    export has only honeybee objects to work with and puts it in honeybee-ref's
    external identifiers, which survives a Rhino round trip.
    """
    external = _as_dict(_as_dict(_as_dict(material.get("properties")).get("ref")).get("external_identifiers"))
    return _as_optional_str(ph_nav.get("project_material_id")) or _as_optional_str(external.get("ph_nav"))


def _value_key(material: ImportedMaterial) -> str:
    """Identity for a material with no PH-Navigator id: name plus its values.

    Thickness stays out of it — that belongs to the layer, not the product —
    so the same insulation at two depths is still one project material.
    """
    values = (
        material.conductivity_w_mk,
        material.density_kg_m3,
        material.specific_heat_j_kgk,
        material.emissivity,
        material.color,
    )
    return "__value__" + "|".join(
        [normalize_display_name(material.name), *("" if value is None else str(value) for value in values)]
    )


def _imported_material(material: dict[str, Any], ph_nav: dict[str, Any]) -> ImportedMaterial:
    """The IR record, before it is keyed. `_register_material` stamps the key."""
    catalog_origin = ph_nav.get("catalog_origin")
    return ImportedMaterial(
        source_key="",
        name=str(material.get("display_name") or material.get("identifier") or "Imported material"),
        catalog_origin=catalog_origin if isinstance(catalog_origin, dict) else None,
        conductivity_w_mk=_as_optional_float(material.get("conductivity")),
        density_kg_m3=_as_optional_float(material.get("density")),
        specific_heat_j_kgk=_as_optional_float(material.get("specific_heat")),
        # Export writes all three absorptances from the single emissivity; read any one back.
        emissivity=_as_optional_float(material.get("thermal_absorptance")),
        color=_material_color(material),
        specification_status=from_external_ref_status(_ref_status(material)),
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


def _coerce_literal(value: object, allowed: frozenset[str], default: _LiteralT) -> _LiteralT:
    """Accept a raw value only when it is a member of its Literal, else default.

    Used for the `ph_nav` fields a foreign (non-PHN) file simply will not
    carry: `orientation` and `exterior_condition` both have a well-defined
    fallback, so an absent or unrecognized value is not an error.
    """
    if isinstance(value, str) and value in allowed:
        return cast(_LiteralT, value)
    return default


def _meters_to_mm(value: object) -> float:
    number = _as_optional_float(value)
    if number is None or number <= 0:
        raise ImportParseError("import_invalid_file", "A dimension is missing or non-positive.", {"value": value})
    return number * 1000.0


def _ph_nav(payload: dict[str, Any]) -> dict[str, Any]:
    """The additive PH-Navigator block, from either slot it can occupy.

    The web download format puts it on a top-level ``ph_nav`` key, which it can
    do because that format is not a honeybee object. A honeybee ``Model``
    preserves only ``user_data``, so PH-Navigator for SketchUp writes the same
    block, in the same shape, under ``user_data["ph_nav"]``. The rule is the
    same for constructions, layer materials, and division cells.
    """
    return _as_dict(payload.get("ph_nav")) or _as_dict(_as_dict(payload.get("user_data")).get("ph_nav"))


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
