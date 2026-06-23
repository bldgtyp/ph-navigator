"""Material-matching ladder + apply planning for HBJSON construction import.

`build_import_plan` is the single source of truth for both consumers: the
preview route renders its summary as a dry run, and the
`import_envelope_constructions` command returns its `next_body`. Running the
same deterministic plan server-side on apply means the preview the user
confirmed is exactly what lands (PRD §6).
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from psycopg import Connection

from features.catalogs.materials import repository as catalog_materials_repository
from features.envelope import ops
from features.envelope.commands.materials import new_hand_entered_material, project_material_from_catalog
from features.envelope.hbjson_import import ImportedConstruction, ImportedMaterial, ParsedConstructionLibrary
from features.envelope.identifiers import (
    ID_PREFIX_ASSEMBLY,
    ID_PREFIX_LAYER,
    ID_PREFIX_SEGMENT,
    new_id,
)
from features.envelope.import_models import (
    ConstructionPlanItem,
    ConstructionResolution,
    ImportPlanCounts,
    MaterialPlanItem,
)
from features.project_document.custom_fields import normalize_display_name
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    ProjectDocumentV1,
    ProjectMaterial,
)


@dataclass
class ImportPlanResult:
    schema_version: int
    constructions: list[ConstructionPlanItem]
    materials: list[MaterialPlanItem]
    counts: ImportPlanCounts
    warnings: list[str]
    next_body: ProjectDocumentV1


def build_import_plan(
    conn: Connection[Any],
    body: ProjectDocumentV1,
    library: ParsedConstructionLibrary,
    resolutions: list[ConstructionResolution],
) -> ImportPlanResult:
    resolution_map, new_materials, material_items = _resolve_materials(conn, body, library)

    resolutions_by_source = {resolution.source_assembly_id: resolution for resolution in resolutions}
    existing_assembly_ids = {assembly.id for assembly in body.tables.assemblies}

    assemblies = list(body.tables.assemblies)
    construction_items: list[ConstructionPlanItem] = []
    counts = ImportPlanCounts()

    for construction in library.constructions:
        action, target_id, warnings = _decide_action(construction, resolutions_by_source, existing_assembly_ids)
        if action == "skip":
            counts.constructions_skip += 1
        elif action == "replace":
            assembly = _build_assembly(construction, target_id or "", resolution_map, construction.name)
            assemblies = [assembly if existing.id == assembly.id else existing for existing in assemblies]
            counts.constructions_replace += 1
        else:  # add_new
            name = ops.next_unique_name([item.name for item in assemblies], construction.name, new_id("import"))
            assembly = _build_assembly(construction, new_id(ID_PREFIX_ASSEMBLY), resolution_map, name)
            assemblies.append(assembly)
            counts.constructions_add += 1
        construction_items.append(
            ConstructionPlanItem(
                source_assembly_id=construction.source_assembly_id,
                name=construction.name,
                action=action,
                target_assembly_id=target_id,
                warnings=warnings,
            )
        )

    _tally_material_counts(material_items, counts)

    # Swap both tables in one validated pass — the combined document carries the
    # new materials, so the new assemblies' references resolve atomically.
    next_body = ops.replace_materials_and_assemblies(
        body,
        [*body.tables.project_materials, *new_materials],
        assemblies,
    )

    return ImportPlanResult(
        schema_version=library.schema_version,
        constructions=construction_items,
        materials=material_items,
        counts=counts,
        warnings=library.warnings,
        next_body=next_body,
    )


# --- material matching ladder (PRD §5 rungs 1–6) --------------------------


def _resolve_materials(
    conn: Connection[Any],
    body: ProjectDocumentV1,
    library: ParsedConstructionLibrary,
) -> tuple[dict[str, str], list[ProjectMaterial], list[MaterialPlanItem]]:
    existing_ids = {material.id for material in body.tables.project_materials}
    by_catalog_record: dict[str, list[ProjectMaterial]] = {}
    by_name: dict[str, list[ProjectMaterial]] = {}
    for material in body.tables.project_materials:
        if material.catalog_origin is not None:
            by_catalog_record.setdefault(material.catalog_origin.catalog_record_id, []).append(material)
        by_name.setdefault(normalize_display_name(material.name), []).append(material)

    indexes = _MaterialIndexes(
        existing_ids=existing_ids,
        by_catalog_record=by_catalog_record,
        by_name=by_name,
        catalog_row=_memoized_catalog_row(conn),
        catalog_by_name=_lazy_catalog_by_name(conn),
    )

    resolution_map: dict[str, str] = {}
    new_materials: list[ProjectMaterial] = []
    items: list[MaterialPlanItem] = []
    for source_key, material in library.materials.items():
        item = _resolve_one_material(material, indexes, new_materials)
        resolution_map[source_key] = item.project_material_id
        items.append(item)
    return resolution_map, new_materials, items


@dataclass(frozen=True)
class _MaterialIndexes:
    """Lookups shared across the matching ladder for one import."""

    existing_ids: set[str]
    by_catalog_record: dict[str, list[ProjectMaterial]]
    by_name: dict[str, list[ProjectMaterial]]
    catalog_row: Callable[[str], dict[str, Any] | None]
    catalog_by_name: Callable[[str], dict[str, Any] | None]


def _memoized_catalog_row(conn: Connection[Any]) -> Callable[[str], dict[str, Any] | None]:
    """One catalog lookup per distinct record id, even across repeated calls."""
    cache: dict[str, dict[str, Any] | None] = {}

    def lookup(record_id: str) -> dict[str, Any] | None:
        if record_id not in cache:
            cache[record_id] = catalog_materials_repository.get_material(conn, record_id)
        return cache[record_id]

    return lookup


def _lazy_catalog_by_name(conn: Connection[Any]) -> Callable[[str], dict[str, Any] | None]:
    """Resolve an active catalog row by normalized name; loads the table once,
    and only if a name-match rung is actually reached."""
    index: dict[str, dict[str, Any]] | None = None

    def lookup(normalized_name: str) -> dict[str, Any] | None:
        nonlocal index
        if index is None:
            index = {}
            for row in catalog_materials_repository.list_materials(conn):
                index.setdefault(normalize_display_name(row["name"]), row)  # first active row wins
        return index.get(normalized_name)

    return lookup


def _resolve_one_material(
    material: ImportedMaterial,
    indexes: _MaterialIndexes,
    new_materials: list[ProjectMaterial],
) -> MaterialPlanItem:
    catalog_record_id = _materials_catalog_record_id(material.catalog_origin)

    # Rung 1 — by project material id (round-trip / same-project reuse).
    if material.source_key in indexes.existing_ids:
        return _material_item(material, "reuse_project_material", material.source_key, catalog_record_id)

    warnings: list[str] = []
    if catalog_record_id is not None:
        # Rung 2 — an existing project material already came from this catalog row.
        matches = indexes.by_catalog_record.get(catalog_record_id, [])
        if len(matches) == 1:
            return _material_item(material, "reuse_catalog_in_project", matches[0].id, catalog_record_id)
        if len(matches) > 1:
            # `pick_catalog_material` refuses to choose; rather than abort the
            # whole import, re-pick a fresh copy and surface the ambiguity.
            warnings.append("ambiguous_in_project_catalog_material")

        # Rung 3 — pick a fresh copy from the live global catalog (D3).
        row = indexes.catalog_row(catalog_record_id)
        if row is not None and row["is_active"]:
            created = project_material_from_catalog(row)
            new_materials.append(created)
            return _material_item(material, "pick_from_catalog", created.id, catalog_record_id, warnings)
        warnings.append("catalog_material_missing" if row is None else "catalog_material_inactive")

    # Rungs 4–5 — name matches (foreign files / V1 fallback). Fuzzy by nature, so
    # every hit carries a warning the preview surfaces for confirmation.
    normalized = normalize_display_name(material.name)
    name_matches = indexes.by_name.get(normalized, [])
    if len(name_matches) == 1:
        # Rung 4 — a single same-named project material → reuse it.
        warnings.append("name_matched_project_material")
        return _material_item(material, "reuse_project_material", name_matches[0].id, catalog_record_id, warnings)
    if len(name_matches) > 1:
        warnings.append("ambiguous_name_in_project")

    catalog_named = indexes.catalog_by_name(normalized)
    if catalog_named is not None:
        # Rung 5 — a same-named active catalog row → pick a fresh copy.
        created = project_material_from_catalog(catalog_named)
        new_materials.append(created)
        warnings.append("name_matched_catalog_material")
        return _material_item(material, "pick_from_catalog", created.id, catalog_named["id"], warnings)

    # Rung 6 — hand-entered, project-only (D4).
    created = _create_project_material(material)
    new_materials.append(created)
    return _material_item(material, "create_new", created.id, catalog_record_id, warnings)


def _create_project_material(material: ImportedMaterial) -> ProjectMaterial:
    return new_hand_entered_material(
        name=material.name,
        # The export does not carry `category`; create-new defaults it (D4 / Phase 1 plan).
        category="Other",
        # Clamp the file's values to the model's domain (a hand-edited file may
        # carry out-of-range numbers a native export never would).
        conductivity_w_mk=_positive_or_none(material.conductivity_w_mk),
        density_kg_m3=_non_negative_or_none(material.density_kg_m3),
        specific_heat_j_kgk=_non_negative_or_none(material.specific_heat_j_kgk),
        emissivity=_unit_interval_or_none(material.emissivity),
        color=material.color,
        specification_status=material.specification_status or "missing",
    )


def _materials_catalog_record_id(catalog_origin: dict[str, Any] | None) -> str | None:
    if not isinstance(catalog_origin, dict):
        return None
    if catalog_origin.get("catalog_table") != "materials":
        return None
    record_id = catalog_origin.get("catalog_record_id")
    return record_id if isinstance(record_id, str) and record_id else None


def _material_item(
    material: ImportedMaterial,
    decision: Any,
    project_material_id: str,
    catalog_record_id: str | None,
    warnings: list[str] | None = None,
) -> MaterialPlanItem:
    return MaterialPlanItem(
        source_key=material.source_key,
        name=material.name,
        decision=decision,
        project_material_id=project_material_id,
        catalog_record_id=catalog_record_id,
        warnings=warnings or [],
    )


def _tally_material_counts(items: list[MaterialPlanItem], counts: ImportPlanCounts) -> None:
    for item in items:
        if item.decision in ("reuse_project_material", "reuse_catalog_in_project"):
            counts.materials_reused += 1
        elif item.decision == "pick_from_catalog":
            counts.materials_picked_from_catalog += 1
        else:
            counts.materials_created += 1


# --- assembly construction (PRD §6 collision policy / D5) ------------------


def _decide_action(
    construction: ImportedConstruction,
    resolutions_by_source: dict[str, ConstructionResolution],
    existing_assembly_ids: set[str],
) -> tuple[Any, str | None, list[str]]:
    source_id = construction.source_assembly_id
    matches_existing = source_id is not None and source_id in existing_assembly_ids
    resolution = resolutions_by_source.get(source_id) if source_id is not None else None
    action = resolution.action if resolution is not None else ("replace" if matches_existing else "add_new")

    if action != "replace":
        return action, None, []

    target_id = (resolution.target_assembly_id if resolution else None) or source_id
    if target_id is None or target_id not in existing_assembly_ids:
        # Nothing to replace — fall back to add so the construction still lands.
        return "add_new", None, ["replace_target_missing"]
    return "replace", target_id, []


def _build_assembly(
    construction: ImportedConstruction,
    assembly_id: str,
    resolution_map: dict[str, str],
    name: str,
) -> Assembly:
    layers = [
        AssemblyLayer(
            id=_safe_id(layer.source_layer_id, ID_PREFIX_LAYER),
            order=layer_index,
            thickness_mm=layer.thickness_mm,
            segments=[
                AssemblySegment(
                    id=_safe_id(segment.source_segment_id, ID_PREFIX_SEGMENT),
                    order=segment_index,
                    width_mm=segment.width_mm,
                    is_continuous_insulation=segment.is_continuous_insulation,
                    steel_stud_spacing_mm=segment.steel_stud_spacing_mm,
                    project_material_id=resolution_map[segment.source_material_key],
                )
                for segment_index, segment in enumerate(layer.segments)
            ],
        )
        for layer_index, layer in enumerate(construction.layers)
    ]
    return Assembly(
        id=assembly_id,
        name=name,
        type=construction.type,
        orientation=construction.orientation,
        layers=layers,
    )


def _safe_id(source: str | None, prefix: str) -> str:
    """Reuse a native id (round-trip identity) only when it is well-formed."""
    if source is not None and len(source) <= 80 and re.fullmatch(rf"{prefix}_[A-Za-z0-9_-]+", source):
        return source
    return new_id(prefix)


def _positive_or_none(value: float | None) -> float | None:
    return value if value is not None and value > 0 else None


def _non_negative_or_none(value: float | None) -> float | None:
    return value if value is not None and value >= 0 else None


def _unit_interval_or_none(value: float | None) -> float | None:
    return value if value is not None and 0.0 <= value <= 1.0 else None
