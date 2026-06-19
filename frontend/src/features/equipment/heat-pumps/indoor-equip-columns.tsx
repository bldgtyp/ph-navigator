import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import {
  HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
  heatPumpAttachmentField,
  heatPumpNumberField,
  heatPumpPowerField,
  heatPumpSelectField,
  heatPumpTagField,
  heatPumpTextField,
} from "./field-defs";
import {
  incomingIndoorUnitIds,
  incomingIndoorUnitColumnDef,
  incomingIndoorUnitsFieldDef,
} from "./link-fields";
import { HEAT_PUMP_OPTION_KEYS, type HeatPumpIndoorEquipRow, type HeatPumpsSlice } from "./types";

export const INDOOR_EQUIP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export function indoorEquipFieldDefs(options: HeatPumpsSlice["single_select_options"]): FieldDef[] {
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const modelType = options[HEAT_PUMP_OPTION_KEYS.modelType] ?? [];
  const installType = options[HEAT_PUMP_OPTION_KEYS.installType] ?? [];
  return [
    heatPumpTagField(),
    heatPumpTextField("model_number", "Model number"),
    heatPumpSelectField("manufacturer", "Manufacturer", manufacturer),
    heatPumpSelectField("model_type", "Model type", modelType),
    heatPumpSelectField("install_type", "Install type", installType),
    heatPumpNumberField("nominal_tons", "Nominal tons"),
    heatPumpNumberField("fan_speed_cfm", "Fan speed (CFM)"),
    heatPumpPowerField("cooling_btuh", "Cooling Capacity"),
    heatPumpPowerField("heating_btuh_47f", "Heating Capacity"),
    heatPumpNumberField("heating_btuh_17f", "Heating Btu/h @ 17F"),
    heatPumpNumberField("heating_cop", "Heating COP"),
    heatPumpNumberField("seer", "SEER"),
    heatPumpNumberField("eer", "EER"),
    heatPumpNumberField("hspf", "HSPF"),
    heatPumpAttachmentField(INDOOR_EQUIP_DATASHEET_FIELD_KEY, "Datasheet"),
    incomingIndoorUnitsFieldDef(),
    heatPumpTextField("notes", "Notes"),
  ];
}

// Default-hidden columns per PRD §4.3 / phase-02 acceptance #2.
export const indoorEquipDefaultHiddenColumns = [
  "fan_speed_cfm",
  "heating_btuh_17f",
  "heating_cop",
  "seer",
  "eer",
  "hspf",
  "notes",
];

export function indoorEquipColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
  indoorUnits = [],
  incomingIndoorUnitIdsByRowId = new Map(),
  onIndoorUnitClick,
  onIndoorUnitsLinkEdit,
}: {
  projectId: string;
  isEditor: boolean;
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpIndoorEquipRow, next: string[]) => void | Promise<void>;
  indoorUnits?: HeatPumpsSlice["indoor_units"];
  incomingIndoorUnitIdsByRowId?: ReadonlyMap<string, readonly string[]>;
  onIndoorUnitClick?: (rowId: string) => void;
  onIndoorUnitsLinkEdit?: (row: HeatPumpIndoorEquipRow) => void;
}): DataTableColumnDef<HeatPumpIndoorEquipRow>[] {
  const number = (fieldKey: keyof HeatPumpIndoorEquipRow, header: string, width = 110) => ({
    id: fieldKey,
    fieldKey,
    header,
    accessor: (row: HeatPumpIndoorEquipRow) => row[fieldKey],
    defaultWidth: width,
    className: "numeric-cell",
  });
  return [
    {
      id: "tag",
      fieldKey: "tag",
      schemaFieldKey: HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 120,
    },
    {
      id: "model_number",
      fieldKey: "model_number",
      header: "Model number",
      accessor: (row) => row.model_number,
      defaultWidth: 160,
    },
    {
      id: "manufacturer",
      fieldKey: "manufacturer",
      header: "Manufacturer",
      // Accessor returns the raw option id — DataTable's
      // `formatDisplayCellValue` resolves the label from FieldDef.options.
      accessor: (row) => row.manufacturer,
      defaultWidth: 150,
    },
    {
      id: "model_type",
      fieldKey: "model_type",
      header: "Model type",
      accessor: (row) => row.model_type,
      defaultWidth: 130,
    },
    {
      id: "install_type",
      fieldKey: "install_type",
      header: "Install type",
      accessor: (row) => row.install_type,
      defaultWidth: 160,
    },
    number("nominal_tons", "Nominal tons"),
    number("fan_speed_cfm", "Fan CFM"),
    number("cooling_btuh", "Cooling Capacity", 160),
    number("heating_btuh_47f", "Heating Capacity", 160),
    number("heating_btuh_17f", "Heat 17F Btu/h", 140),
    number("heating_cop", "Heat COP"),
    number("seer", "SEER"),
    number("eer", "EER"),
    number("hspf", "HSPF"),
    {
      id: INDOOR_EQUIP_DATASHEET_FIELD_KEY,
      fieldKey: INDOOR_EQUIP_DATASHEET_FIELD_KEY,
      header: "Datasheet",
      accessor: (row) => row.datasheet_asset_ids.join(","),
      render: (row) => (
        <AttachmentCell
          projectId={projectId}
          value={row.datasheet_asset_ids}
          config={DATASHEET_ATTACHMENT_CONFIG}
          readOnly={!isEditor}
          assetUrlById={assetUrlById as never}
          onChange={(next) => {
            if (sameAttachmentAssetIds(row.datasheet_asset_ids, next)) return;
            return onDatasheetChange(row, next);
          }}
        />
      ),
      measureText: (row) => `${row.datasheet_asset_ids.length} attachments`,
      defaultWidth: 260,
    },
    incomingIndoorUnitColumnDef<HeatPumpIndoorEquipRow>({
      indoorUnits,
      getIncomingIds: (row) => incomingIndoorUnitIds(incomingIndoorUnitIdsByRowId, row.id),
      onPillClick: onIndoorUnitClick,
      onActivateEdit: isEditor ? onIndoorUnitsLinkEdit : undefined,
    }),
    {
      id: "notes",
      fieldKey: "notes",
      header: "Notes",
      accessor: (row) => row.notes,
      defaultWidth: 260,
    },
  ];
}
