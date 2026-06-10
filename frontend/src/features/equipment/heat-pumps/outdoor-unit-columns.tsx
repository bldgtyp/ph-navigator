import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { outdoorEquipLabel } from "./lib";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "./types";
import type { FieldOption } from "../../../shared/ui/data-table";

export const OUTDOOR_UNIT_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export function outdoorUnitFieldDefs({
  options,
  outdoorEquip,
}: {
  options: HeatPumpsSlice["single_select_options"];
  outdoorEquip: readonly HeatPumpOutdoorEquipRow[];
}): FieldDef[] {
  const buildingZone = options[HEAT_PUMP_OPTION_KEYS.buildingZone] ?? [];
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  // The equipment-picker's FieldDef.options drives both the popover list AND
  // the cell renderer's label lookup, so we feed it a synthetic list keyed
  // by row id with the rendered equip label (tag — manufacturer model).
  const outdoorEquipOptions: FieldOption[] = outdoorEquip.map((row, index) => ({
    id: row.id,
    label: outdoorEquipLabel(row, manufacturer),
    color: "#94a3b8",
    order: index,
  }));
  return [
    { field_key: "tag", field_type: "text", display_name: "Tag", required: true },
    {
      field_key: "outdoor_equip_id",
      field_type: "single_select",
      display_name: "Equipment",
      options: outdoorEquipOptions,
    },
    {
      field_key: "building_zone",
      field_type: "single_select",
      display_name: "Zone",
      options: buildingZone,
    },
    {
      field_key: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
      field_type: "attachment",
      display_name: "Datasheet",
    },
    { field_key: "notes", field_type: "text", display_name: "Notes" },
  ];
}

export const outdoorUnitDefaultHiddenColumns: string[] = ["notes"];

export function outdoorUnitColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  // Labels for single-select cells (equipment + zone) are resolved from
  // FieldDef.options inside the DataTable, so this builder doesn't need
  // `options` or `outdoorEquip` — both flow through `outdoorUnitFieldDefs`.
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpOutdoorUnitRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpOutdoorUnitRow>[] {
  return [
    {
      id: "tag",
      fieldKey: "tag",
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 140,
    },
    {
      id: "outdoor_equip_id",
      fieldKey: "outdoor_equip_id",
      header: "Equipment",
      accessor: (row) => row.outdoor_equip_id,
      defaultWidth: 220,
    },
    {
      id: "building_zone",
      fieldKey: "building_zone",
      header: "Zone",
      // Accessor returns the raw option id — DataTable's
      // `formatDisplayCellValue` resolves the label from FieldDef.options.
      accessor: (row) => row.building_zone,
      defaultWidth: 140,
    },
    {
      id: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
      fieldKey: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
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
    {
      id: "notes",
      fieldKey: "notes",
      header: "Notes",
      accessor: (row) => row.notes,
      defaultWidth: 260,
    },
  ];
}
