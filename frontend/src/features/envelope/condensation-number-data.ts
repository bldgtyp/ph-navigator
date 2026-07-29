import { buildLayerLabelMap, orderedCondensationMonths } from "./condensation-chart-data";
import type { AssemblyCondensationResponse, CondensationMonth } from "./condensation-types";
import { isMembraneLayer } from "./membranes";
import { materialById } from "./lib";
import type { Assembly, ProjectMaterial } from "./types";

export type CondensationLayerRow = {
  id: string;
  layer: string;
  material: string;
  thicknessMm: number;
  conductivityWmK: number | null;
  resistanceM2KW: number | null;
  vaporMu: number | null;
  vaporSdM: number;
  temperatureC: number;
  saturationPressurePa: number;
  vaporPressurePa: number;
  relativeHumidity: number;
};

export type CondensationMonthlyRow = {
  id: string;
  month: number;
  monthName: string;
  condensationRateKgM2S: number;
  moistureChangeGM2: number;
  accumulatedMoistureGM2: number;
  interfaceCount: number;
  surfaceState: "Clear" | "Review";
  moldState: "Clear" | "Review";
  frsiState: "Clear" | "Review";
  interstitialState: "Clear" | "Review";
};

export type CondensationInterfaceRow = {
  id: string;
  month: number;
  monthName: string;
  interface: string;
  condensationRateKgM2S: number;
  moistureChangeGM2: number;
  accumulatedMoistureGM2: number;
};

export function buildCondensationLayerRows(
  assembly: Assembly,
  materials: ProjectMaterial[],
  result: AssemblyCondensationResponse,
  month: CondensationMonth,
): CondensationLayerRow[] {
  const materialsById = materialById(materials);
  const pathSegmentIds = new Set(result.worst_path_id?.split("|") ?? []);
  const orderedLayers = [...assembly.layers].sort((left, right) => left.order - right.order);
  if (assembly.orientation === "last_layer_outside") orderedLayers.reverse();

  return orderedLayers.flatMap((layer) => {
    const segment =
      layer.segments.find((candidate) => pathSegmentIds.has(candidate.id)) ?? layer.segments[0];
    const material = segment?.project_material_id
      ? materialsById.get(segment.project_material_id)
      : null;
    const node = month.nodes.find((candidate) => candidate.outside_layer_id === layer.id);
    if (!segment || !material || !node) return [];
    const previousNode = month.nodes.find(
      (candidate) => candidate.node_index === node.node_index - 1,
    );
    const membrane = isMembraneLayer(layer, materialsById);
    const thicknessM = layer.thickness_mm / 1000;
    return [
      {
        id: layer.id,
        layer: `Layer ${layer.order + 1}`,
        material: material.name,
        thicknessMm: layer.thickness_mm,
        conductivityWmK: material.conductivity_w_mk,
        resistanceM2KW:
          membrane || material.conductivity_w_mk === null
            ? null
            : thicknessM / material.conductivity_w_mk,
        vaporMu: membrane ? null : material.vapor_diffusion_resistance_mu,
        vaporSdM: node.cumulative_sd_m - (previousNode?.cumulative_sd_m ?? 0),
        temperatureC: node.temperature_c,
        saturationPressurePa: node.saturation_pressure_pa,
        vaporPressurePa: node.vapor_pressure_pa,
        relativeHumidity: node.relative_humidity,
      },
    ];
  });
}

export function buildCondensationMonthlyRows(
  result: AssemblyCondensationResponse,
): CondensationMonthlyRow[] {
  return orderedCondensationMonths(result).map((month) => ({
    id: `month-${month.month}`,
    month: month.month,
    monthName: month.month_name,
    condensationRateKgM2S: month.interfaces.reduce(
      (total, item) => total + item.condensation_rate_kg_m2_s,
      0,
    ),
    moistureChangeGM2: month.moisture_change_g_m2,
    accumulatedMoistureGM2: month.accumulated_moisture_g_m2,
    interfaceCount: month.condensing_interface_count,
    surfaceState: state(month.surface_condensation_clear),
    moldState: state(month.mold_growth_clear),
    frsiState: state(month.frsi_clear),
    interstitialState: state(month.accumulated_moisture_g_m2 <= result.settings.ma_limit_g_m2),
  }));
}

export function buildCondensationInterfaceRows(
  assembly: Assembly,
  materials: ProjectMaterial[],
  result: AssemblyCondensationResponse,
): CondensationInterfaceRow[] {
  const labels = buildLayerLabelMap(assembly, materials, result.worst_path_id);
  return orderedCondensationMonths(result).flatMap((month) =>
    month.interfaces.map((item) => ({
      id: `${month.month}-${item.node_index}`,
      month: month.month,
      monthName: month.month_name,
      interface: `${labels.get(item.outside_layer_id) ?? item.outside_layer_id} / ${
        labels.get(item.inside_layer_id) ?? item.inside_layer_id
      }`,
      condensationRateKgM2S: item.condensation_rate_kg_m2_s,
      moistureChangeGM2: item.moisture_change_g_m2,
      accumulatedMoistureGM2: item.accumulated_moisture_g_m2,
    })),
  );
}

function state(clear: boolean): "Clear" | "Review" {
  return clear ? "Clear" : "Review";
}
