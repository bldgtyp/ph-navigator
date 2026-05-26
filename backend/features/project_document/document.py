"""Canonical ProjectDocumentV1 schema and table row contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from features.project_document.custom_fields import (
    CustomFieldDef,
    CustomValue,
    coerce_custom_value,
    normalize_display_name,
)
from features.projects.models import CertificationProgram

CatalogTableName = Literal["materials", "frame_types", "glazing_types"]
CATALOG_RECORD_ID_PATTERN = r"^rec[A-Za-z0-9]{14}$"
CATALOG_VERSION_ID_PATTERN = r"^(matv|framev|glazingv)_[A-Za-z0-9_-]+$"

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
CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 2

# Core field display names for Rooms — used by
# `validate_document_references` to enforce duplicate-name uniqueness
# across core + custom fields (case-insensitive, trimmed). Canonical
# source is the frontend `roomsTableFieldDefs` registry; kept here too
# because the validator must enforce the same rule server-side.
ROOMS_CORE_DISPLAY_NAMES: tuple[str, ...] = (
    "Number",
    "Name",
    "Floor",
    "Zone",
    "People",
    "Bedrooms",
    "iCFA",
    "ERVs",
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
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^rm_[A-Za-z0-9_-]+$", max_length=80)
    number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    floor_level: str = Field(pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    building_zone: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    num_people: int = Field(default=0, ge=0)
    num_bedrooms: int = Field(default=0, ge=0)
    icfa_factor: float = Field(default=1.0, ge=0.0, le=1.0)
    erv_unit_ids: list[str] = Field(default_factory=list)
    catalog_origin: dict[str, object] | None = None
    notes: str | None = Field(default=None, max_length=4000)
    custom: dict[str, CustomValue] = Field(default_factory=dict)

    @field_validator("number", "name", mode="before")
    @classmethod
    def strip_required_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("notes", mode="before")
    @classmethod
    def strip_optional_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class PumpRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^pmp_[A-Za-z0-9_-]+$", max_length=80)
    device_type: str | None = Field(default=None, pattern=r"^opt_[A-Za-z0-9_-]+$", max_length=80)
    use: str | None = Field(default=None, max_length=200)
    tag: str | None = Field(default=None, max_length=80)
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    volts: float | None = Field(default=None, ge=0)
    phase: int | None = None
    horse_power: float | None = Field(default=None, ge=0)
    wattage: float | None = Field(default=None, ge=0)
    flow_gpm: float | None = Field(default=None, ge=0)
    runtime_khr_yr: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=4000)
    link: str | None = Field(default=None, max_length=2000)
    datasheet_asset_ids: list[str] = Field(default_factory=list)

    @field_validator("use", "tag", "manufacturer", "model", "notes", "link", mode="before")
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


class EmptyEquipmentTables(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fans: list[dict[str, object]] = Field(default_factory=list)
    pumps: list[PumpRow] = Field(default_factory=list)
    ervs: list[dict[str, object]] = Field(default_factory=list)


class CatalogOrigin(BaseModel):
    """Bookshelf-copy provenance stamped at pick time.

    Values are inlined into the document; this block records where they came
    from so refresh-from-catalog (US-WIN-11) can re-find the source row across
    catalog versions. No live FK / join is enforced — `catalog_record_id` and
    `catalog_version_id` are validated only as data shape.
    """

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
    """Bookshelf-copy invariant: a ref's `catalog_origin` must point at the
    right catalog family. Frame slots come from the Window-Frame catalog and
    glazing slots from the Window-Glazing catalog; a glazing ref pointing at
    `materials` or carrying a `matv_`/`framev_` version id is nonsense data,
    not a future hand-enter case. `catalog_origin = None` (hand-entered) stays
    allowed."""
    if origin is None:
        return
    if origin.catalog_table != expected_table:
        raise ValueError(f"catalog_origin.catalog_table must be {expected_table!r}, got {origin.catalog_table!r}")
    if not origin.catalog_version_id.startswith(expected_version_prefix):
        raise ValueError(f"catalog_origin.catalog_version_id must start with {expected_version_prefix!r}")


class FrameRef(BaseModel):
    """Bookshelf-copied frame values inlined into a window element side.

    Mirrors the Window-Frame catalog's typed value columns plus an optional
    `catalog_origin` block. When `catalog_origin` is null the values were
    hand-entered, not picked from a catalog.
    """

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
    """Bookshelf-copied glazing values inlined into a window element's center."""

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


