import type { DataTableColumnDef, FieldDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, sameAttachmentAssetIds } from "../../assets/lib";
import { indoorEquipLabel, outdoorUnitLabel } from "./lib";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpIndoorEquipRow,
  type HeatPumpIndoorUnitRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "./types";
import type { FieldOption } from "../../../shared/ui/data-table";

export const INDOOR_UNIT_DATASHEET_FIELD_KEY = "datasheet_asset_ids";

export function indoorUnitFieldDefs({
  options,
  indoorEquip,
  outdoorUnits,
}: {
  options: HeatPumpsSlice["single_select_options"];
  indoorEquip: readonly HeatPumpIndoorEquipRow[];
  outdoorUnits: readonly HeatPumpOutdoorUnitRow[];
}): FieldDef[] {
  const floorLevel = options[HEAT_PUMP_OPTION_KEYS.floorLevel] ?? [];
  const manufacturer = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  // Same pattern as outdoor-unit-columns: synthetic FieldDef.options keyed
  // by row id so the cell renderer can resolve the label without us
  // teaching it about heat-pump rows.
  const indoorEquipOptions: FieldOption[] = indoorEquip.map((row, index) => ({
    id: row.id,
    label: indoorEquipLabel(row, manufacturer),
    color: "slategray",
    order: index,
  }));
  const outdoorUnitOptions: FieldOption[] = outdoorUnits.map((row, index) => ({
    id: row.id,
    label: outdoorUnitLabel(row),
    color: "slategray",
    order: index,
  }));
  return [
    { field_key: "tag", field_type: "text", display_name: "Tag", required: true },
    {
      field_key: "indoor_equip_id",
      field_type: "single_select",
      display_name: "Equipment",
      options: indoorEquipOptions,
    },
    {
      field_key: "outdoor_unit_id",
      field_type: "single_select",
      display_name: "Outdoor unit",
      options: outdoorUnitOptions,
    },
    {
      field_key: "floor_level",
      field_type: "single_select",
      display_name: "Floor",
      options: floorLevel,
    },
    { field_key: "area_served", field_type: "text", display_name: "Area served" },
    {
      field_key: "linked_erv_unit_id",
      field_type: "single_select",
      display_name: "Linked ERV",
      // The linked-ERV options aren't owned by the heat-pumps slice; the
      // modal still drives that picker from the ventilators query.
      options: [],
    },
    {
      field_key: INDOOR_UNIT_DATASHEET_FIELD_KEY,
      field_type: "attachment",
      display_name: "Datasheet",
    },
    { field_key: "notes", field_type: "text", display_name: "Notes" },
  ];
}

export const indoorUnitDefaultHiddenColumns: string[] = ["linked_erv_unit_id", "notes"];

export function indoorUnitColumnDefs({
  projectId,
  isEditor,
  assetUrlById,
  onDatasheetChange,
}: {
  projectId: string;
  isEditor: boolean;
  // Labels for single-select cells (equipment / outdoor unit / floor) are
  // resolved from FieldDef.options inside the DataTable, so this builder
  // doesn't need `options`, `indoorEquip`, or `outdoorUnits` — they all
  // flow through `indoorUnitFieldDefs`.
  assetUrlById: Map<string, unknown>;
  onDatasheetChange: (row: HeatPumpIndoorUnitRow, next: string[]) => void | Promise<void>;
}): DataTableColumnDef<HeatPumpIndoorUnitRow>[] {
  return [
    {
      id: "tag",
      fieldKey: "tag",
      header: "Tag",
      accessor: (row) => row.tag,
      defaultWidth: 140,
    },
    {
      id: "indoor_equip_id",
      fieldKey: "indoor_equip_id",
      header: "Equipment",
      accessor: (row) => row.indoor_equip_id,
      defaultWidth: 220,
    },
    {
      id: "outdoor_unit_id",
      fieldKey: "outdoor_unit_id",
      header: "Outdoor unit",
      accessor: (row) => row.outdoor_unit_id,
      defaultWidth: 160,
    },
    {
      id: "floor_level",
      fieldKey: "floor_level",
      header: "Floor",
      // Accessor returns the raw option id — DataTable's
      // `formatDisplayCellValue` resolves the label from FieldDef.options.
      accessor: (row) => row.floor_level,
      defaultWidth: 120,
    },
    {
      id: "area_served",
      fieldKey: "area_served",
      header: "Area served",
      accessor: (row) => row.area_served,
      defaultWidth: 200,
    },
    {
      id: "linked_erv_unit_id",
      fieldKey: "linked_erv_unit_id",
      header: "Linked ERV",
      accessor: (row) => row.linked_erv_unit_id ?? "",
      defaultWidth: 160,
    },
    {
      id: INDOOR_UNIT_DATASHEET_FIELD_KEY,
      fieldKey: INDOOR_UNIT_DATASHEET_FIELD_KEY,
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
