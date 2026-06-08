import { createTableSliceFeature } from "../project_document/table-slice";
import {
  APPLIANCES_TABLE_NAME,
  ELECTRIC_HEATERS_TABLE_NAME,
  FANS_TABLE_NAME,
  HOT_WATER_HEATERS_TABLE_NAME,
  PUMPS_TABLE_NAME,
  ROOMS_TABLE_NAME,
  VENTILATORS_TABLE_NAME,
  type AppliancesReplacePayload,
  type AppliancesSlice,
  type ElectricHeatersReplacePayload,
  type ElectricHeatersSlice,
  type FansReplacePayload,
  type FansSlice,
  type HotWaterHeatersReplacePayload,
  type HotWaterHeatersSlice,
  type PumpsReplacePayload,
  type PumpsSlice,
  type RoomsReplacePayload,
  type RoomsSlice,
  THERMAL_BRIDGES_TABLE_NAME,
  type ThermalBridgesReplacePayload,
  type ThermalBridgesSlice,
  type VentilatorsReplacePayload,
  type VentilatorsSlice,
} from "./types";

export const appliancesSliceFeature = createTableSliceFeature<
  AppliancesSlice,
  AppliancesReplacePayload
>({
  tableName: APPLIANCES_TABLE_NAME,
  missingVersionMessage: "Cannot update Appliances without an active project version.",
});

export const fetchAppliancesSlice = appliancesSliceFeature.fetchSlice;
export const replaceAppliancesSlice = appliancesSliceFeature.replaceSlice;

export const roomsSliceFeature = createTableSliceFeature<RoomsSlice, RoomsReplacePayload>({
  tableName: ROOMS_TABLE_NAME,
  missingVersionMessage: "Cannot update Rooms without an active project version.",
});

export const fetchRoomsSlice = roomsSliceFeature.fetchSlice;
export const replaceRoomsSlice = roomsSliceFeature.replaceSlice;

export const pumpsSliceFeature = createTableSliceFeature<PumpsSlice, PumpsReplacePayload>({
  tableName: PUMPS_TABLE_NAME,
  missingVersionMessage: "Cannot update Pumps without an active project version.",
});

export const fetchPumpsSlice = pumpsSliceFeature.fetchSlice;
export const replacePumpsSlice = pumpsSliceFeature.replaceSlice;

export const ventilatorsSliceFeature = createTableSliceFeature<
  VentilatorsSlice,
  VentilatorsReplacePayload
>({
  tableName: VENTILATORS_TABLE_NAME,
  missingVersionMessage: "Cannot update Ventilators without an active project version.",
});

export const fetchVentilatorsSlice = ventilatorsSliceFeature.fetchSlice;
export const replaceVentilatorsSlice = ventilatorsSliceFeature.replaceSlice;

export const thermalBridgesSliceFeature = createTableSliceFeature<
  ThermalBridgesSlice,
  ThermalBridgesReplacePayload
>({
  tableName: THERMAL_BRIDGES_TABLE_NAME,
  missingVersionMessage: "Cannot update Thermal Bridges without an active project version.",
});

export const fetchThermalBridgesSlice = thermalBridgesSliceFeature.fetchSlice;
export const replaceThermalBridgesSlice = thermalBridgesSliceFeature.replaceSlice;

export const fansSliceFeature = createTableSliceFeature<FansSlice, FansReplacePayload>({
  tableName: FANS_TABLE_NAME,
  missingVersionMessage: "Cannot update Fans without an active project version.",
});

export const fetchFansSlice = fansSliceFeature.fetchSlice;
export const replaceFansSlice = fansSliceFeature.replaceSlice;

export const hotWaterHeatersSliceFeature = createTableSliceFeature<
  HotWaterHeatersSlice,
  HotWaterHeatersReplacePayload
>({
  tableName: HOT_WATER_HEATERS_TABLE_NAME,
  missingVersionMessage: "Cannot update Hot Water Heaters without an active project version.",
});

export const fetchHotWaterHeatersSlice = hotWaterHeatersSliceFeature.fetchSlice;
export const replaceHotWaterHeatersSlice = hotWaterHeatersSliceFeature.replaceSlice;

export const electricHeatersSliceFeature = createTableSliceFeature<
  ElectricHeatersSlice,
  ElectricHeatersReplacePayload
>({
  tableName: ELECTRIC_HEATERS_TABLE_NAME,
  missingVersionMessage: "Cannot update Electric Heaters without an active project version.",
});

export const fetchElectricHeatersSlice = electricHeatersSliceFeature.fetchSlice;
export const replaceElectricHeatersSlice = electricHeatersSliceFeature.replaceSlice;