class WindowElementFrames(BaseModel):
    """Four-sided frame slots on a window element. Each side is nullable."""

    model_config = ConfigDict(extra="forbid")

    top: FrameRef | None = None
    right: FrameRef | None = None
    bottom: FrameRef | None = None
    left: FrameRef | None = None


class WindowElement(BaseModel):
    """One element on a window-type grid (US-WIN-2 / US-WIN-3)."""

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
    """One window type in `tables.window_types[]` (US-WIN-1 §8)."""

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
    """`{ custom_fields, rows }` envelope around the Rooms table.

    Core fields stay strongly typed in `RoomRow`; `custom_fields`
    declares user-defined extensions; each row's `custom` dict carries
    the sparse values keyed by stable `cf_*` ids. Editor-defined fields
    ride the same version / draft / save / lock lifecycle as the rows.
    """

    model_config = ConfigDict(extra="forbid")

    custom_fields: list[CustomFieldDef] = Field(default_factory=list)
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

    assemblies: list[dict[str, object]] = Field(default_factory=list)
    project_materials: list[dict[str, object]] = Field(default_factory=list)
    window_types: list[WindowTypeEntry] = Field(default_factory=list)
    rooms: RoomsTableEnvelope = Field(default_factory=RoomsTableEnvelope)
    thermal_bridges: list[dict[str, object]] = Field(default_factory=list)
    equipment: EmptyEquipmentTables = Field(default_factory=EmptyEquipmentTables)
    manufacturer_filters: list[dict[str, object]] = Field(default_factory=list)


