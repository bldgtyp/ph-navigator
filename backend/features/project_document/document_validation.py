"""Cross-table invariants for ``ProjectDocumentV1``.

Kept out of ``document.py`` so the Pydantic schema module can stay focused on
wire shape while this module owns relationships between tables, option lists,
formula refs, and semantic envelope/aperture entities.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, cast

from features.heat_pumps.models import (
    HEAT_PUMP_INSTALL_TYPE_OPTION_KEY,
    HEAT_PUMP_MANUFACTURER_OPTION_KEY,
    HEAT_PUMP_MODEL_TYPE_OPTION_KEY,
    HEAT_PUMP_REFRIGERANT_OPTION_KEY,
    HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY,
    HEAT_PUMP_VISIBLE_OPTION_KEYS,
)
from features.project_document._validators import (
    RowWithIdentity,
    collect_target_row_ids,
    validate_envelope_references,
    validate_generic_table,
    validate_table_row_ids,
    validate_typed_option_refs,
    validate_unique_ids,
)
from features.project_document.custom_fields import normalize_display_name
from features.project_document.document import (
    APPLIANCE_ENERGY_STAR_OPTION_KEY,
    APPLIANCE_OPTION_KEYS,
    APPLIANCE_TYPE_OPTION_KEY,
    FAN_OPTION_KEYS,
    FAN_TYPE_OPTION_KEY,
    HOT_WATER_HEATER_OPTION_KEYS,
    HOT_WATER_HEATER_TYPE_OPTION_KEY,
    HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY,
    HOT_WATER_TANK_OPTION_KEYS,
    HOT_WATER_TANK_TYPE_OPTION_KEY,
    PUMP_DEVICE_TYPE_OPTION_KEY,
    PUMP_INSIDE_OUTSIDE_OPTION_KEY,
    PUMP_OPTION_KEYS,
    ROOM_BUILDING_ZONE_OPTION_KEY,
    ROOM_FLOOR_LEVEL_OPTION_KEY,
    ROOM_OPTION_KEYS,
    THERMAL_BRIDGE_OPTION_KEYS,
    THERMAL_BRIDGE_TYPE_OPTION_KEY,
    VENTILATOR_FROST_PROTECTION_OPTION_KEY,
    VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
    VENTILATOR_OPTION_KEYS,
)

if TYPE_CHECKING:
    from features.project_document.document import ProjectDocumentV1


def validate_document_references(document: ProjectDocumentV1) -> ProjectDocumentV1:
    for key in ROOM_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in PUMP_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in VENTILATOR_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in FAN_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in HOT_WATER_HEATER_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in HOT_WATER_TANK_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in APPLIANCE_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in THERMAL_BRIDGE_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])
    for key in HEAT_PUMP_VISIBLE_OPTION_KEYS:
        document.single_select_options.setdefault(key, [])

    for key, options in document.single_select_options.items():
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

    # The hidden row.id is the only enforced-unique identity; guarantee
    # it on every generic DataTable in one place (record-identity model).
    validate_table_row_ids(document)

    target_row_ids = collect_target_row_ids(document)

    rooms = document.tables.rooms.rows
    room_ids = {room.id for room in rooms}
    floor_option_ids = {option.id for option in document.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]}
    zone_option_ids = {option.id for option in document.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY]}
    validate_typed_option_refs(
        rows=[(room.id, room.floor_level) for room in rooms],
        valid_option_ids=floor_option_ids,
        missing_message="Missing floor-level option for room {row_id}: {value}",
    )
    validate_typed_option_refs(
        rows=[(room.id, room.building_zone) for room in rooms],
        valid_option_ids=zone_option_ids,
        missing_message="Missing building-zone option for room {row_id}: {value}",
    )
    validate_generic_table(
        table_label="rooms",
        row_label="room",
        table_path=("rooms",),
        field_defs=document.tables.rooms.field_defs,
        rows=rooms,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
        validate_defaults=True,
    )

    # Space-Types follows the generic identity model: row.id uniqueness is
    # guaranteed by validate_table_row_ids; the Tag (record_id) and Name
    # are ordinary, non-unique fields. No hard block on duplicate Tags or
    # on a named row without a Tag — duplicates warn via the chip.
    validate_generic_table(
        table_label="space_types",
        row_label="space type",
        table_path=("space_types",),
        field_defs=document.tables.space_types.field_defs,
        rows=document.tables.space_types.rows,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
        validate_defaults=True,
    )

    pumps = document.tables.equipment.pumps.rows
    pump_device_type_ids = {option.id for option in document.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]}
    pump_inside_outside_ids = {option.id for option in document.single_select_options[PUMP_INSIDE_OUTSIDE_OPTION_KEY]}
    validate_typed_option_refs(
        rows=[(pump.id, pump.device_type) for pump in pumps],
        valid_option_ids=pump_device_type_ids,
        missing_message="Missing pump device-type option for pump {row_id}: {value}",
    )
    validate_generic_table(
        table_label="pumps",
        row_label="pump",
        table_path=("equipment", "pumps"),
        field_defs=document.tables.equipment.pumps.field_defs,
        rows=pumps,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
        non_negative_field_keys=frozenset({"volts", "horse_power", "wattage", "flow_gpm", "runtime_khr_yr"}),
    )

    fans = document.tables.equipment.fans.rows
    fan_type_ids = {option.id for option in document.single_select_options[FAN_TYPE_OPTION_KEY]}
    validate_typed_option_refs(
        rows=[(fan.id, fan.fan_type) for fan in fans],
        valid_option_ids=fan_type_ids,
        missing_message="Missing fan type option for fan {row_id}: {value}",
    )
    _validate_unit_fraction(fans, "power_factor", "fan power_factor must be between 0 and 1: {row_id}")
    validate_generic_table(
        table_label="fans",
        row_label="fan",
        table_path=("equipment", "fans"),
        field_defs=document.tables.equipment.fans.field_defs,
        rows=fans,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
        non_negative_field_keys=frozenset(
            {"quantity", "annual_runtime_min_yr", "airflow_m3h", "amps", "volts", "watts"}
        ),
    )

    hot_water_heaters = document.tables.equipment.hot_water_heaters.rows
    hot_water_heater_type_ids = {
        option.id for option in document.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY]
    }
    validate_typed_option_refs(
        rows=[(heater.id, heater.heater_type) for heater in hot_water_heaters],
        valid_option_ids=hot_water_heater_type_ids,
        missing_message="Missing hot water heater type option for heater {row_id}: {value}",
    )
    _validate_unit_fraction(
        hot_water_heaters, "power_factor", "hot water heater power_factor must be between 0 and 1: {row_id}"
    )
    validate_generic_table(
        table_label="hot_water_heaters",
        row_label="hot water heater",
        table_path=("equipment", "hot_water_heaters"),
        field_defs=document.tables.equipment.hot_water_heaters.field_defs,
        rows=hot_water_heaters,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
        non_negative_field_keys=frozenset({"quantity", "size_l", "amps", "volts", "watts", "uef"}),
    )

    hot_water_tanks = document.tables.equipment.hot_water_tanks.rows
    hot_water_tank_type_ids = {option.id for option in document.single_select_options[HOT_WATER_TANK_TYPE_OPTION_KEY]}
    hot_water_tank_inside_outside_ids = {
        option.id for option in document.single_select_options[HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY]
    }
    validate_typed_option_refs(
        rows=[(tank.id, tank.tank_type) for tank in hot_water_tanks],
        valid_option_ids=hot_water_tank_type_ids,
        missing_message="Missing hot water tank type option for tank {row_id}: {value}",
    )
    validate_typed_option_refs(
        rows=[(tank.id, tank.inside_outside) for tank in hot_water_tanks],
        valid_option_ids=hot_water_tank_inside_outside_ids,
        missing_message="Missing hot water tank inside/outside option for tank {row_id}: {value}",
    )
    validate_generic_table(
        table_label="hot_water_tanks",
        row_label="hot water tank",
        table_path=("equipment", "hot_water_tanks"),
        field_defs=document.tables.equipment.hot_water_tanks.field_defs,
        rows=hot_water_tanks,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
        non_negative_field_keys=frozenset({"quantity", "size_l", "heat_loss_rate_w_k"}),
    )

    validate_generic_table(
        table_label="electric_heaters",
        row_label="electric heater",
        table_path=("equipment", "electric_heaters"),
        field_defs=document.tables.equipment.electric_heaters.field_defs,
        rows=document.tables.equipment.electric_heaters.rows,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
    )
    validate_typed_option_refs(
        rows=[(pump.id, _custom_option_ref(pump, "inside_outside")) for pump in pumps],
        valid_option_ids=pump_inside_outside_ids,
        missing_message="Missing pump inside/outside option for pump {row_id}: {value}",
    )

    appliances = document.tables.equipment.appliances.rows
    appliance_type_ids = {option.id for option in document.single_select_options[APPLIANCE_TYPE_OPTION_KEY]}
    appliance_energy_star_ids = {
        option.id for option in document.single_select_options[APPLIANCE_ENERGY_STAR_OPTION_KEY]
    }
    validate_typed_option_refs(
        rows=[(appliance.id, appliance.appliance_type) for appliance in appliances],
        valid_option_ids=appliance_type_ids,
        missing_message="Missing appliance type option for appliance {row_id}: {value}",
    )
    validate_typed_option_refs(
        rows=[(appliance.id, appliance.energy_star) for appliance in appliances],
        valid_option_ids=appliance_energy_star_ids,
        missing_message="Missing appliance EnergyStar option for appliance {row_id}: {value}",
    )
    validate_generic_table(
        table_label="appliances",
        row_label="appliance",
        table_path=("equipment", "appliances"),
        field_defs=document.tables.equipment.appliances.field_defs,
        rows=appliances,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
        non_negative_field_keys=frozenset({"quantity", "capacity_m3", "cef", "imef", "mef", "annual_energy_kwh"}),
    )

    ventilator_ids = {row.id for row in document.tables.equipment.ervs.rows}
    heat_pumps = document.tables.equipment.heat_pumps
    heat_pump_indoor_equip_ids = {row.id for row in heat_pumps.indoor_equip.rows}
    heat_pump_outdoor_equip_ids = {row.id for row in heat_pumps.outdoor_equip.rows}
    heat_pump_outdoor_unit_ids = {row.id for row in heat_pumps.outdoor_units.rows}
    heat_pump_option_ids_by_key = {
        key: {option.id for option in document.single_select_options[key]} for key in HEAT_PUMP_VISIBLE_OPTION_KEYS
    }
    for row in heat_pumps.outdoor_equip.rows:
        _validate_heat_pump_option(
            heat_pump_option_ids_by_key, HEAT_PUMP_MANUFACTURER_OPTION_KEY, row.manufacturer, row.id
        )
        _validate_heat_pump_option(
            heat_pump_option_ids_by_key, HEAT_PUMP_SYSTEM_FAMILY_OPTION_KEY, row.system_family, row.id
        )
        _validate_heat_pump_option(
            heat_pump_option_ids_by_key, HEAT_PUMP_REFRIGERANT_OPTION_KEY, row.refrigerant, row.id
        )
        if row.paired_indoor_equip_id is not None and row.paired_indoor_equip_id not in heat_pump_indoor_equip_ids:
            raise ValueError(f"Missing heat-pump indoor equip for outdoor equip {row.id}: {row.paired_indoor_equip_id}")
    for row in heat_pumps.indoor_equip.rows:
        _validate_heat_pump_option(
            heat_pump_option_ids_by_key, HEAT_PUMP_MANUFACTURER_OPTION_KEY, row.manufacturer, row.id
        )
        _validate_heat_pump_option(heat_pump_option_ids_by_key, HEAT_PUMP_MODEL_TYPE_OPTION_KEY, row.model_type, row.id)
        _validate_heat_pump_option(
            heat_pump_option_ids_by_key, HEAT_PUMP_INSTALL_TYPE_OPTION_KEY, row.install_type, row.id
        )
    for row in heat_pumps.outdoor_units.rows:
        if row.outdoor_equip_id not in heat_pump_outdoor_equip_ids:
            raise ValueError(f"Missing heat-pump outdoor equip for outdoor unit {row.id}: {row.outdoor_equip_id}")
    for row in heat_pumps.indoor_units.rows:
        if row.indoor_equip_id not in heat_pump_indoor_equip_ids:
            raise ValueError(f"Missing heat-pump indoor equip for indoor unit {row.id}: {row.indoor_equip_id}")
        if row.outdoor_unit_id is not None and row.outdoor_unit_id not in heat_pump_outdoor_unit_ids:
            raise ValueError(f"Missing heat-pump outdoor unit for indoor unit {row.id}: {row.outdoor_unit_id}")
        if row.linked_erv_unit_id is not None and row.linked_erv_unit_id not in ventilator_ids:
            raise ValueError(f"Missing linked ERV for heat-pump indoor unit {row.id}: {row.linked_erv_unit_id}")
        missing_room_ids = [room_id for room_id in row.served_room_ids if room_id not in room_ids]
        if missing_room_ids:
            raise ValueError(f"Missing served room for heat-pump indoor unit {row.id}: {missing_room_ids[0]}")

    from features.project_document.tables.contracts import read_table_envelope
    from features.project_document.tables.heat_pumps import HEAT_PUMP_LEAF_VALIDATION_SPECS

    for spec in HEAT_PUMP_LEAF_VALIDATION_SPECS:
        envelope = cast(Any, read_table_envelope(document, spec.contract.table_path))
        validate_generic_table(
            table_label=spec.table_label,
            row_label=spec.row_label,
            table_path=spec.contract.table_path,
            field_defs=envelope.field_defs,
            rows=envelope.rows,
            single_select_options=document.single_select_options,
            target_row_ids=target_row_ids,
        )

    thermal_bridges = document.tables.thermal_bridges.rows
    thermal_bridge_type_ids = {option.id for option in document.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY]}
    validate_typed_option_refs(
        rows=[(thermal_bridge.id, thermal_bridge.thermal_bridge_type) for thermal_bridge in thermal_bridges],
        valid_option_ids=thermal_bridge_type_ids,
        missing_message="Missing thermal bridge type option for thermal bridge {row_id}: {value}",
    )
    _validate_min_zero(
        thermal_bridges, "psi_value_w_mk", "Thermal bridge psi_value_w_mk must be zero or greater: {row_id}"
    )
    _validate_unit_fraction(
        thermal_bridges, "frsi_value", "Thermal bridge frsi_value must be between 0 and 1: {row_id}"
    )
    validate_generic_table(
        table_label="thermal_bridges",
        row_label="thermal bridge",
        table_path=("thermal_bridges",),
        field_defs=document.tables.thermal_bridges.field_defs,
        rows=thermal_bridges,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
    )

    ventilators = document.tables.equipment.ervs.rows
    inside_outside_ids = {option.id for option in document.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]}
    frost_protection_ids = {
        option.id for option in document.single_select_options[VENTILATOR_FROST_PROTECTION_OPTION_KEY]
    }
    validate_typed_option_refs(
        rows=[(ventilator.id, ventilator.inside_outside) for ventilator in ventilators],
        valid_option_ids=inside_outside_ids,
        missing_message="Missing ventilator inside/outside option for ventilator {row_id}: {value}",
    )
    validate_typed_option_refs(
        rows=[(ventilator.id, _custom_option_ref(ventilator, "frost_protection")) for ventilator in ventilators],
        valid_option_ids=frost_protection_ids,
        missing_message="Missing ventilator frost protection option for ventilator {row_id}: {value}",
    )
    validate_generic_table(
        table_label="ventilators",
        row_label="ventilator",
        table_path=("equipment", "ervs"),
        field_defs=document.tables.equipment.ervs.field_defs,
        rows=ventilators,
        single_select_options=document.single_select_options,
        target_row_ids=target_row_ids,
    )

    aperture_ids: set[str] = set()
    aperture_names: set[str] = set()
    project_glazing_ids = {glazing.id for glazing in document.tables.project_glazings}
    project_frame_ids = {frame.id for frame in document.tables.project_frames}
    validate_unique_ids("project glazing", [glazing.id for glazing in document.tables.project_glazings])
    validate_unique_ids("project frame", [frame.id for frame in document.tables.project_frames])
    for aperture in document.tables.apertures:
        if aperture.id in aperture_ids:
            raise ValueError(f"Duplicate aperture id: {aperture.id}")
        aperture_ids.add(aperture.id)

        normalized_aperture_name = normalize_display_name(aperture.name)
        if normalized_aperture_name in aperture_names:
            raise ValueError(f"Duplicate aperture name: {aperture.name}")
        aperture_names.add(normalized_aperture_name)
        for element in aperture.elements:
            if element.glazing_id is not None and element.glazing_id not in project_glazing_ids:
                raise ValueError(f"Unknown glazing_id {element.glazing_id!r} on aperture element {element.id}")
            for side, frame_id in element.frames.model_dump(mode="python").items():
                if frame_id is not None and frame_id not in project_frame_ids:
                    raise ValueError(f"Unknown frame_id {frame_id!r} on aperture element {element.id} side {side}")

    validate_envelope_references(document.tables.project_materials, document.tables.assemblies)
    _validate_document_formula_graph(document)

    return document


def _validate_heat_pump_option(
    option_ids_by_key: dict[str, set[str]],
    option_key: str,
    option_id: str | None,
    row_id: str,
) -> None:
    if option_id is None:
        return
    if option_id not in option_ids_by_key[option_key]:
        raise ValueError(f"Missing heat-pump option {option_key} for row {row_id}: {option_id}")


def _custom_option_ref(row: RowWithIdentity, field_key: str) -> str | None:
    value = row.custom_values.get(field_key)
    if value is None or isinstance(value, str):
        return value
    raise ValueError(f"Expected option id text for {field_key} on row {row.id}: {value!r}")


def _validate_min_zero(rows: Sequence[RowWithIdentity], field_key: str, message: str) -> None:
    """Reject a numeric ``custom_values`` field that is below zero."""
    for row in rows:
        value = row.custom_values.get(field_key)
        if isinstance(value, (int, float)) and value < 0:
            raise ValueError(message.format(row_id=row.id))


def _validate_unit_fraction(rows: Sequence[RowWithIdentity], field_key: str, message: str) -> None:
    """Reject a numeric ``custom_values`` field that falls outside ``0..1``."""
    for row in rows:
        value = row.custom_values.get(field_key)
        if isinstance(value, (int, float)) and not 0 <= value <= 1:
            raise ValueError(message.format(row_id=row.id))


def _validate_document_formula_graph(document: ProjectDocumentV1) -> None:
    from features.project_document.formula import (
        FormulaCycleError,
        FormulaMissingRefError,
        FormulaTargetFieldNotLinkedError,
        FormulaUnknownTargetTableError,
        validate_document_formula_graph,
    )

    try:
        validate_document_formula_graph(document)
    except FormulaCycleError as exc:
        raise ValueError(f"Formula cycle detected: {' -> '.join(exc.cycle_path)}") from exc
    except FormulaUnknownTargetTableError as exc:
        raise ValueError(f"Formula references unknown target table: {'.'.join(exc.table_path)}") from exc
    except FormulaTargetFieldNotLinkedError as exc:
        field_path = ".".join((*exc.table_path, exc.field_key))
        expected = ".".join(exc.expected_target)
        raise ValueError(f"Formula linked field {field_path} does not link to {expected}") from exc
    except FormulaMissingRefError as exc:
        raise ValueError(f"Formula references unknown linked field: {exc.display_name}") from exc
