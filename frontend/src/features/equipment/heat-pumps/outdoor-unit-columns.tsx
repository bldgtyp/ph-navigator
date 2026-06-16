import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { outdoorEquipLabel } from "./lib";
import {
  incomingIndoorUnitIds,
  incomingIndoorUnitColumnDef,
  incomingIndoorUnitsFieldDef,
} from "./link-fields";
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
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  // The equipment-picker's FieldDef.options drives both the popover list AND
  // the cell renderer's label lookup, so we feed it a synthetic list keyed
  // by row id with the rendered equip label (tag — manufacturer model).
  const outdoorEquipOptions: FieldOption[] = outdoorEquip.map((row, index) => ({
    id: row.id,
    label: outdoorEquipLabel(row, manufacturer),
    color: "slategray",
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
      field_key: OUTDOOR_UNIT_DATASHEET_FIELD_KEY,
      field_type: "attachment",
      display_name: "Datasheet",
    },
    incomingIndoorUnitsFieldDef(),
    { field_key: "notes", field_type: "text", display_name: "Notes" },
  ];
}

export const outdoorUnitDefaultHiddenColumns: string[] = ["notes"];

export function outdoorUnitColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
  indoorUnits = [],
  incomingIndoorUnitIdsByRowId = new Map(),
}: {
  projectId: string;
  isEditor: boolean;
  // Equipment labels are resolved from FieldDef.options inside the DataTable,
  // so this builder doesn't need `outdoorEquip` directly.
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpOutdoorUnitRow, next: string[]) => void | Promise<void>;
  indoorUnits?: HeatPumpsSlice["indoor_units"];
  incomingIndoorUnitIdsByRowId?: ReadonlyMap<string, readonly string[]>;
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
    incomingIndoorUnitColumnDef<HeatPumpOutdoorUnitRow>({
      indoorUnits,
      getIncomingIds: (row) => incomingIndoorUnitIds(incomingIndoorUnitIdsByRowId, row.id),
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