class ProjectDocumentV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[2] = CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
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

        rooms_table = self.tables.rooms
        custom_field_ids: dict[str, CustomFieldDef] = {}
        name_seen: dict[str, str] = {
            normalize_display_name(display_name): display_name for display_name in ROOMS_CORE_DISPLAY_NAMES
        }
        for custom_field in rooms_table.custom_fields:
            if custom_field.id in custom_field_ids:
                raise ValueError(f"Duplicate custom field id in rooms: {custom_field.id}")
            custom_field_ids[custom_field.id] = custom_field
            normalized_name = normalize_display_name(custom_field.display_name)
            if normalized_name in name_seen:
                existing = name_seen[normalized_name]
                raise ValueError(
                    f"Duplicate field name in rooms: {custom_field.display_name!r} collides with {existing!r}"
                )
            name_seen[normalized_name] = custom_field.display_name

        room_ids: set[str] = set()
        room_numbers: set[str] = set()
        floor_option_ids = {option.id for option in self.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]}
        zone_option_ids = {option.id for option in self.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]}
        for room in rooms_table.rows:
            if room.id in room_ids:
                raise ValueError(f"Duplicate room id: {room.id}")
            room_ids.add(room.id)

            normalized_number = normalize_display_name(room.number)
            if normalized_number in room_numbers:
                raise ValueError(f"Duplicate room number: {room.number}")
            room_numbers.add(normalized_number)

            if room.floor_level not in floor_option_ids:
                raise ValueError(f"Missing floor-level option for room {room.id}: {room.floor_level}")
            if room.building_zone is not None and room.building_zone not in zone_option_ids:
                raise ValueError(f"Missing building-zone option for room {room.id}: {room.building_zone}")
            if room.erv_unit_ids:
                raise ValueError(f"Room ERV assignments are deferred until the ERV table is available: {room.id}")

            for cf_id, value in room.custom.items():
                custom_field = custom_field_ids.get(cf_id)
                if custom_field is None:
                    raise ValueError(f"Unknown custom field id on room {room.id}: {cf_id}")
                option_list = None
                if custom_field.field_type.value == "single_select":
                    option_list = self.single_select_options.get(f"rooms.{cf_id}", [])
                try:
                    coerce_custom_value(value, custom_field.field_type, option_list=option_list)
                except ValueError as exc:
                    raise ValueError(
                        f"Invalid custom value for {custom_field.display_name!r} on room {room.id}: {exc}"
                    ) from exc

        # default_option_id (plan-21 P5a.0) integrity check: every
        # single_select custom field's `config.default_option_id`,
        # if set, must reference an option in its namespaced list.
        # Non-single_select fields may not carry default_option_id.
        for custom_field in custom_field_ids.values():
            default_raw = custom_field.config.get("default_option_id")
            if default_raw is None:
                continue
            if custom_field.field_type.value != "single_select":
                raise ValueError(
                    f"default_option_id is only valid for single_select fields "
                    f"(field {custom_field.id!r}, type {custom_field.field_type.value!r})"
                )
            if not isinstance(default_raw, str):
                raise ValueError(f"default_option_id for {custom_field.id!r} must be a string option id")
            namespace_key = f"rooms.{custom_field.id}"
            default_option_ids = {option.id for option in self.single_select_options.get(namespace_key, [])}
            if default_raw not in default_option_ids:
                raise ValueError(
                    f"default_option_id {default_raw!r} for {custom_field.id!r} "
                    "does not reference an option in the field's option list"
                )

        # Phase 4: formula cycle detection across the Rooms table's
        # custom formula fields. Missing refs are *silently absorbed*
        # (per plan-13 D2) — the evaluator surfaces them per-row at
        # read time as `{"error": "missing_ref"}` so the user can fix
        # the formula by reopening the editor. Cycles, however, are a
        # hard validation failure: the document refuses to validate
        # until the cycle is broken.
        self._validate_rooms_formula_cycles(custom_field_ids)

        pump_ids: set[str] = set()
        pump_tags: set[str] = set()
        pump_device_type_ids = {option.id for option in self.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]}
        for pump in self.tables.equipment.pumps:
            if pump.id in pump_ids:
                raise ValueError(f"Duplicate pump id: {pump.id}")
            pump_ids.add(pump.id)

            if pump.tag is not None:
                normalized_tag = normalize_display_name(pump.tag)
                if normalized_tag in pump_tags:
                    raise ValueError(f"Duplicate pump tag: {pump.tag}")
                pump_tags.add(normalized_tag)

            if pump.device_type is not None and pump.device_type not in pump_device_type_ids:
                raise ValueError(f"Missing pump device-type option for pump {pump.id}: {pump.device_type}")

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

        return self

    def _validate_rooms_formula_cycles(self, custom_field_ids: dict[str, CustomFieldDef]) -> None:
        # Lazy-import to keep the document module free of formula deps
        # for callers that don't touch custom formula fields.
        from features.project_document.formula import (
            FormulaAST,
            FormulaCycleError,
            ast_from_json,
            detect_cycles,
        )

        formula_fields = [f for f in custom_field_ids.values() if f.field_type.value == "formula"]
        if not formula_fields:
            return

        asts_by_id: dict[str, FormulaAST] = {}
        for f in formula_fields:
            stored = f.config.get("ast")
            if stored is None:
                continue
            try:
                asts_by_id[f.id] = ast_from_json(stored)
            except (ValueError, TypeError):
                continue

        for f in formula_fields:
            stored = asts_by_id.get(f.id)
            if stored is None:
                continue
            # Build a deps map that excludes this field, then re-run
            # cycle detection rooted at this field. `detect_cycles`
            # composes its own asts map.
            others = {k: v for k, v in asts_by_id.items() if k != f.id}
            try:
                detect_cycles(f.id, stored, others)
            except FormulaCycleError as exc:
                raise ValueError(f"Rooms formula cycle for {f.display_name!r}: {' -> '.join(exc.cycle_path)}") from exc
