import { fetchJson } from "../../../shared/api/client";
import { createTableSliceFeature } from "../../project_document/table-slice";
import type {
  HeatPumpIndoorEquipReplacePayload,
  HeatPumpIndoorEquipSlice,
  HeatPumpIndoorUnitsReplacePayload,
  HeatPumpIndoorUnitsSlice,
  HeatPumpOutdoorEquipReplacePayload,
  HeatPumpOutdoorEquipSlice,
  HeatPumpOutdoorUnitsReplacePayload,
  HeatPumpOutdoorUnitsSlice,
  PhiusExportResponse,
} from "./types";

export const heatPumpOutdoorEquipSliceFeature = createTableSliceFeature<
  HeatPumpOutdoorEquipSlice,
  HeatPumpOutdoorEquipReplacePayload
>({
  tableName: "heat_pumps_outdoor_equip",
  missingVersionMessage:
    "Cannot update Heat Pump outdoor equipment without an active project version.",
});

export const heatPumpIndoorEquipSliceFeature = createTableSliceFeature<
  HeatPumpIndoorEquipSlice,
  HeatPumpIndoorEquipReplacePayload
>({
  tableName: "heat_pumps_indoor_equip",
  missingVersionMessage:
    "Cannot update Heat Pump indoor equipment without an active project version.",
});

export const heatPumpOutdoorUnitsSliceFeature = createTableSliceFeature<
  HeatPumpOutdoorUnitsSlice,
  HeatPumpOutdoorUnitsReplacePayload
>({
  tableName: "heat_pumps_outdoor_units",
  missingVersionMessage: "Cannot update Heat Pump outdoor units without an active project version.",
});

export const heatPumpIndoorUnitsSliceFeature = createTableSliceFeature<
  HeatPumpIndoorUnitsSlice,
  HeatPumpIndoorUnitsReplacePayload
>({
  tableName: "heat_pumps_indoor_units",
  missingVersionMessage: "Cannot update Heat Pump indoor units without an active project version.",
});

export async function requestPhiusExport(projectId: string): Promise<PhiusExportResponse> {
  return fetchJson<PhiusExportResponse>(
    `/api/v1/projects/${projectId}/equipment/heat-pumps/export-phius`,
    { method: "POST" },
  );
}
