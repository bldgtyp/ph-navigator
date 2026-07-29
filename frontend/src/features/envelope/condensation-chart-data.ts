import type {
  AssemblyCondensationResponse,
  CondensationMonth,
  CondensationNodeProfile,
} from "./condensation-types";
import { materialById } from "./lib";
import type { Assembly, ProjectMaterial } from "./types";

export type ProfileAxis = "sd" | "thickness";

export type MoistureChartRow = {
  month: number;
  monthName: string;
  monthLabel: string;
  accumulatedMoisture: number;
  moistureChange: number;
};

export type PressureProfileRow = {
  nodeIndex: number;
  position: number;
  saturationPressure: number;
  vaporPressure: number;
  relativeHumidity: number;
  interfaceLabel: string | null;
  isCondensing: boolean;
};

export type TemperatureProfileRow = {
  nodeIndex: number;
  position: number;
  temperature: number;
};

export function buildMoistureChartRows(result: AssemblyCondensationResponse): MoistureChartRow[] {
  return orderedCondensationMonths(result).map((month) => ({
    month: month.month,
    monthName: month.month_name,
    monthLabel: month.month_name.slice(0, 3),
    accumulatedMoisture: month.accumulated_moisture_g_m2,
    moistureChange: month.moisture_change_g_m2,
  }));
}

export function orderedCondensationMonths(
  result: AssemblyCondensationResponse,
): CondensationMonth[] {
  return [...result.monthly].sort((left, right) => left.month - right.month);
}

export function defaultProfileMonth(result: AssemblyCondensationResponse): number {
  return (
    result.criteria?.interstitial.worst_month ??
    maxBy(result.monthly, (month) => month.accumulated_moisture_g_m2)?.month ??
    1
  );
}

export function monthByNumber(
  result: AssemblyCondensationResponse,
  monthNumber: number,
): CondensationMonth | null {
  return result.monthly.find((month) => month.month === monthNumber) ?? null;
}

export function buildLayerLabelMap(
  assembly: Assembly,
  materials: ProjectMaterial[],
  worstPathId: string | null,
): Map<string, string> {
  const materialsById = materialById(materials);
  const pathSegments = new Set(worstPathId?.split("|") ?? []);
  return new Map(
    assembly.layers.map((layer) => {
      const selectedSegment =
        layer.segments.find((segment) => pathSegments.has(segment.id)) ?? layer.segments[0];
      const materialName = selectedSegment?.project_material_id
        ? materialsById.get(selectedSegment.project_material_id)?.name
        : null;
      return [layer.id, materialName ?? `Layer ${layer.order + 1}`];
    }),
  );
}

export function buildPressureProfileRows(
  month: CondensationMonth,
  axis: ProfileAxis,
  layerLabels: Map<string, string>,
): PressureProfileRow[] {
  const interfaceLabels = new Map(
    month.interfaces.map((item) => [
      item.node_index,
      interfaceLabel(item.outside_layer_id, item.inside_layer_id, layerLabels),
    ]),
  );
  return month.nodes.map((node) => ({
    nodeIndex: node.node_index,
    position: nodePosition(node, axis),
    saturationPressure: node.saturation_pressure_pa,
    vaporPressure: node.vapor_pressure_pa,
    relativeHumidity: node.relative_humidity,
    interfaceLabel: interfaceLabels.get(node.node_index) ?? null,
    isCondensing: node.is_condensing,
  }));
}

export function buildTemperatureProfileRows(
  month: CondensationMonth,
  axis: ProfileAxis,
): TemperatureProfileRow[] {
  return month.nodes.map((node) => ({
    nodeIndex: node.node_index,
    position: nodePosition(node, axis),
    temperature: node.temperature_c,
  }));
}

export function axisLabel(axis: ProfileAxis): string {
  return axis === "sd" ? "Cumulative sd (m)" : "Cumulative thickness (m)";
}

function nodePosition(node: CondensationNodeProfile, axis: ProfileAxis): number {
  return axis === "sd" ? node.cumulative_sd_m : node.cumulative_thickness_m;
}

function interfaceLabel(
  outsideLayerId: string,
  insideLayerId: string,
  layerLabels: Map<string, string>,
): string {
  const outside = layerLabels.get(outsideLayerId) ?? outsideLayerId;
  const inside = layerLabels.get(insideLayerId) ?? insideLayerId;
  return `${outside} / ${inside}`;
}

function maxBy<T>(items: T[], select: (item: T) => number): T | null {
  let selected: T | null = null;
  let selectedValue = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const value = select(item);
    if (value > selectedValue) {
      selected = item;
      selectedValue = value;
    }
  }
  return selected;
}
