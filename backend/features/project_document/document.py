"""Canonical ProjectDocumentV1 schema and table row contracts (v3).

Phase 1b: every built-in field-config lives in the persisted document
under the same per-table `field_defs` array that previously only held
custom fields. Mutable-type built-ins (Rooms: number/name/num_people/
num_bedrooms; Pumps: tag/use/manufacturer/model/volts/horse_power/
wattage/flow_gpm/runtime_khr_yr) live in the row's `custom_values` bag.
Locked-type built-ins (floor_level, building_zone, icfa_factor;
device_type, phase, link) keep their typed Pydantic columns so domain
invariants (ge=0, le=1.0, opt_*, etc.) survive.

Schema version is 3; no v2 reader is provided (pre-deploy posture).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    CustomValue,
    TableFieldDef,
    coerce_custom_value,
    normalize_display_name,
)
from features.projects.models import CertificationProgram

CatalogTableName = Literal["materials", "frame_types", "glazing_types"]
CATALOG_RECORD_ID_PATTERN = r"^rec[A-Za-z0-9]{14}$"
CATALOG_VERSION_ID_PATTERN = r"^(matv|framev|glazingv)_[A-Za-z0-9_-]+$"
AssemblyType = Literal["wall", "floor", "roof", "other"]
AssemblyOrientation = Literal["first_layer_outside", "last_layer_outside"]
SpecificationStatus = Literal["complete", "missing", "question", "na"]

ROOM_FLOOR_LEVEL_OPTION_KEY = "rooms.floor_level"
ROOM_BUILDING_ZONE_OPTION_KEY = "rooms.building_zone"
RoomOptionKey = Literal["rooms.floor_level", "rooms.building_zone"]
ROOM_OPTION_KEYS: tuple[RoomOptionKey, ...] = (
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ROOM_BUILDING_ZONE_OPTION_KEY,
)
PUMP_DEVICE_TYPE_OPTION_KEY = "pumps.device_type"
PumpOptionKey = Literal["pumps.device_type"]
PUMP_OPTION_KEYS: tuple[PumpOptionKey, ...] = (PUMP_DEVICE_TYPE_OPTION_KEY,)

# v4 wire shape: Phase 2 promotes the pinned identifier to a real
# `record_id` FieldDef on every FieldDef-capable table; Pumps' `tag`
# entry is renamed to `record_id` (display label stays "Tag"). Pre-
# deploy posture (PRD §P3.6) — no v2/v3 reader is provided; dev DBs
# rebuild on the phase boundary.
CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 4

# Field keys that have a typed Pydantic column on the row model. Used
# to split read/write paths between typed columns and the
# `custom_values` bag. Every field on the table NOT in this set lives
# in `custom_values` — that includes all custom fields and any
# mutable-type built-in (Rooms: number/name/num_people/num_bedrooms;
# Pumps: tag/use/manufacturer/etc.).
#
# Source of truth is each row model's declared attribute set below;
# these tuples enumerate the subset that the validator / formula
# accessors / catalog-refresh path needs to branch on.
ROOMS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "floor_level", "building_zone", "icfa_factor", "erv_unit_ids", "catalog_origin", "notes"}
)
PUMPS_TYPED_COLUMN_FIELD_KEYS: frozenset[str] = frozenset(
    {"id", "device_type", "phase", "link", "notes", "datasheet_asset_ids"}
)


class SingleSelectOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    label: str = Field(min_length=1, max_length=120)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    order: float

    @field_validator("label", mode="before")
    @classmethod
    def strip_label(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class RoomRow(BaseModel):
    """A row in the Rooms table (v3 mixed-storage).

    Only locked-type built-ins keep typed columns. Mutable-type built-ins
    (`number`, `name`, `num_people`, `num_bedrooms`) and all custom
    fields live in `custom_values`, keyed by `field_key`.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^rm_[A-Za-z0-9_-]+$", max_length=80)
    floor_level: str = Field(pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    building_zone: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    icfa_factor: float = Field(default=1.0, ge=0.0, le=1.0)
    erv_unit_ids: list[str] = Field(default_factory=list)
    catalog_origin: dict[str, object] | None = None
    notes: str | None = Field(default=None, max_length=4000)
    # Mutable-type built-in + custom field values, keyed by `field_key`.
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class PumpRow(BaseModel):
    """A row in the Pumps table (v3 mixed-storage).

    Locked-type built-ins keep typed columns: `device_type`, `phase`,
    `link`, `notes`, `datasheet_asset_ids`. Mutable-type built-ins
    (`tag`, `use`, `manufacturer`, `model`, `volts`, `horse_power`,
    `wattage`, `flow_gpm`, `runtime_khr_yr`) live in `custom_values`.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pmp_[A-Za-z0-9_-]+$", max_length=80)
    device_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    phase: int | None = None
    link: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    custom_values: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("notes", "link", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("phase")
    @classmethod
    def validate_phase(cls, value: int | None) -> int | None:
        if value is not None and value not in {1, 3}:
            raise ValueError("phase must be 1 or 3")
        return value

    @field_validator("link")
    @classmethod
    def validate_link(cls, value: str | None) -> str | None:
        if value is not None and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("link must start with http:// or https://")
        return value


class PumpsTableEnvelope(BaseModel):
    """`{ field_defs, rows }` envelope around the Pumps table.

    Phase 1b adds the persisted FieldDef registry on Pumps. Phase 1b is
    storage-only for Pumps — schema-mutation capability is wired in a
    follow-up phase when Pumps gets `record_id`.
    """

    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[PumpRow] = Field(default_factory=list)


class EmptyEquipmentTables(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fans: list[dict[str, object]] = Field(default_factory=list)
    pumps: PumpsTableEnvelope = Field(default_factory=PumpsTableEnvelope)
    ervs: list[dict[str, object]] = Field(default_factory=list)


class CatalogOrigin(BaseModel):
    """Bookshelf-copy provenance stamped at pick time."""

    model_config = ConfigDict(extra="forbid")

    catalog_table: CatalogTableName
    catalog_record_id: str = Field(pattern=CATALOG_RECORD_ID_PATTERN)
    catalog_version_id: str = Field(pattern=CATALOG_VERSION_ID_PATTERN)
    catalog_schema_version: int = Field(ge=1)
    synced_at: datetime
    local_overrides: list[str] = Field(default_factory=list)


def _require_catalog_origin_family(
    origin: CatalogOrigin | None,
    *,
    expected_table: CatalogTableName,
    expected_version_prefix: str,
) -> None:
    if origin is None:
        return
    if origin.catalog_table != expected_table:
        raise ValueError(f"catalog_origin.catalog_table must be {expected_table!r}, got {origin.catalog_table!r}")
    if not origin.catalog_version_id.startswith(expected_version_prefix):
        raise ValueError(f"catalog_origin.catalog_version_id must start with {expected_version_prefix!r}")


class FrameRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    width_mm: float | None = Field(default=None, ge=0)
    u_value_w_m2k: float | None = Field(default=None, ge=0)
    psi_g_w_mk: float | None = Field(default=None, ge=0)
    psi_install_w_mk: float | None = Field(default=None, ge=0)
    argb_color: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)
    source_provenance: str | None = Field(default=None, max_length=400)
    catalog_origin: CatalogOrigin | None = None

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> FrameRef:
        _require_catalog_origin_family(
            self.catalog_origin,
            expected_table="frame_types",
            expected_version_prefix="framev_",
        )
        return self


class GlazingRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    manufacturer: str | None = Field(default=None, max_length=200)
    brand: str | None = Field(default=None, max_length=200)
    u_value_w_m2k: float | None = Field(default=None, ge=0)
    g_value: float | None = Field(default=None, ge=0.0, le=1.0)
    argb_color: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)
    source_provenance: str | None = Field(default=None, max_length=400)
    catalog_origin: CatalogOrigin | None = None

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> GlazingRef:
        _require_catalog_origin_family(
            self.catalog_origin,
            expected_table="glazing_types",
            expected_version_prefix="glazingv_",
        )
        return self


class AssemblySegment(BaseModel):
    """A side-by-side material slot inside one assembly layer."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^seg_[A-Za-z0-9_-]+$", max_length=80)
    order: int = Field(ge=0)
    width_mm: float = Field(gt=0, allow_inf_nan=False)
    is_continuous_insulation: bool = False
    steel_stud_spacing_mm: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    project_material_id: str | None = Field(default=None, pattern=r"^pmat_[A-Za-z0-9_-]+$", max_length=80)
    photo_asset_ids: list[str] = Field(default_factory=list)
    use_site_notes: str | None = Field(default=None, max_length=4000)

    @field_validator("use_site_notes", mode="before")
    @classmethod
    def _strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class AssemblyLayer(BaseModel):
    """One ordered horizontal strip in an assembly cross-section."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^lyr_[A-Za-z0-9_-]+$", max_length=80)
    order: int = Field(ge=0)
    thickness_mm: float = Field(gt=0, allow_inf_nan=False)
    segments: list[AssemblySegment] = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_segments(self) -> AssemblyLayer:
        _validate_unique_ids("segment", [segment.id for segment in self.segments])
        _validate_contiguous_orders("segment", [(segment.id, segment.order) for segment in self.segments])
        return self


class Assembly(BaseModel):
    """A project-owned opaque construction assembly."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^asm_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    type: AssemblyType
    orientation: AssemblyOrientation
    layers: list[AssemblyLayer] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def _validate_layers(self) -> Assembly:
        _validate_unique_ids("layer", [layer.id for layer in self.layers])
        _validate_contiguous_orders("layer", [(layer.id, layer.order) for layer in self.layers])
        return self


