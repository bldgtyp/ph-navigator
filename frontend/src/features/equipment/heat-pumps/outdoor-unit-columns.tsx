import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import type { AssetUrls } from "../../assets/types";
import { heatPumpDatasheetColumn, heatPumpPhotoColumn } from "./attachment-columns";
import {
  HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
  heatPumpAttachmentField,
  heatPumpLinkedRecordField,
  heatPumpTagField,
  heatPumpTextField,
} from "./field-defs";
import {
  HEAT_PUMP_LINK_TARGETS,
  incomingIndoorUnitIds,
  incomingIndoorUnitColumnDef,
  incomingIndoorUnitsFieldDef,
} from "./link-fields";
import { displayNameColumnDef, displayNameFieldDef } from "./name-column";
import { statusColumnDef, statusFieldDef } from "./status-column";
import { type HeatPumpOutdoorUnitRow, type HeatPumpsSlice } from "./types";
import { HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY } from "../types";

export const OUTDOOR_UNIT_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const OUTDOOR_UNIT_PHOTO_FIELD_KEY = "photo_asset_ids";

export function outdoorUnitFieldDefs(options: HeatPumpsSlice["single_select_options"]): FieldDef[] {
  return [
    heatPumpTagField(),
    displayNameFieldDef(),
    heatPumpLinkedRecordField({
      field_key: "outdoor_equip_id",
      display_name: "Equipment",
      required: true,
      target_table_path: HEAT_PUMP_LINK_TARGETS.outdoorEquip,
      max_links: 1,
    }),
    heatPumpAttachmentField(OUTDOOR_UNIT_DATASHEET_FIELD_KEY, "Datasheet"),
    heatPumpAttachmentField(OUTDOOR_UNIT_PHOTO_FIELD_KEY, "Site photos"),
    incomingIndoorUnitsFieldDef(),
    heatPumpTextField("notes", "Notes"),
    statusFieldDef(options[HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY] ?? []),
  ];
}

export const outdoorUnitDefaultHiddenColumns: string[] = ["notes"];

export function outdoorUnitColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
  onPhotoChange,
  indoorUnits = [],
  incomingIndoorUnitIdsByRowId = new Map(),
  onIndoorUnitClick,
  onIndoorUnitsLinkEdit,
}: {
  projectId: string;
  isEditor: boolean;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  onDatasheetChange: (row: HeatPumpOutdoorUnitRow, next: string[]) => void | Promise<void>;
  onPhotoChange: (row: HeatPumpOutdoorUnitRow, next: string[]) => void | Promise<void>;
  indoorUnits?: HeatPumpsSlice["indoor_units"];
  incomingIndoorUnitIdsByRowId?: ReadonlyMap<string, readonly string[]>;
  onIndoorUnitClick?: (rowId: string) => void;
  onIndoorUnitsLinkEdit?: (row: HeatPumpOutdoorUnitRow) => void;
}): DataTableColumnDef<HeatPumpOutdoorUnitRow>[] {
  return [
    displayNameColumnDef<HeatPumpOutdoorUnitRow>(),
    {
      id: "tag",
      fieldKey: "tag",
      schemaFieldKey: HEAT_PUMP_RECORD_ID_SCHEMA_FIELD_KEY,
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 140,
    },
    {
      id: "outdoor_equip_id",
      fieldKey: "outdoor_equip_id",
      header: "Equipment",
      accessor: (row) => [row.outdoor_equip_id],
      defaultWidth: 220,
    },
    heatPumpDatasheetColumn({
      projectId,
      isEditor,
      assetUrlById,
      fieldKey: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
      onChange: onDatasheetChange,
    }),
    heatPumpPhotoColumn({
      projectId,
      isEditor,
      assetUrlById,
      fieldKey: OUTDOOR_UNIT_PHOTO_FIELD_KEY,
      onChange: onPhotoChange,
    }),
    incomingIndoorUnitColumnDef<HeatPumpOutdoorUnitRow>({
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
    statusColumnDef<HeatPumpOutdoorUnitRow>(),
  ];
}
