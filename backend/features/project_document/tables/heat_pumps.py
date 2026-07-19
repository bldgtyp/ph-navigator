"""Heat-pump leaf table contracts for the project document registry."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Any, ClassVar, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from features.heat_pumps.models import (
    HEAT_PUMP_INSTALL_TYPE_OPTION_KEY,
    HEAT_PUMP_MANUFACTURER_OPTION_KEY,
    HEAT_PUMP_MODEL_TYPE_OPTION_KEY,
    HEAT_PUMP_REFRIGERANT_OPTION_KEY,
    HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY,
    HeatPumpIndoorEquipRow,
    HeatPumpIndoorEquipTableEnvelope,
    HeatPumpIndoorUnitRow,
    HeatPumpIndoorUnitsTableEnvelope,
    HeatPumpOutdoorEquipRow,
    HeatPumpOutdoorEquipTableEnvelope,
    HeatPumpOutdoorUnitRow,
    HeatPumpOutdoorUnitsTableEnvelope,
)
from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.models import ProjectDocumentSource
from features.project_document.options import option_list_key, read_option_list, replace_option_list
from features.project_document.rows import RowWithCustomFields
from features.project_document.tables._attachment_fields import datasheet_field_def, photo_field_def
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables._registry_helpers import (
    FormulaType,
    coerce_custom_option_list_extras,
    custom_option_lists_for_table,
    make_field_registry,
)
from features.project_document.tables._status_field import STATUS_FIELD_KEY, status_field_def
from features.project_document.tables.contracts import (
    TableContract,
    TableFieldRegistry,
    read_table_envelope,
    replace_table_envelope,
)
from features.project_document.tables.dependent_links import (
    DependentLink,
    apply_dependent_link_cascade,
)
from features.project_document.validation import validate_outgoing_document

HEAT_PUMPS_OUTDOOR_EQUIP_TABLE_NAME = "heat_pumps_outdoor_equip"
HEAT_PUMPS_INDOOR_EQUIP_TABLE_NAME = "heat_pumps_indoor_equip"
HEAT_PUMPS_OUTDOOR_UNITS_TABLE_NAME = "heat_pumps_outdoor_units"
HEAT_PUMPS_INDOOR_UNITS_TABLE_NAME = "heat_pumps_indoor_units"

# Built-in `status` option keys for all four heat-pump leaves. The leaf
# table_path (e.g. `("equipment", "heat_pumps", "outdoor_equip")`) does not
# match the flat `<table_label>.status` namespace the generic-table validator
# resolves under, so these keys are registered explicitly in
# `built_in_option_key_by_field_key`.
HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY = f"{HEAT_PUMPS_OUTDOOR_EQUIP_TABLE_NAME}.status"
HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY = f"{HEAT_PUMPS_INDOOR_EQUIP_TABLE_NAME}.status"
HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY = f"{HEAT_PUMPS_OUTDOOR_UNITS_TABLE_NAME}.status"
HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY = f"{HEAT_PUMPS_INDOOR_UNITS_TABLE_NAME}.status"

_OUTDOOR_EQUIP_PATH: tuple[str, ...] = ("equipment", "heat_pumps", "outdoor_equip")
_INDOOR_EQUIP_PATH: tuple[str, ...] = ("equipment", "heat_pumps", "indoor_equip")
_OUTDOOR_UNITS_PATH: tuple[str, ...] = ("equipment", "heat_pumps", "outdoor_units")
_INDOOR_UNITS_PATH: tuple[str, ...] = ("equipment", "heat_pumps", "indoor_units")


OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Outdoor equipment schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Display Name", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="model_number", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="paired_indoor_equip_id",
        display_name="Paired Indoor Equipment",
        field_type=CustomFieldType.linked_record,
        config={"target_table_path": list(_INDOOR_EQUIP_PATH), "max_links": 1},
    ),
    built_in_field_def(
        field_key="system_family",
        display_name="System Family",
        field_type=CustomFieldType.single_select,
    ),
    built_in_field_def(field_key="refrigerant", display_name="Refrigerant", field_type=CustomFieldType.single_select),
    built_in_field_def(
        field_key="heating_cap_kw_17f",
        display_name="Heating Capacity 17F",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(
        field_key="heating_cap_kw_47f",
        display_name="Heating Capacity 47F",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(
        field_key="heating_data_type",
        display_name="Heating Data Type",
        field_type=CustomFieldType.short_text,
    ),
    built_in_field_def(field_key="heating_cop_17f", display_name="COP 17F", field_type=CustomFieldType.number),
    built_in_field_def(field_key="heating_cop_47f", display_name="COP 47F", field_type=CustomFieldType.number),
    built_in_field_def(field_key="hspf", display_name="HSPF / HSPF2", field_type=CustomFieldType.number),
    built_in_field_def(
        field_key="cooling_cap_kw_95f",
        display_name="Cooling Capacity 95F",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(
        field_key="cooling_data_type",
        display_name="Cooling Data Type",
        field_type=CustomFieldType.short_text,
    ),
    built_in_field_def(field_key="eer", display_name="EER / EER2", field_type=CustomFieldType.number),
    built_in_field_def(field_key="seer", display_name="SEER / SEER2", field_type=CustomFieldType.number),
    built_in_field_def(field_key="ieer", display_name="IEER", field_type=CustomFieldType.number),
    datasheet_field_def(),
    photo_field_def(),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
    status_field_def(),
)

INDOOR_EQUIP_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Indoor equipment schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Display Name", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="model_type", display_name="Model Type", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="model_number", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="install_type", display_name="Install Type", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="nominal_tons", display_name="Nominal Tons", field_type=CustomFieldType.number),
    built_in_field_def(field_key="fan_speed_cfm", display_name="Fan Speed", field_type=CustomFieldType.number),
    built_in_field_def(field_key="cooling_btuh", display_name="Cooling Btu/h", field_type=CustomFieldType.number),
    built_in_field_def(
        field_key="heating_btuh_47f",
        display_name="Heating Btu/h 47F",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(
        field_key="heating_btuh_17f",
        display_name="Heating Btu/h 17F",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(field_key="heating_cop", display_name="Heating COP", field_type=CustomFieldType.number),
    built_in_field_def(field_key="seer", display_name="SEER", field_type=CustomFieldType.number),
    built_in_field_def(field_key="eer", display_name="EER", field_type=CustomFieldType.number),
    built_in_field_def(field_key="hspf", display_name="HSPF", field_type=CustomFieldType.number),
    datasheet_field_def(),
    photo_field_def(),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
    status_field_def(),
)

OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Outdoor unit schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Display Name", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="outdoor_equip_id",
        display_name="Outdoor Equipment",
        field_type=CustomFieldType.linked_record,
        config={"target_table_path": list(_OUTDOOR_EQUIP_PATH), "max_links": 1},
    ),
    datasheet_field_def(),
    photo_field_def(),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
    status_field_def(),
)

INDOOR_UNITS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Indoor unit schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Display Name", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="indoor_equip_id",
        display_name="Indoor Equipment",
        field_type=CustomFieldType.linked_record,
        config={"target_table_path": list(_INDOOR_EQUIP_PATH), "max_links": 1},
    ),
    built_in_field_def(
        field_key="outdoor_unit_id",
        display_name="Outdoor Unit",
        field_type=CustomFieldType.linked_record,
        config={"target_table_path": list(_OUTDOOR_UNITS_PATH), "max_links": 1},
    ),
    built_in_field_def(
        field_key="linked_erv_unit_id",
        display_name="Linked ERV",
        field_type=CustomFieldType.linked_record,
        config={"target_table_path": ["equipment", "ervs"], "max_links": 1},
    ),
    built_in_field_def(
        field_key="served_room_ids",
        display_name="Served Rooms",
        field_type=CustomFieldType.linked_record,
        config={"target_table_path": ["rooms"], "max_links": None},
    ),
    datasheet_field_def(),
    photo_field_def(),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
    status_field_def(),
)


@dataclass(frozen=True)
class HeatPumpLeafValidationSpec:
    table_label: str
    row_label: str
    table_path: tuple[str, ...]
    contract: TableContract


class HeatPumpLeafOptions(BaseModel):
    table_path: ClassVar[tuple[str, ...]]
    table_name: ClassVar[str]

    model_config = ConfigDict(extra="allow")

    @model_validator(mode="after")
    def _validate_namespaced_extras(self) -> HeatPumpLeafOptions:
        coerce_custom_option_list_extras(self, table_path=self._table_path(), table_label=self._table_name())
        return self

    def _table_path(self) -> tuple[str, ...]:
        return self.__class__.table_path

    def _table_name(self) -> str:
        return self.__class__.table_name

    def custom_option_lists(self) -> dict[str, list[SingleSelectOption]]:
        return dict(self.__pydantic_extra__ or {})

    def built_in_options(self) -> dict[str, list[SingleSelectOption]]:
        return {}


class OutdoorEquipOptions(HeatPumpLeafOptions):
    table_path: ClassVar[tuple[str, ...]] = _OUTDOOR_EQUIP_PATH
    table_name: ClassVar[str] = HEAT_PUMPS_OUTDOOR_EQUIP_TABLE_NAME

    manufacturer: list[SingleSelectOption] = Field(alias=HEAT_PUMP_MANUFACTURER_OPTION_KEY)
    system_family: list[SingleSelectOption] = Field(alias=HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY)
    refrigerant: list[SingleSelectOption] = Field(alias=HEAT_PUMP_REFRIGERANT_OPTION_KEY)
    status: list[SingleSelectOption] = Field(alias=HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY)

    def built_in_options(self) -> dict[str, list[SingleSelectOption]]:
        return {
            HEAT_PUMP_MANUFACTURER_OPTION_KEY: self.manufacturer,
            HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY: self.system_family,
            HEAT_PUMP_REFRIGERANT_OPTION_KEY: self.refrigerant,
            HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY: self.status,
        }


class IndoorEquipOptions(HeatPumpLeafOptions):
    table_path: ClassVar[tuple[str, ...]] = _INDOOR_EQUIP_PATH
    table_name: ClassVar[str] = HEAT_PUMPS_INDOOR_EQUIP_TABLE_NAME

    manufacturer: list[SingleSelectOption] = Field(alias=HEAT_PUMP_MANUFACTURER_OPTION_KEY)
    model_type: list[SingleSelectOption] = Field(alias=HEAT_PUMP_MODEL_TYPE_OPTION_KEY)
    install_type: list[SingleSelectOption] = Field(alias=HEAT_PUMP_INSTALL_TYPE_OPTION_KEY)
    status: list[SingleSelectOption] = Field(alias=HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY)

    def built_in_options(self) -> dict[str, list[SingleSelectOption]]:
        return {
            HEAT_PUMP_MANUFACTURER_OPTION_KEY: self.manufacturer,
            HEAT_PUMP_MODEL_TYPE_OPTION_KEY: self.model_type,
            HEAT_PUMP_INSTALL_TYPE_OPTION_KEY: self.install_type,
            HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY: self.status,
        }


class OutdoorUnitsOptions(HeatPumpLeafOptions):
    table_path: ClassVar[tuple[str, ...]] = _OUTDOOR_UNITS_PATH
    table_name: ClassVar[str] = HEAT_PUMPS_OUTDOOR_UNITS_TABLE_NAME

    status: list[SingleSelectOption] = Field(alias=HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY)

    def built_in_options(self) -> dict[str, list[SingleSelectOption]]:
        return {HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY: self.status}


class IndoorUnitsOptions(HeatPumpLeafOptions):
    table_path: ClassVar[tuple[str, ...]] = _INDOOR_UNITS_PATH
    table_name: ClassVar[str] = HEAT_PUMPS_INDOOR_UNITS_TABLE_NAME

    status: list[SingleSelectOption] = Field(alias=HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY)

    def built_in_options(self) -> dict[str, list[SingleSelectOption]]:
        return {HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY: self.status}


class OutdoorEquipReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outdoor_equip: list[HeatPumpOutdoorEquipRow]
    field_defs: list[TableFieldDef] = Field(default_factory=list)
    single_select_options: OutdoorEquipOptions


class IndoorEquipReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indoor_equip: list[HeatPumpIndoorEquipRow]
    field_defs: list[TableFieldDef] = Field(default_factory=list)
    single_select_options: IndoorEquipOptions


class OutdoorUnitsReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outdoor_units: list[HeatPumpOutdoorUnitRow]
    field_defs: list[TableFieldDef] = Field(default_factory=list)
    single_select_options: OutdoorUnitsOptions


class IndoorUnitsReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indoor_units: list[HeatPumpIndoorUnitRow]
    field_defs: list[TableFieldDef] = Field(default_factory=list)
    single_select_options: IndoorUnitsOptions


class HeatPumpLeafResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)


class OutdoorEquipResponse(HeatPumpLeafResponse):
    outdoor_equip: list[HeatPumpOutdoorEquipRow]


class IndoorEquipResponse(HeatPumpLeafResponse):
    indoor_equip: list[HeatPumpIndoorEquipRow]


class OutdoorUnitsResponse(HeatPumpLeafResponse):
    outdoor_units: list[HeatPumpOutdoorUnitRow]


class IndoorUnitsResponse(HeatPumpLeafResponse):
    indoor_units: list[HeatPumpIndoorUnitRow]


def _field_keys(field_defs: tuple[TableFieldDef, ...]) -> tuple[str, ...]:
    return tuple(field.field_key for field in field_defs)


def _locked_keys(field_defs: tuple[TableFieldDef, ...]) -> frozenset[str]:
    return frozenset(field.field_key for field in field_defs)


def _formula_types_from_field_defs(field_defs: tuple[TableFieldDef, ...]) -> dict[str, FormulaType]:
    by_field_type: dict[CustomFieldType, FormulaType] = {
        CustomFieldType.short_text: "text",
        CustomFieldType.long_text: "text",
        CustomFieldType.url: "text",
        CustomFieldType.number: "number",
        CustomFieldType.single_select: "single_select",
    }
    return {
        field.field_key: formula_type
        for field in field_defs
        if (formula_type := by_field_type.get(field.field_type)) is not None
    }


def _read_field_option_list(
    body: ProjectDocumentV1,
    *,
    table_path: tuple[str, ...],
    built_in_option_key_by_field_key: dict[str, str],
    field_key: str,
) -> list[SingleSelectOption]:
    option_key = built_in_option_key_by_field_key.get(field_key, option_list_key(table_path, field_key))
    return read_option_list(body, option_key)


def _replace_field_option_list(
    body: ProjectDocumentV1,
    *,
    table_path: tuple[str, ...],
    built_in_option_key_by_field_key: dict[str, str],
    field_key: str,
    options: list[SingleSelectOption],
) -> ProjectDocumentV1:
    option_key = built_in_option_key_by_field_key.get(field_key, option_list_key(table_path, field_key))
    return replace_option_list(body, option_key, options)


def _read_status_aware_option_value(
    row: object,
    field_key: str,
    *,
    row_model: type[RowWithCustomFields],
    fallback: Callable[[object, str], str | None],
) -> str | None:
    """Read the shared `status` single-select value from `custom_values`.

    `status` is registered in `built_in_option_key_by_field_key` only to pin
    its option list under the flat `<table_label>.status` key, but the value
    itself lives in `row.custom_values` (it has no typed column). Route it
    there; every other key keeps the default typed-column accessor.
    """
    if field_key == STATUS_FIELD_KEY:
        if not isinstance(row, row_model):
            raise TypeError(f"expected {row_model.__name__}, got {type(row).__name__}")
        value = row.custom_values.get(STATUS_FIELD_KEY)
        return value if isinstance(value, str) else None
    return fallback(row, field_key)


def _set_status_aware_option_value(
    row: object,
    field_key: str,
    value: str | None,
    *,
    row_model: type[RowWithCustomFields],
    fallback: Callable[[object, str, str | None], object],
) -> object:
    if field_key == STATUS_FIELD_KEY:
        if not isinstance(row, row_model):
            raise TypeError(f"expected {row_model.__name__}, got {type(row).__name__}")
        next_custom = dict(row.custom_values)
        next_custom[STATUS_FIELD_KEY] = value
        return row.model_copy(update={"custom_values": next_custom})
    return fallback(row, field_key, value)


def _make_registry(
    *,
    field_defs: tuple[TableFieldDef, ...],
    table_path: tuple[str, ...],
    row_model: type[RowWithCustomFields],
    built_in_option_key_by_field_key: dict[str, str] | None = None,
    option_editable_builtin_field_keys: frozenset[str] = frozenset(),
    built_in_formula_types: dict[str, FormulaType],
) -> TableFieldRegistry:
    option_keys = built_in_option_key_by_field_key or {}
    registry = make_field_registry(
        field_keys=_field_keys(field_defs),
        table_path=table_path,
        row_model=row_model,
        built_in_option_key_by_field_key=option_keys,
        built_in_formula_types=built_in_formula_types,
        option_editable_builtin_field_keys=option_editable_builtin_field_keys,
        field_type_locked_keys=_locked_keys(field_defs),
    )
    default_read_option_value = registry.read_built_in_option_value
    default_set_option_value = registry.set_built_in_option_value
    return replace(
        registry,
        read_field_option_list=lambda body, field_key: _read_field_option_list(
            body,
            table_path=table_path,
            built_in_option_key_by_field_key=option_keys,
            field_key=field_key,
        ),
        replace_field_option_list=lambda body, field_key, options: _replace_field_option_list(
            body,
            table_path=table_path,
            built_in_option_key_by_field_key=option_keys,
            field_key=field_key,
            options=options,
        ),
        read_built_in_option_value=lambda row, field_key: _read_status_aware_option_value(
            row, field_key, row_model=row_model, fallback=default_read_option_value
        ),
        set_built_in_option_value=lambda row, field_key, value: _set_status_aware_option_value(
            row, field_key, value, row_model=row_model, fallback=default_set_option_value
        ),
    )


def _apply_replace(
    body: ProjectDocumentV1,
    *,
    table_path: tuple[str, ...],
    envelope_model: type[BaseModel],
    payload: BaseModel,
    rows_attr: str,
    dependent_links: tuple[DependentLink, ...] = (),
) -> ProjectDocumentV1:
    payload_any = cast(Any, payload)
    options_payload = cast(HeatPumpLeafOptions, payload_any.single_select_options)
    built_in_options = options_payload.built_in_options()
    custom_options = options_payload.custom_option_lists()
    current_envelope = read_table_envelope(body, table_path)
    rows = getattr(payload, rows_attr)
    field_defs = payload_any.field_defs
    current_envelope_any = cast(Any, current_envelope)
    if (
        current_envelope_any.rows == rows
        and current_envelope_any.field_defs == field_defs
        and all(body.single_select_options.get(key, []) == value for key, value in built_in_options.items())
        and all(body.single_select_options.get(key, []) == value for key, value in custom_options.items())
    ):
        return body

    options = dict(body.single_select_options)
    options.update(built_in_options)
    options.update(custom_options)
    next_envelope = envelope_model.model_validate({"field_defs": field_defs, "rows": rows})
    next_body = replace_table_envelope(body, table_path, next_envelope).model_copy(
        update={"single_select_options": options}
    )
    # Block (required) or clear (optional) sibling links to any rows this
    # replace removed, before the document validator would reject a dangling
    # reference. This is the generic form of the old heat-pump delete-cascade.
    next_body = apply_dependent_link_cascade(body, next_body, table_path=table_path, dependent_links=dependent_links)
    return validate_outgoing_document(next_body.model_dump(mode="json"))


def _leaf_options(
    body: ProjectDocumentV1,
    *,
    table_path: tuple[str, ...],
    built_in_option_keys: tuple[str, ...],
) -> dict[str, list[SingleSelectOption]]:
    return {
        **{key: body.single_select_options[key] for key in built_in_option_keys},
        **custom_option_lists_for_table(body, table_path),
    }


def _response_factory(
    *,
    response_model: type[HeatPumpLeafResponse],
    table_path: tuple[str, ...],
    rows_attr: str,
    registry: TableFieldRegistry,
    built_in_option_keys: tuple[str, ...] = (),
) -> Callable[[UUID, UUID, ProjectDocumentSource, str, str | None, ProjectDocumentV1], HeatPumpLeafResponse]:
    def build(
        project_id: UUID,
        version_id: UUID,
        source: ProjectDocumentSource,
        version_etag: str,
        draft_etag: str | None,
        body: ProjectDocumentV1,
    ) -> HeatPumpLeafResponse:
        from features.project_document.formula import evaluate_table_formulas

        envelope = cast(Any, read_table_envelope(body, table_path))
        return response_model.model_validate(
            {
                "project_id": project_id,
                "version_id": version_id,
                "source": source,
                "version_etag": version_etag,
                "draft_etag": draft_etag,
                "field_defs": envelope.field_defs,
                rows_attr: envelope.rows,
                "single_select_options": _leaf_options(
                    body,
                    table_path=table_path,
                    built_in_option_keys=built_in_option_keys,
                ),
                "rows_computed": evaluate_table_formulas(registry, body),
            }
        )

    return build


def _extract_envelope(
    body: ProjectDocumentV1,
    *,
    table_path: tuple[str, ...],
    registry: TableFieldRegistry,
) -> dict[str, object]:
    from features.project_document.formula import evaluate_table_formulas

    envelope = cast(Any, read_table_envelope(body, table_path))
    row_dicts = [row.model_dump(mode="json") for row in envelope.rows]
    return {
        "field_defs": [field.model_dump(mode="json") for field in envelope.field_defs],
        "rows": registry.attach_computed_overlay(row_dicts, evaluate_table_formulas(registry, body)),
    }


def _extract_diff_value(
    body: ProjectDocumentV1,
    *,
    table_name: str,
    table_path: tuple[str, ...],
    registry: TableFieldRegistry,
    built_in_option_keys: tuple[str, ...],
) -> dict[str, object]:
    return {
        table_name: _extract_envelope(body, table_path=table_path, registry=registry),
        "single_select_options": {
            key: [option.model_dump(mode="json") for option in values]
            for key, values in _leaf_options(
                body,
                table_path=table_path,
                built_in_option_keys=built_in_option_keys,
            ).items()
        },
    }


outdoor_equip_field_registry = _make_registry(
    field_defs=OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
    table_path=_OUTDOOR_EQUIP_PATH,
    row_model=HeatPumpOutdoorEquipRow,
    built_in_option_key_by_field_key={
        "manufacturer": HEAT_PUMP_MANUFACTURER_OPTION_KEY,
        "system_family": HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY,
        "refrigerant": HEAT_PUMP_REFRIGERANT_OPTION_KEY,
        "status": HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY,
    },
    option_editable_builtin_field_keys=frozenset({"manufacturer", "system_family", "refrigerant"}),
    built_in_formula_types=_formula_types_from_field_defs(OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS),
)
indoor_equip_field_registry = _make_registry(
    field_defs=INDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
    table_path=_INDOOR_EQUIP_PATH,
    row_model=HeatPumpIndoorEquipRow,
    built_in_option_key_by_field_key={
        "manufacturer": HEAT_PUMP_MANUFACTURER_OPTION_KEY,
        "model_type": HEAT_PUMP_MODEL_TYPE_OPTION_KEY,
        "install_type": HEAT_PUMP_INSTALL_TYPE_OPTION_KEY,
        "status": HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY,
    },
    option_editable_builtin_field_keys=frozenset({"manufacturer", "model_type", "install_type"}),
    built_in_formula_types=_formula_types_from_field_defs(INDOOR_EQUIP_BUILT_IN_FIELD_DEFS),
)
outdoor_units_field_registry = _make_registry(
    field_defs=OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS,
    table_path=_OUTDOOR_UNITS_PATH,
    row_model=HeatPumpOutdoorUnitRow,
    built_in_option_key_by_field_key={"status": HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY},
    built_in_formula_types=_formula_types_from_field_defs(OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS),
)
indoor_units_field_registry = _make_registry(
    field_defs=INDOOR_UNITS_BUILT_IN_FIELD_DEFS,
    table_path=_INDOOR_UNITS_PATH,
    row_model=HeatPumpIndoorUnitRow,
    built_in_option_key_by_field_key={"status": HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY},
    built_in_formula_types=_formula_types_from_field_defs(INDOOR_UNITS_BUILT_IN_FIELD_DEFS),
)


# Sibling links pointing back at each leaf. Required links block a delete (the
# referencing row can't drop a mandatory FK); optional links are cleared. This
# is the declarative form of the old `_delete_preview`/`_apply_delete_cascades`.
_OUTDOOR_EQUIP_DEPENDENT_LINKS: tuple[DependentLink, ...] = (
    DependentLink(
        dependent_table_path=_OUTDOOR_UNITS_PATH,
        dependent_table_label="outdoor-units",
        field_key="outdoor_equip_id",
        required=True,
    ),
)
_INDOOR_EQUIP_DEPENDENT_LINKS: tuple[DependentLink, ...] = (
    DependentLink(
        dependent_table_path=_INDOOR_UNITS_PATH,
        dependent_table_label="indoor-units",
        field_key="indoor_equip_id",
        required=True,
    ),
    DependentLink(
        dependent_table_path=_OUTDOOR_EQUIP_PATH,
        dependent_table_label="outdoor-equip",
        field_key="paired_indoor_equip_id",
        required=False,
    ),
)
_OUTDOOR_UNITS_DEPENDENT_LINKS: tuple[DependentLink, ...] = (
    DependentLink(
        dependent_table_path=_INDOOR_UNITS_PATH,
        dependent_table_label="indoor-units",
        field_key="outdoor_unit_id",
        required=False,
    ),
)
_INDOOR_UNITS_DEPENDENT_LINKS: tuple[DependentLink, ...] = ()


heat_pumps_outdoor_equip_contract = TableContract(
    name=HEAT_PUMPS_OUTDOOR_EQUIP_TABLE_NAME,
    schema_slug="heat_pump_outdoor_equip",
    schema_model=HeatPumpOutdoorEquipRow,
    replace_request_model=OutdoorEquipReplaceRequest,
    dependent_links=_OUTDOOR_EQUIP_DEPENDENT_LINKS,
    build_response=_response_factory(
        response_model=OutdoorEquipResponse,
        table_path=_OUTDOOR_EQUIP_PATH,
        rows_attr="outdoor_equip",
        registry=outdoor_equip_field_registry,
        built_in_option_keys=(
            HEAT_PUMP_MANUFACTURER_OPTION_KEY,
            HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY,
            HEAT_PUMP_REFRIGERANT_OPTION_KEY,
            HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY,
        ),
    ),
    apply_replace=lambda body, payload: _apply_replace(
        body,
        table_path=_OUTDOOR_EQUIP_PATH,
        envelope_model=HeatPumpOutdoorEquipTableEnvelope,
        payload=payload,
        rows_attr="outdoor_equip",
        dependent_links=_OUTDOOR_EQUIP_DEPENDENT_LINKS,
    ),
    extract_rows=lambda body: _extract_envelope(
        body,
        table_path=_OUTDOOR_EQUIP_PATH,
        registry=outdoor_equip_field_registry,
    ),
    extract_diff_value=lambda body: _extract_diff_value(
        body,
        table_name=HEAT_PUMPS_OUTDOOR_EQUIP_TABLE_NAME,
        table_path=_OUTDOOR_EQUIP_PATH,
        registry=outdoor_equip_field_registry,
        built_in_option_keys=(
            HEAT_PUMP_MANUFACTURER_OPTION_KEY,
            HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY,
            HEAT_PUMP_REFRIGERANT_OPTION_KEY,
            HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY,
        ),
    ),
    table_path=_OUTDOOR_EQUIP_PATH,
    field_registry=outdoor_equip_field_registry,
)

heat_pumps_indoor_equip_contract = TableContract(
    name=HEAT_PUMPS_INDOOR_EQUIP_TABLE_NAME,
    schema_slug="heat_pump_indoor_equip",
    schema_model=HeatPumpIndoorEquipRow,
    replace_request_model=IndoorEquipReplaceRequest,
    dependent_links=_INDOOR_EQUIP_DEPENDENT_LINKS,
    build_response=_response_factory(
        response_model=IndoorEquipResponse,
        table_path=_INDOOR_EQUIP_PATH,
        rows_attr="indoor_equip",
        registry=indoor_equip_field_registry,
        built_in_option_keys=(
            HEAT_PUMP_MANUFACTURER_OPTION_KEY,
            HEAT_PUMP_MODEL_TYPE_OPTION_KEY,
            HEAT_PUMP_INSTALL_TYPE_OPTION_KEY,
            HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY,
        ),
    ),
    apply_replace=lambda body, payload: _apply_replace(
        body,
        table_path=_INDOOR_EQUIP_PATH,
        envelope_model=HeatPumpIndoorEquipTableEnvelope,
        payload=payload,
        rows_attr="indoor_equip",
        dependent_links=_INDOOR_EQUIP_DEPENDENT_LINKS,
    ),
    extract_rows=lambda body: _extract_envelope(
        body,
        table_path=_INDOOR_EQUIP_PATH,
        registry=indoor_equip_field_registry,
    ),
    extract_diff_value=lambda body: _extract_diff_value(
        body,
        table_name=HEAT_PUMPS_INDOOR_EQUIP_TABLE_NAME,
        table_path=_INDOOR_EQUIP_PATH,
        registry=indoor_equip_field_registry,
        built_in_option_keys=(
            HEAT_PUMP_MANUFACTURER_OPTION_KEY,
            HEAT_PUMP_MODEL_TYPE_OPTION_KEY,
            HEAT_PUMP_INSTALL_TYPE_OPTION_KEY,
            HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY,
        ),
    ),
    table_path=_INDOOR_EQUIP_PATH,
    field_registry=indoor_equip_field_registry,
)

heat_pumps_outdoor_units_contract = TableContract(
    name=HEAT_PUMPS_OUTDOOR_UNITS_TABLE_NAME,
    schema_slug="heat_pump_outdoor_unit",
    schema_model=HeatPumpOutdoorUnitRow,
    replace_request_model=OutdoorUnitsReplaceRequest,
    dependent_links=_OUTDOOR_UNITS_DEPENDENT_LINKS,
    build_response=_response_factory(
        response_model=OutdoorUnitsResponse,
        table_path=_OUTDOOR_UNITS_PATH,
        rows_attr="outdoor_units",
        registry=outdoor_units_field_registry,
        built_in_option_keys=(HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY,),
    ),
    apply_replace=lambda body, payload: _apply_replace(
        body,
        table_path=_OUTDOOR_UNITS_PATH,
        envelope_model=HeatPumpOutdoorUnitsTableEnvelope,
        payload=payload,
        rows_attr="outdoor_units",
        dependent_links=_OUTDOOR_UNITS_DEPENDENT_LINKS,
    ),
    extract_rows=lambda body: _extract_envelope(
        body,
        table_path=_OUTDOOR_UNITS_PATH,
        registry=outdoor_units_field_registry,
    ),
    extract_diff_value=lambda body: _extract_diff_value(
        body,
        table_name=HEAT_PUMPS_OUTDOOR_UNITS_TABLE_NAME,
        table_path=_OUTDOOR_UNITS_PATH,
        registry=outdoor_units_field_registry,
        built_in_option_keys=(HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY,),
    ),
    table_path=_OUTDOOR_UNITS_PATH,
    field_registry=outdoor_units_field_registry,
)

heat_pumps_indoor_units_contract = TableContract(
    name=HEAT_PUMPS_INDOOR_UNITS_TABLE_NAME,
    schema_slug="heat_pump_indoor_unit",
    schema_model=HeatPumpIndoorUnitRow,
    replace_request_model=IndoorUnitsReplaceRequest,
    dependent_links=_INDOOR_UNITS_DEPENDENT_LINKS,
    build_response=_response_factory(
        response_model=IndoorUnitsResponse,
        table_path=_INDOOR_UNITS_PATH,
        rows_attr="indoor_units",
        registry=indoor_units_field_registry,
        built_in_option_keys=(HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY,),
    ),
    apply_replace=lambda body, payload: _apply_replace(
        body,
        table_path=_INDOOR_UNITS_PATH,
        envelope_model=HeatPumpIndoorUnitsTableEnvelope,
        payload=payload,
        rows_attr="indoor_units",
    ),
    extract_rows=lambda body: _extract_envelope(
        body,
        table_path=_INDOOR_UNITS_PATH,
        registry=indoor_units_field_registry,
    ),
    extract_diff_value=lambda body: _extract_diff_value(
        body,
        table_name=HEAT_PUMPS_INDOOR_UNITS_TABLE_NAME,
        table_path=_INDOOR_UNITS_PATH,
        registry=indoor_units_field_registry,
        built_in_option_keys=(HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY,),
    ),
    table_path=_INDOOR_UNITS_PATH,
    field_registry=indoor_units_field_registry,
)


HEAT_PUMP_LEAF_VALIDATION_SPECS: tuple[HeatPumpLeafValidationSpec, ...] = (
    HeatPumpLeafValidationSpec(
        table_label=HEAT_PUMPS_OUTDOOR_EQUIP_TABLE_NAME,
        row_label="heat-pump outdoor equipment",
        table_path=_OUTDOOR_EQUIP_PATH,
        contract=heat_pumps_outdoor_equip_contract,
    ),
    HeatPumpLeafValidationSpec(
        table_label=HEAT_PUMPS_INDOOR_EQUIP_TABLE_NAME,
        row_label="heat-pump indoor equipment",
        table_path=_INDOOR_EQUIP_PATH,
        contract=heat_pumps_indoor_equip_contract,
    ),
    HeatPumpLeafValidationSpec(
        table_label=HEAT_PUMPS_OUTDOOR_UNITS_TABLE_NAME,
        row_label="heat-pump outdoor unit",
        table_path=_OUTDOOR_UNITS_PATH,
        contract=heat_pumps_outdoor_units_contract,
    ),
    HeatPumpLeafValidationSpec(
        table_label=HEAT_PUMPS_INDOOR_UNITS_TABLE_NAME,
        row_label="heat-pump indoor unit",
        table_path=_INDOOR_UNITS_PATH,
        contract=heat_pumps_indoor_units_contract,
    ),
)