class ProjectMaterial(BaseModel):
    """A project-owned material/product record referenced by segments."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pmat_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=120)
    conductivity_w_mk: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    density_kg_m3: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    specific_heat_j_kgk: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    emissivity: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    argb_color: str | None = Field(default=None, max_length=40)
    specification_status: SpecificationStatus = "missing"
    datasheet_asset_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=4000)
    catalog_origin: CatalogOrigin | None = None

    @field_validator("name", "category", mode="before")
    @classmethod
    def _strip_required_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @model_validator(mode="after")
    def _validate_catalog_origin_family(self) -> ProjectMaterial:
        _require_catalog_origin_family(
            self.catalog_origin,
            expected_table="materials",
            expected_version_prefix="matv_",
        )
        return self


class WindowElementFrames(BaseModel):
    model_config = ConfigDict(extra="forbid")

    top: FrameRef | None = None
    right: FrameRef | None = None
    bottom: FrameRef | None = None
    left: FrameRef | None = None


class WindowElement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^winel_[A-Za-z0-9_-]+$", max_length=80)
    row_span: tuple[int, int]
    column_span: tuple[int, int]
    frames: WindowElementFrames = Field(default_factory=WindowElementFrames)
    glazing: GlazingRef | None = None

    @field_validator("row_span", "column_span")
    @classmethod
    def _validate_span(cls, value: tuple[int, int]) -> tuple[int, int]:
        start, end = value
        if start < 0 or end < 0:
            raise ValueError("span indices must be >= 0")
        if start > end:
            raise ValueError("span start must be <= end")
        return value


class WindowTypeEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^win_[A-Za-z0-9_-]+$", max_length=80)
    name: str = Field(min_length=1, max_length=200)
    row_heights_mm: list[float] = Field(min_length=1)
    column_widths_mm: list[float] = Field(min_length=1)
    elements: list[WindowElement] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("row_heights_mm", "column_widths_mm")
    @classmethod
    def _positive_dimensions(cls, value: list[float]) -> list[float]:
        for dim in value:
            if dim <= 0:
                raise ValueError("grid dimensions must be > 0")
        return value

    @model_validator(mode="after")
    def _validate_element_spans(self) -> WindowTypeEntry:
        rows = len(self.row_heights_mm)
        cols = len(self.column_widths_mm)
        element_ids: set[str] = set()
        for element in self.elements:
            if element.id in element_ids:
                raise ValueError(f"Duplicate window element id: {element.id}")
            element_ids.add(element.id)
            if element.row_span[1] >= rows:
                raise ValueError(f"Window element {element.id} row_span out of bounds")
            if element.column_span[1] >= cols:
                raise ValueError(f"Window element {element.id} column_span out of bounds")
        return self


class RoomsTableEnvelope(BaseModel):
    """`{ field_defs, rows }` envelope around the Rooms table.

    Phase 1b: every field on the table — built-in or custom — lives in
    the persisted `field_defs` list. Mutable-type built-in values plus
    all custom values live in each row's `custom_values` bag.
    """

    model_config = ConfigDict(extra="forbid")

    field_defs: list[TableFieldDef] = Field(default_factory=list)
    rows: list[RoomRow] = Field(default_factory=list)


class ProjectDocumentProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    bt_number: str
    cert_programs: list[CertificationProgram] = Field(default_factory=list)
    phius_number: str | None = None
    phius_dropbox_url: str | None = None


class ProjectDocumentTables(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assemblies: list[Assembly] = Field(default_factory=list)
    project_materials: list[ProjectMaterial] = Field(default_factory=list)
    window_types: list[WindowTypeEntry] = Field(default_factory=list)
    rooms: RoomsTableEnvelope = Field(default_factory=RoomsTableEnvelope)
    thermal_bridges: list[dict[str, object]] = Field(default_factory=list)
    equipment: EmptyEquipmentTables = Field(default_factory=EmptyEquipmentTables)
    manufacturer_filters: list[dict[str, object]] = Field(default_factory=list)


class ProjectDocumentV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[4] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    project: ProjectDocumentProject
    tables: ProjectDocumentTables = Field(default_factory=ProjectDocumentTables)
    single_select_options: dict[str, list[SingleSelectOption]] = Field(
        default_factory=lambda: {
            ROOM_FLOOR_LEVEL_OPTION_KEY: [],
            ROOM_BUILDING_ZONE_OPTION_KEY: [],
            PUMP_DEVICE_TYPE_OPTION_KEY: [],
        }
    )

    @model_validator(mode="after")
    def validate_document_references(self) -> ProjectDocumentV1:
        for key in ROOM_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])
        for key in PUMP_OPTION_KEYS:
            self.single_select_options.setdefault(key, [])

        for key, options in self.single_select_options.items():
            option_ids: set[str] = set()
            labels: set[str] = set()
            for option in options:
                if option.id in option_ids:
                    raise ValueError(f"Duplicate option id in {key}: {option.id}")
                option_ids.add(option.id)
                normalized_label = normalize_display_name(option.label)
                if normalized_label in labels:
                    raise ValueError(f"Duplicate option label in {key}: {option.label}")
                labels.add(normalized_label)

        rooms_field_defs_by_key = _index_table_field_defs("rooms", self.tables.rooms.field_defs)
        _require_record_id_seeded("rooms", rooms_field_defs_by_key)
        floor_option_ids = {option.id for option in self.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]}
        zone_option_ids = {option.id for option in self.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]}
        room_ids: set[str] = set()
        for room in self.tables.rooms.rows:
            if room.id in room_ids:
                raise ValueError(f"Duplicate room id: {room.id}")
            room_ids.add(room.id)

            if room.floor_level not in floor_option_ids:
                raise ValueError(f"Missing floor-level option for room {room.id}: {room.floor_level}")
            if room.building_zone is not None and room.building_zone not in zone_option_ids:
                raise ValueError(f"Missing building-zone option for room {room.id}: {room.building_zone}")
            if room.erv_unit_ids:
                raise ValueError(f"Room ERV assignments are deferred until the ERV table is available: {room.id}")

        _validate_rows_custom_values(
            table_label="rooms",
            row_label="room",
            rows=[(room.id, room.custom_values) for room in self.tables.rooms.rows],
            field_defs_by_key=rooms_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        _validate_default_option_ids(
            table_label="rooms",
            field_defs_by_key=rooms_field_defs_by_key,
            single_select_options=self.single_select_options,
        )
        # Formula cycle detection across the Rooms table's formula
        # fields. Missing refs are *silently absorbed* (per plan-13 D2)
        # — the evaluator surfaces them per-row at read time. Cycles
        # are a hard validation failure.
        self._validate_rooms_formula_cycles(rooms_field_defs_by_key)

        pumps_field_defs_by_key = _index_table_field_defs("pumps", self.tables.equipment.pumps.field_defs)
        _require_record_id_seeded("pumps", pumps_field_defs_by_key)
        pump_device_type_ids = {option.id for option in self.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]}
        pump_ids: set[str] = set()
        for pump in self.tables.equipment.pumps.rows:
            if pump.id in pump_ids:
                raise ValueError(f"Duplicate pump id: {pump.id}")
            pump_ids.add(pump.id)
            if pump.device_type is not None and pump.device_type not in pump_device_type_ids:
                raise ValueError(f"Missing pump device-type option for pump {pump.id}: {pump.device_type}")

        _validate_rows_custom_values(
            table_label="pumps",
            row_label="pump",
            rows=[(pump.id, pump.custom_values) for pump in self.tables.equipment.pumps.rows],
            field_defs_by_key=pumps_field_defs_by_key,
            single_select_options=self.single_select_options,
        )

        window_type_ids: set[str] = set()
        window_type_names: set[str] = set()
        for window_type in self.tables.window_types:
            if window_type.id in window_type_ids:
                raise ValueError(f"Duplicate window type id: {window_type.id}")
            window_type_ids.add(window_type.id)

            normalized_name = normalize_display_name(window_type.name)
            if normalized_name in window_type_names:
                raise ValueError(f"Duplicate window type name: {window_type.name}")
            window_type_names.add(normalized_name)

        _validate_envelope_references(self.tables.project_materials, self.tables.assemblies)

        return self

    def _validate_rooms_formula_cycles(self, field_defs_by_key: dict[str, TableFieldDef]) -> None:
        # Lazy-import to keep the document module free of formula deps
        # for callers that don't touch formula fields.
        from features.project_document.formula import (
            FormulaAST,
            FormulaCycleError,
            ast_from_json,
            detect_cycles,
        )

        formula_fields = [f for f in field_defs_by_key.values() if f.field_type is CustomFieldType.formula]
        if not formula_fields:
            return

        asts_by_key: dict[str, FormulaAST] = {}
        for f in formula_fields:
            stored = f.config.get("ast")
            if stored is None:
                continue
            try:
                asts_by_key[f.field_key] = ast_from_json(stored)
            except (ValueError, TypeError):
                continue

        for f in formula_fields:
            stored = asts_by_key.get(f.field_key)
            if stored is None:
                continue
            others = {k: v for k, v in asts_by_key.items() if k != f.field_key}
            try:
                detect_cycles(f.field_key, stored, others)
            except FormulaCycleError as exc:
                raise ValueError(f"Rooms formula cycle for {f.display_name!r}: {' -> '.join(exc.cycle_path)}") from exc


def _require_record_id_seeded(
    table_label: str,
    field_defs_by_key: dict[str, TableFieldDef],
) -> None:
    """Enforce PRD §P4.3 identifier invariant: every FieldDef-capable
    table carries a `record_id` entry. Uniqueness is already enforced
    upstream by `_index_table_field_defs`, so a membership check is
    sufficient.
    """
    if RESERVED_FIELD_KEY_RECORD_ID not in field_defs_by_key:
        raise ValueError(f"{table_label}.field_defs must contain a record_id entry")


def _validate_unique_ids(label: str, ids: list[str]) -> None:
    seen: set[str] = set()
    for item_id in ids:
        if item_id in seen:
            raise ValueError(f"Duplicate {label} id: {item_id}")
        seen.add(item_id)


def _validate_contiguous_orders(label: str, ordered_ids: list[tuple[str, int]]) -> None:
    expected = list(range(len(ordered_ids)))
    actual = sorted(order for _item_id, order in ordered_ids)
    if actual != expected:
        raise ValueError(f"{label} orders must be contiguous from 0")


def _validate_envelope_references(project_materials: list[ProjectMaterial], assemblies: list[Assembly]) -> None:
    project_material_ids = {material.id for material in project_materials}
    if len(project_material_ids) != len(project_materials):
        raise ValueError("Duplicate project material id")

    assembly_ids: set[str] = set()
    assembly_names: set[str] = set()
    for assembly in assemblies:
        if assembly.id in assembly_ids:
            raise ValueError(f"Duplicate assembly id: {assembly.id}")
        assembly_ids.add(assembly.id)

        normalized_name = normalize_display_name(assembly.name)
        if normalized_name in assembly_names:
            raise ValueError(f"Duplicate assembly name: {assembly.name}")
        assembly_names.add(normalized_name)

        for layer in assembly.layers:
            for segment in layer.segments:
                if (
                    segment.project_material_id is not None
                    and segment.project_material_id not in project_material_ids
                ):
                    raise ValueError(
                        "Unknown project_material_id "
                        f"{segment.project_material_id!r} on segment {segment.id}"
                    )


def _index_table_field_defs(
    table_label: str,
    field_defs: list[TableFieldDef],
) -> dict[str, TableFieldDef]:
    """Build a `field_key → FieldDef` map while enforcing uniqueness of
    both `field_key` (identity) and `display_name` (case-insensitive,
    trimmed)."""
    by_key: dict[str, TableFieldDef] = {}
    name_seen: dict[str, str] = {}
    for field_def in field_defs:
        if field_def.field_key in by_key:
            raise ValueError(f"Duplicate field_key in {table_label}.field_defs: {field_def.field_key}")
        by_key[field_def.field_key] = field_def
        normalized_name = normalize_display_name(field_def.display_name)
        if normalized_name in name_seen:
            existing = name_seen[normalized_name]
            raise ValueError(
                f"Duplicate field name in {table_label}: {field_def.display_name!r} collides with {existing!r}"
            )
        name_seen[normalized_name] = field_def.display_name
    return by_key


def _validate_rows_custom_values(
    *,
    table_label: str,
    row_label: str,
    rows: list[tuple[str, dict[str, CustomValue]]],
    field_defs_by_key: dict[str, TableFieldDef],
    single_select_options: dict[str, list[SingleSelectOption]],
) -> None:
    """Coerce every `(row_id, custom_values)` pair against its
    FieldDef's declared type. Single-select option lists are resolved
    once per field_key, not per row."""
    option_list_by_field_key: dict[str, list[SingleSelectOption]] = {}
    for field_key, field_def in field_defs_by_key.items():
        if field_def.field_type is CustomFieldType.single_select:
            option_list_by_field_key[field_key] = single_select_options.get(
                f"{table_label}.{field_key}", []
            )

    for row_id, custom_values in rows:
        for field_key, value in custom_values.items():
            field_def = field_defs_by_key.get(field_key)
            if field_def is None:
                raise ValueError(f"Unknown field_key on {row_label} {row_id}: {field_key}")
            try:
                coerce_custom_value(
                    value,
                    field_def.field_type,
                    option_list=option_list_by_field_key.get(field_key),
                )
            except ValueError as exc:
                raise ValueError(
                    f"Invalid value for {field_def.display_name!r} on {row_label} {row_id}: {exc}"
                ) from exc


def _validate_default_option_ids(
    *,
    table_label: str,
    field_defs_by_key: dict[str, TableFieldDef],
    single_select_options: dict[str, list[SingleSelectOption]],
) -> None:
    """`config.default_option_id`, when set, must reference an option in
    the field's namespaced list. Only valid on single_select fields."""
    for field_def in field_defs_by_key.values():
        default_raw = field_def.config.get("default_option_id")
        if default_raw is None:
            continue
        if field_def.field_type is not CustomFieldType.single_select:
            raise ValueError(
                f"default_option_id is only valid for single_select fields "
                f"(field {field_def.field_key!r}, type {field_def.field_type.value!r})"
            )
        if not isinstance(default_raw, str):
            raise ValueError(f"default_option_id for {field_def.field_key!r} must be a string option id")
        namespace_key = f"{table_label}.{field_def.field_key}"
        default_option_ids = {option.id for option in single_select_options.get(namespace_key, [])}
        if default_raw not in default_option_ids:
            raise ValueError(
                f"default_option_id {default_raw!r} for {field_def.field_key!r} "
                "does not reference an option in the field's option list"
            )
