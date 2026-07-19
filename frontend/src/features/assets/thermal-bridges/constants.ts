import {
  ALL_FIELD_LOCKS,
  DEFAULT_BUILT_IN_LOCKS,
  RECORD_ID_FIELD_KEY,
  type DataTableColumnDef,
  type FieldDef,
  type TableFieldDef,
  type TableFieldRenderOverlay,
} from "../../../shared/ui/data-table";
import {
  STATUS_DEFAULT_OPTION_ID,
  STATUS_DISPLAY_NAME,
  STATUS_FIELD_KEY,
  THERMAL_BRIDGES_STATUS_OPTION_KEY,
  THERMAL_BRIDGES_TABLE_NAME,
  THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY,
  THERMAL_BRIDGE_PHOTO_FIELD_KEY,
  THERMAL_BRIDGE_TYPE_KEY,
  THERMAL_BRIDGE_TYPE_OPTION_KEY,
  type ThermalBridgesSlice,
} from "../../equipment/types";

export const THERMAL_BRIDGE_ID_PREFIX = "tb";

export const PDF_REPORT_ATTACHMENT_CONFIG = {
  assetKind: "datasheet" as const,
  allowedTypes: ["application/pdf"],
  maxCount: 5,
  maxFileSizeMb: 25,
};

export const THERMAL_BRIDGE_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef(RECORD_ID_FIELD_KEY, "Tag", "short_text"),
  builtInFieldDef("name", "Display Name", "short_text"),
  builtInFieldDef("sheet_name", "Sheet Name", "short_text"),
  builtInFieldDef("drawing_number", "Drawing Number", "short_text"),
  builtInFieldDef("quantity", "Quantity", "number", 1),
  {
    ...builtInFieldDef("psi_value_w_mk", "Psi-Value", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "conductivity",
        si_unit: "w_m_k",
        ip_unit: "btu_h_ft_f",
        precision_si: 3,
        precision_ip: 4,
      },
    },
  },
  builtInFieldDef("frsi_value", "fRSI Value", "number"),
  builtInFieldDef(THERMAL_BRIDGE_TYPE_KEY, "Type", "single_select"),
  builtInFieldDef(THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY, "PDF Report", "long_text"),
  builtInFieldDef(THERMAL_BRIDGE_PHOTO_FIELD_KEY, "Site photos", "long_text"),
  builtInFieldDef("notes", "Notes", "long_text"),
  {
    ...builtInFieldDef(STATUS_FIELD_KEY, STATUS_DISPLAY_NAME, "single_select"),
    default: STATUS_DEFAULT_OPTION_ID,
    config: { default_option_id: STATUS_DEFAULT_OPTION_ID },
  },
];

export const THERMAL_BRIDGE_CUSTOM_VALUE_FIELD_KEYS = new Set([
  RECORD_ID_FIELD_KEY,
  "name",
  "sheet_name",
  "drawing_number",
  "quantity",
  "psi_value_w_mk",
  "frsi_value",
  STATUS_FIELD_KEY,
]);

export const THERMAL_BRIDGE_CONFLICT_MESSAGES = {
  activeRowConflict:
    "The Thermal Bridges draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete thermal bridge.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export function thermalBridgesFieldOverlay(
  slice: ThermalBridgesSlice,
): Record<string, TableFieldRenderOverlay> {
  return {
    [RECORD_ID_FIELD_KEY]: {
      locked: ["display_name", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    sheet_name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    drawing_number: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    psi_value_w_mk: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    frsi_value: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [THERMAL_BRIDGE_TYPE_KEY]: {
      options: slice.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    [THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
    [THERMAL_BRIDGE_PHOTO_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [STATUS_FIELD_KEY]: {
      options: slice.single_select_options[THERMAL_BRIDGES_STATUS_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
  };
}

export function thermalBridgesTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id: fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

function builtInFieldDef(
  field_key: string,
  display_name: string,
  field_type: TableFieldDef["field_type"],
  defaultValue: TableFieldDef["default"] = null,
): TableFieldDef {
  return {
    field_key,
    display_name,
    field_type,
    config: {},
    description: null,
    default: defaultValue,
    origin: "built_in",
    created_at: "2026-05-26T00:00:00Z",
    created_by: null,
  };
}

export function thermalBridgeOptionListKeyForFieldKey(fieldKey: string): string | null {
  if (fieldKey === THERMAL_BRIDGE_TYPE_KEY) return THERMAL_BRIDGE_TYPE_OPTION_KEY;
  if (fieldKey.startsWith("cf_")) return `${THERMAL_BRIDGES_TABLE_NAME}.${fieldKey}`;
  return null;
}
