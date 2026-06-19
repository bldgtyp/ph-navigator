import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import {
  HEAT_PUMP_LINK_TARGETS,
  incomingIndoorUnitIds,
  incomingIndoorUnitColumnDef,
  incomingIndoorUnitsFieldDef,
} from "./link-fields";
import { type HeatPumpOutdoorUnitRow, type HeatPumpsSlice } from "./types";

export const OUTDOOR_UNIT_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export function outdoorUnitFieldDefs(): FieldDef[] {
  return [
    { field_key: "tag", field_type: "text", display_name: "Tag", required: true },
    {
      field_key: "outdoor_equip_id",
      field_type: "linked_record",
      display_name: "Equipment",
      required: true,
      linked_record_config: {
        target_table_path: [...HEAT_PUMP_LINK_TARGETS.outdoorEquip],
        max_links: 1,
      },
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
  onIndoorUnitClick,
  onIndoorUnitsLinkEdit,
}: {
  projectId: string;
  isEditor: boolean;
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpOutdoorUnitRow, next: string[]) => void | Promise<void>;
  indoorUnits?: HeatPumpsSlice["indoor_units"];
  incomingIndoorUnitIdsByRowId?: ReadonlyMap<string, readonly string[]>;
  onIndoorUnitClick?: (rowId: string) => void;
  onIndoorUnitsLinkEdit?: (row: HeatPumpOutdoorUnitRow) => void;
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
      accessor: (row) => [row.outdoor_equip_id],
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
