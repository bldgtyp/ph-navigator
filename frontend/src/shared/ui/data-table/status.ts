// Built-in `status` single-select contract shared by DataTable consumers.
// Mirrors backend/features/project_document/tables/_status_field.py.
export const STATUS_FIELD_KEY = "status";
export const STATUS_DISPLAY_NAME = "Specification Status";

export const STATUS_OPTION_COMPLETE = "opt_status_complete";
export const STATUS_OPTION_NEEDED = "opt_status_needed";
export const STATUS_OPTION_QUESTION = "opt_status_question";
export const STATUS_OPTION_NA = "opt_status_na";
export const STATUS_DEFAULT_OPTION_ID = STATUS_OPTION_NEEDED;

// Namespaced status option-list keys, one per in-scope table. Match the
// backend `status_option_key(<table_label>)` strings exactly.
export const PUMPS_STATUS_OPTION_KEY = "pumps.status";
export const FANS_STATUS_OPTION_KEY = "fans.status";
export const HOT_WATER_HEATERS_STATUS_OPTION_KEY = "hot_water_heaters.status";
export const HOT_WATER_TANKS_STATUS_OPTION_KEY = "hot_water_tanks.status";
export const ELECTRIC_HEATERS_STATUS_OPTION_KEY = "electric_heaters.status";
export const APPLIANCES_STATUS_OPTION_KEY = "appliances.status";
export const THERMAL_BRIDGES_STATUS_OPTION_KEY = "thermal_bridges.status";
export const HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY = "heat_pumps_outdoor_equip.status";
export const HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY = "heat_pumps_indoor_equip.status";
export const HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY = "heat_pumps_outdoor_units.status";
export const HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY = "heat_pumps_indoor_units.status";
