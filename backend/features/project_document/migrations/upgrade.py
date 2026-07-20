"""Forward-only dict-to-dict upgrades for project document bodies."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import cast

from features.project_document.custom_fields import TableFieldDef
from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION, ProjectDocumentV1
from features.project_document.tables._status_field import STATUS_FIELD_KEY


class ProjectDocumentMigrationError(ValueError):
    """Base error for bodies that cannot enter the project-document upgrade lane."""


class SchemaVersionMissingError(ProjectDocumentMigrationError):
    """Raised when a raw body does not declare an integer ``schema_version``."""


class SchemaVersionInvalidError(ProjectDocumentMigrationError):
    """Raised when ``schema_version`` is present but not a supported integer."""


class SchemaVersionTooNewError(ProjectDocumentMigrationError):
    """Raised when a body was written by a newer app schema."""


@dataclass(frozen=True)
class UpgradeResult:
    """Validated current-shape document plus audit data for the steps applied."""

    original_schema_version: int
    target_schema_version: int
    applied_steps: tuple[str, ...]
    warnings: tuple[str, ...]
    upgraded_raw_body: dict[str, object]
    document: ProjectDocumentV1

    @property
    def requires_persisted_rewrite(self) -> bool:
        """Only older bodies should be rewritten; current v1 defaults stay untouched."""

        return self.original_schema_version != self.target_schema_version


def _upgrade_v0_to_v1(raw: dict[str, object]) -> dict[str, object]:
    """Testable pre-beta baseline: v0 has the v1 shape but lacks the v1 stamp."""

    upgraded = dict(raw)
    upgraded["schema_version"] = 1
    return upgraded


def _upgrade_v1_to_v2(raw: dict[str, object]) -> dict[str, object]:
    """Add Rooms supply/extract airflow built-ins without changing row values."""

    from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS

    upgraded = dict(raw)
    tables = dict(_mapping(upgraded.get("tables"), "tables"))
    rooms = dict(_mapping(tables.get("rooms"), "tables.rooms"))
    field_defs = list(_list(rooms.get("field_defs"), "tables.rooms.field_defs"))

    current_rooms_built_ins = {
        field.field_key: field.model_dump(mode="json")
        for field in ROOMS_BUILT_IN_FIELD_DEFS
        if field.origin == "built_in"
    }
    current_builtin_keys = [field.field_key for field in ROOMS_BUILT_IN_FIELD_DEFS if field.origin == "built_in"]
    persisted_by_key: dict[str, object] = {}
    for field in field_defs:
        if not isinstance(field, Mapping):
            continue
        field_mapping = cast(Mapping[str, object], field)
        field_key = field_mapping.get("field_key")
        if isinstance(field_key, str):
            persisted_by_key[field_key] = field

    next_field_defs: list[object] = [
        persisted_by_key.get(field_key, current_rooms_built_ins[field_key]) for field_key in current_builtin_keys
    ]
    current_builtin_key_set = set(current_builtin_keys)
    for field in field_defs:
        if isinstance(field, Mapping):
            field_mapping = cast(Mapping[str, object], field)
            if field_mapping.get("field_key") in current_builtin_key_set:
                continue
        next_field_defs.append(field)

    rooms["field_defs"] = next_field_defs
    tables["rooms"] = rooms
    upgraded["tables"] = tables
    upgraded["schema_version"] = 2
    return upgraded


def _upgrade_v2_to_v3(raw: dict[str, object]) -> dict[str, object]:
    """Add downstream-consumer built-ins and new equipment option namespaces."""

    from features.project_document.document import (
        PUMP_INSIDE_OUTSIDE_OPTION_KEY,
        VENTILATOR_FROST_PROTECTION_OPTION_KEY,
    )
    from features.project_document.tables.hot_water_tanks import HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.pumps import PUMP_INSIDE_OUTSIDE_OPTIONS, PUMPS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.thermal_bridges import THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.ventilators import (
        VENTILATOR_FROST_PROTECTION_OPTIONS,
        VENTILATORS_BUILT_IN_FIELD_DEFS,
    )

    upgraded = dict(raw)
    tables = dict(_mapping(upgraded.get("tables"), "tables"))
    equipment = dict(_mapping(tables.get("equipment"), "tables.equipment"))

    rooms = dict(_mapping(tables.get("rooms"), "tables.rooms"))
    rooms["field_defs"] = _merge_current_built_ins(
        rooms.get("field_defs"),
        current_built_ins=ROOMS_BUILT_IN_FIELD_DEFS,
        path="tables.rooms.field_defs",
    )
    tables["rooms"] = rooms

    thermal_bridges = dict(_mapping(tables.get("thermal_bridges"), "tables.thermal_bridges"))
    thermal_bridges["field_defs"] = _merge_current_built_ins(
        thermal_bridges.get("field_defs"),
        current_built_ins=THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS,
        path="tables.thermal_bridges.field_defs",
    )
    tables["thermal_bridges"] = thermal_bridges

    pumps = dict(_mapping(equipment.get("pumps"), "tables.equipment.pumps"))
    pumps["field_defs"] = _merge_current_built_ins(
        pumps.get("field_defs"),
        current_built_ins=PUMPS_BUILT_IN_FIELD_DEFS,
        path="tables.equipment.pumps.field_defs",
    )
    equipment["pumps"] = pumps

    ventilators = dict(_mapping(equipment.get("ervs"), "tables.equipment.ervs"))
    ventilators["field_defs"] = _merge_current_built_ins(
        ventilators.get("field_defs"),
        current_built_ins=VENTILATORS_BUILT_IN_FIELD_DEFS,
        path="tables.equipment.ervs.field_defs",
    )
    equipment["ervs"] = ventilators

    hot_water_tanks = dict(_mapping(equipment.get("hot_water_tanks"), "tables.equipment.hot_water_tanks"))
    hot_water_tanks["field_defs"] = _merge_current_built_ins(
        hot_water_tanks.get("field_defs"),
        current_built_ins=HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS,
        path="tables.equipment.hot_water_tanks.field_defs",
    )
    equipment["hot_water_tanks"] = hot_water_tanks

    options = dict(_mapping(upgraded.get("single_select_options"), "single_select_options"))
    options.setdefault(
        PUMP_INSIDE_OUTSIDE_OPTION_KEY,
        [option.model_dump(mode="json") for option in PUMP_INSIDE_OUTSIDE_OPTIONS],
    )
    options.setdefault(
        VENTILATOR_FROST_PROTECTION_OPTION_KEY,
        [option.model_dump(mode="json") for option in VENTILATOR_FROST_PROTECTION_OPTIONS],
    )

    tables["equipment"] = equipment
    upgraded["tables"] = tables
    upgraded["single_select_options"] = options
    upgraded["schema_version"] = 3
    return upgraded


def _upgrade_v3_to_v4(raw: dict[str, object]) -> dict[str, object]:
    """Add the built-in Room-to-Ventilator linked-record field."""

    from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS

    upgraded = dict(raw)
    tables = dict(_mapping(upgraded.get("tables"), "tables"))
    rooms = dict(_mapping(tables.get("rooms"), "tables.rooms"))
    rooms["field_defs"] = _merge_current_built_ins(
        rooms.get("field_defs"),
        current_built_ins=ROOMS_BUILT_IN_FIELD_DEFS,
        path="tables.rooms.field_defs",
    )
    tables["rooms"] = rooms
    upgraded["tables"] = tables
    upgraded["schema_version"] = 4
    return upgraded


def _upgrade_v4_to_v5(raw: dict[str, object]) -> dict[str, object]:
    """Add the Heat Pump `name` ("Display Name") built-in and backfill it from `tag`.

    The four HP leaves were the only equipment tables without a Display
    Name field. Backfilling from the typed `tag` keeps every existing row
    rendering a non-blank identity (heat-pump-display-name PRD criterion 3).
    """

    from features.project_document.tables.heat_pumps import (
        INDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        INDOOR_UNITS_BUILT_IN_FIELD_DEFS,
        OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS,
    )

    leaf_built_ins: dict[str, Sequence[TableFieldDef]] = {
        "outdoor_equip": OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        "indoor_equip": INDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        "outdoor_units": OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS,
        "indoor_units": INDOOR_UNITS_BUILT_IN_FIELD_DEFS,
    }

    upgraded = dict(raw)
    tables = dict(_mapping(upgraded.get("tables"), "tables"))
    equipment = dict(_mapping(tables.get("equipment"), "tables.equipment"))
    heat_pumps = dict(_mapping(equipment.get("heat_pumps"), "tables.equipment.heat_pumps"))

    for leaf_name, built_ins in leaf_built_ins.items():
        path = f"tables.equipment.heat_pumps.{leaf_name}"
        leaf = dict(_mapping(heat_pumps.get(leaf_name), path))
        leaf["field_defs"] = _merge_current_built_ins(
            leaf.get("field_defs"),
            current_built_ins=built_ins,
            path=f"{path}.field_defs",
        )
        leaf["rows"] = [_backfill_name_from_tag(row) for row in _list(leaf.get("rows"), f"{path}.rows")]
        heat_pumps[leaf_name] = leaf

    equipment["heat_pumps"] = heat_pumps
    tables["equipment"] = equipment
    upgraded["tables"] = tables
    upgraded["schema_version"] = 5
    return upgraded


def _backfill_name_from_tag(row: object) -> object:
    """Copy `tag` into `custom_values["name"]` when no display name is set."""

    if not isinstance(row, Mapping):
        return row
    row_mapping = cast(Mapping[str, object], row)
    custom_values = row_mapping.get("custom_values")
    custom_mapping: dict[str, object] = (
        dict(cast(Mapping[str, object], custom_values)) if isinstance(custom_values, Mapping) else {}
    )
    existing = custom_mapping.get("name")
    if isinstance(existing, str) and existing.strip():
        return row
    tag = row_mapping.get("tag")
    if not isinstance(tag, str) or not tag.strip():
        return row
    custom_mapping["name"] = tag
    next_row = dict(row_mapping)
    next_row["custom_values"] = custom_mapping
    return next_row


def _upgrade_v5_to_v6(raw: dict[str, object]) -> dict[str, object]:
    """Add Documentation evidence fields and rename `status` to Specification Status."""

    from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.electric_heaters import ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.fans import FANS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.heat_pumps import (
        INDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        INDOOR_UNITS_BUILT_IN_FIELD_DEFS,
        OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS,
    )
    from features.project_document.tables.hot_water_heaters import HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.hot_water_tanks import HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.thermal_bridges import THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS
    from features.project_document.tables.ventilators import VENTILATORS_BUILT_IN_FIELD_DEFS

    status_refresh_keys = frozenset({STATUS_FIELD_KEY})
    upgraded = dict(raw)
    tables = dict(_mapping(upgraded.get("tables"), "tables"))
    equipment = dict(_mapping(tables.get("equipment"), "tables.equipment"))

    table_specs: dict[str, Sequence[TableFieldDef]] = {
        "appliances": APPLIANCES_BUILT_IN_FIELD_DEFS,
        "electric_heaters": ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS,
        "fans": FANS_BUILT_IN_FIELD_DEFS,
        "hot_water_heaters": HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS,
        "hot_water_tanks": HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS,
        "pumps": PUMPS_BUILT_IN_FIELD_DEFS,
        "ervs": VENTILATORS_BUILT_IN_FIELD_DEFS,
    }
    for table_name, built_ins in table_specs.items():
        path = f"tables.equipment.{table_name}"
        table = dict(_mapping(equipment.get(table_name), path))
        table["field_defs"] = _merge_current_built_ins(
            table.get("field_defs"),
            current_built_ins=built_ins,
            path=f"{path}.field_defs",
            refresh_field_keys=status_refresh_keys,
        )
        equipment[table_name] = table

    heat_pumps = dict(_mapping(equipment.get("heat_pumps"), "tables.equipment.heat_pumps"))
    hp_specs: dict[str, Sequence[TableFieldDef]] = {
        "outdoor_equip": OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        "indoor_equip": INDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
        "outdoor_units": OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS,
        "indoor_units": INDOOR_UNITS_BUILT_IN_FIELD_DEFS,
    }
    for leaf_name, built_ins in hp_specs.items():
        path = f"tables.equipment.heat_pumps.{leaf_name}"
        leaf = dict(_mapping(heat_pumps.get(leaf_name), path))
        leaf["field_defs"] = _merge_current_built_ins(
            leaf.get("field_defs"),
            current_built_ins=built_ins,
            path=f"{path}.field_defs",
            refresh_field_keys=status_refresh_keys,
        )
        heat_pumps[leaf_name] = leaf

    equipment["heat_pumps"] = heat_pumps
    tables["equipment"] = equipment

    thermal_bridges = dict(_mapping(tables.get("thermal_bridges"), "tables.thermal_bridges"))
    thermal_bridges["field_defs"] = _merge_current_built_ins(
        thermal_bridges.get("field_defs"),
        current_built_ins=THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS,
        path="tables.thermal_bridges.field_defs",
        refresh_field_keys=status_refresh_keys,
    )
    tables["thermal_bridges"] = thermal_bridges

    upgraded["tables"] = tables
    upgraded["schema_version"] = 6
    return upgraded


def _upgrade_v6_to_v7(raw: dict[str, object]) -> dict[str, object]:
    """Backfill persisted Documentation Datasheet/Photo evidence statuses."""

    upgraded = dict(raw)
    tables = dict(_mapping(upgraded.get("tables"), "tables"))
    equipment = dict(_mapping(tables.get("equipment"), "tables.equipment"))

    for table_name in (
        "appliances",
        "electric_heaters",
        "fans",
        "hot_water_heaters",
        "hot_water_tanks",
        "pumps",
        "ervs",
    ):
        equipment[table_name] = _backfill_evidence_statuses_in_envelope(
            equipment.get(table_name),
            path=f"tables.equipment.{table_name}",
        )

    heat_pumps = dict(_mapping(equipment.get("heat_pumps"), "tables.equipment.heat_pumps"))
    for leaf_name in ("outdoor_equip", "indoor_equip", "outdoor_units", "indoor_units"):
        heat_pumps[leaf_name] = _backfill_evidence_statuses_in_envelope(
            heat_pumps.get(leaf_name),
            path=f"tables.equipment.heat_pumps.{leaf_name}",
        )
    equipment["heat_pumps"] = heat_pumps
    tables["equipment"] = equipment

    tables["thermal_bridges"] = _backfill_evidence_statuses_in_envelope(
        tables.get("thermal_bridges"),
        path="tables.thermal_bridges",
    )
    tables["project_glazings"] = _backfill_evidence_statuses_in_rows(
        tables.get("project_glazings"),
        path="tables.project_glazings",
    )
    tables["project_frames"] = _backfill_evidence_statuses_in_rows(
        tables.get("project_frames"),
        path="tables.project_frames",
    )
    tables["project_materials"] = _backfill_evidence_statuses_in_rows(
        tables.get("project_materials"),
        path="tables.project_materials",
        include_photo=False,
    )
    tables["assemblies"] = _backfill_assembly_segment_photo_statuses(tables.get("assemblies"))

    upgraded["tables"] = tables
    upgraded["schema_version"] = 7
    return upgraded


#: The only document paths whose rows carry a typed built-in specification
#: status. Equipment and Thermal Bridges keep their DataTable option ids
#: (``opt_status_needed``) and are deliberately not traversed here.
SPECIFICATION_STATUS_TABLE_PATHS: tuple[str, ...] = (
    "project_materials",
    "project_glazings",
    "project_frames",
)


def _upgrade_v7_to_v8(raw: dict[str, object]) -> dict[str, object]:
    """Rename the built-in specification status ``missing`` to ``needed``.

    Exact value replacement on three row lists: no other value, row, or path is
    touched, so a body already carrying ``needed`` upgrades byte-identically.
    """

    upgraded = dict(raw)
    tables = dict(_mapping(upgraded.get("tables"), "tables"))
    for table_name in SPECIFICATION_STATUS_TABLE_PATHS:
        path = f"tables.{table_name}"
        tables[table_name] = [_rename_missing_specification_status(row) for row in _list(tables.get(table_name), path)]
    upgraded["tables"] = tables
    upgraded["schema_version"] = 8
    return upgraded


def _rename_missing_specification_status(row: object) -> object:
    if not isinstance(row, Mapping):
        return row
    row_mapping = cast(Mapping[str, object], row)
    if row_mapping.get("specification_status") != "missing":
        return row
    return {**row_mapping, "specification_status": "needed"}


UPGRADE_STEPS: dict[int, Callable[[dict[str, object]], dict[str, object]]] = {
    0: _upgrade_v0_to_v1,
    1: _upgrade_v1_to_v2,
    2: _upgrade_v2_to_v3,
    3: _upgrade_v3_to_v4,
    4: _upgrade_v4_to_v5,
    5: _upgrade_v5_to_v6,
    6: _upgrade_v6_to_v7,
    7: _upgrade_v7_to_v8,
}


def upgrade_project_document(raw: object) -> UpgradeResult:
    """Upgrade a raw document mapping forward and validate it as the current model."""

    if not isinstance(raw, Mapping):
        raise SchemaVersionInvalidError("project document body must be a JSON object")

    raw_mapping: dict[str, object] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            raise SchemaVersionInvalidError("project document body keys must be strings")
        raw_mapping[key] = value

    original_version = _schema_version(raw_mapping)
    target_version = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    if original_version > target_version:
        raise SchemaVersionTooNewError(
            f"project document schema_version={original_version} is newer than this app "
            f"(CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION={target_version})"
        )

    upgraded: dict[str, object] = dict(raw_mapping)
    applied: list[str] = []
    version = original_version
    while version < target_version:
        step = UPGRADE_STEPS.get(version)
        if step is None:
            raise SchemaVersionInvalidError(
                f"missing project document upgrade step for schema version {version}; "
                "UPGRADE_STEPS must cover every version below current"
            )
        upgraded = step(upgraded)
        applied.append(getattr(step, "__name__", f"upgrade_v{version}_to_v{version + 1}"))
        version += 1

    document = ProjectDocumentV1.model_validate(upgraded)
    return UpgradeResult(
        original_schema_version=original_version,
        target_schema_version=target_version,
        applied_steps=tuple(applied),
        warnings=(),
        upgraded_raw_body=upgraded,
        document=document,
    )


def _schema_version(raw: Mapping[str, object]) -> int:
    value = raw.get("schema_version")
    if value is None:
        raise SchemaVersionMissingError("project document schema_version is required")
    if isinstance(value, bool) or not isinstance(value, int):
        raise SchemaVersionInvalidError("project document schema_version must be an integer")
    if value < 0:
        raise SchemaVersionInvalidError("project document schema_version must be >= 0")
    return value


def _mapping(value: object, path: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise SchemaVersionInvalidError(f"project document {path} must be an object")
    return cast(Mapping[str, object], value)


def _list(value: object, path: str) -> list[object]:
    if not isinstance(value, list):
        raise SchemaVersionInvalidError(f"project document {path} must be a list")
    return cast(list[object], value)


def _merge_current_built_ins(
    value: object,
    *,
    current_built_ins: Sequence[TableFieldDef],
    path: str,
    refresh_field_keys: frozenset[str] = frozenset(),
) -> list[object]:
    field_defs = list(_list(value, path))
    current_by_key = {
        field.field_key: field.model_dump(mode="json") for field in current_built_ins if field.origin == "built_in"
    }
    current_keys = [field.field_key for field in current_built_ins if field.origin == "built_in"]
    current_key_set = set(current_keys)

    persisted_by_key: dict[str, object] = {}
    for field in field_defs:
        if not isinstance(field, Mapping):
            continue
        field_mapping = cast(Mapping[str, object], field)
        field_key = field_mapping.get("field_key")
        if isinstance(field_key, str):
            persisted_by_key[field_key] = field

    next_field_defs: list[object] = [
        current_by_key[field_key]
        if field_key in refresh_field_keys
        else persisted_by_key.get(field_key, current_by_key[field_key])
        for field_key in current_keys
    ]
    for field in field_defs:
        if isinstance(field, Mapping) and cast(Mapping[str, object], field).get("field_key") in current_key_set:
            continue
        next_field_defs.append(field)
    return next_field_defs


def _backfill_evidence_statuses_in_envelope(value: object, *, path: str) -> dict[str, object]:
    envelope = dict(_mapping(value, path))
    envelope["rows"] = _backfill_evidence_statuses_in_rows(envelope.get("rows"), path=f"{path}.rows")
    return envelope


def _backfill_evidence_statuses_in_rows(value: object, *, path: str, include_photo: bool = True) -> list[object]:
    return [_backfill_evidence_statuses_in_row(row, include_photo=include_photo) for row in _list(value, path)]


def _backfill_evidence_statuses_in_row(row: object, *, include_photo: bool = True) -> object:
    if not isinstance(row, Mapping):
        return row
    row_mapping = dict(cast(Mapping[str, object], row))
    row_mapping["datasheet_status"] = _backfilled_axis_status(
        row_mapping,
        asset_key="datasheet_asset_ids",
        waiver_key="datasheet_not_required",
    )
    if include_photo:
        row_mapping["photo_status"] = _backfilled_axis_status(
            row_mapping,
            asset_key="photo_asset_ids",
            waiver_key="photo_not_required",
        )
    return row_mapping


def _backfilled_axis_status(row: Mapping[str, object], *, asset_key: str, waiver_key: str) -> str:
    if row.get(waiver_key) is True:
        return "na"
    asset_ids = row.get(asset_key)
    if isinstance(asset_ids, list) and any(isinstance(asset_id, str) and asset_id for asset_id in asset_ids):
        return "complete"
    return "needed"


def _backfill_assembly_segment_photo_statuses(value: object) -> list[object]:
    assemblies: list[object] = []
    for assembly in _list(value, "tables.assemblies"):
        if not isinstance(assembly, Mapping):
            assemblies.append(assembly)
            continue
        assembly_mapping = dict(cast(Mapping[str, object], assembly))
        layers: list[object] = []
        for layer in _list(assembly_mapping.get("layers"), "tables.assemblies.layers"):
            if not isinstance(layer, Mapping):
                layers.append(layer)
                continue
            layer_mapping = dict(cast(Mapping[str, object], layer))
            layer_mapping["segments"] = _backfill_photo_statuses_in_segments(layer_mapping.get("segments"))
            layers.append(layer_mapping)
        assembly_mapping["layers"] = layers
        assemblies.append(assembly_mapping)
    return assemblies


def _backfill_photo_statuses_in_segments(value: object) -> list[object]:
    segments: list[object] = []
    for segment in _list(value, "tables.assemblies.layers.segments"):
        if not isinstance(segment, Mapping):
            segments.append(segment)
            continue
        segment_mapping = dict(cast(Mapping[str, object], segment))
        segment_mapping["photo_status"] = _backfilled_axis_status(
            segment_mapping,
            asset_key="photo_asset_ids",
            waiver_key="photo_not_required",
        )
        segments.append(segment_mapping)
    return segments
