import { Color } from "three";
import {
  VIEWER_DUCT_EXHAUST_COLOR,
  VIEWER_DUCT_SUPPLY_COLOR,
  VIEWER_PIPE_DISTRIBUTION_COLOR,
  VIEWER_PIPE_RECIRC_COLOR,
} from "./colorTokens";
import { isThemeAllowedForLens, themeLabel } from "./themeState";
import type { BuildingModel, LineRenderable, ModelRenderable } from "../loaders/building";
import type {
  ModelObjectMeta,
  ModelViewerLegend,
  ModelViewerLegendRow,
  ModelViewerLens,
  ModelViewerTheme,
} from "../types";

type ColorDefinition = {
  key: string;
  label: string;
  color: string;
};

export type ViewerLineStyleDefinition = {
  id: LineRenderable["lineStyle"];
  label: string;
  color: string;
};

const FACE_TYPE_COLORS: Record<string, ColorDefinition> = {
  Wall: colorDefinition("Wall", "Wall", "#E6B43C"),
  RoofCeiling: colorDefinition("RoofCeiling", "Roof / Ceiling", "#801414"),
  Floor: colorDefinition("Floor", "Floor", "#808080"),
  Aperture: colorDefinition("Aperture", "Aperture", "#4AB4FF"),
  default: colorDefinition("default", "Other", "#C8C8C8"),
};

const BOUNDARY_COLORS: Record<string, ColorDefinition> = {
  Outdoors: colorDefinition("Outdoors", "Outdoors", "#40B4FF"),
  Ground: colorDefinition("Ground", "Ground", "#A55200"),
  Adiabatic: colorDefinition("Adiabatic", "Adiabatic", "#FF8080"),
  Surface: colorDefinition("Surface", "Surface", "#008000"),
  default: colorDefinition("default", "Other", "#C8C8C8"),
};

const VENTILATION_AIRFLOW_COLORS: Record<string, ColorDefinition> = {
  SupplyOnly: colorDefinition("SupplyOnly", "Supply Only", "#8CCEFE"),
  ExtractOnly: colorDefinition("ExtractOnly", "Extract Only", "#FE8C8C"),
  SupplyAndExtract: colorDefinition("SupplyAndExtract", "Supply & Extract", "#E88CF8"),
  NoVentilation: colorDefinition("NoVentilation", "No Ventilation", "#C8C8C8"),
  default: colorDefinition("default", "Unknown", "#C8C8C8"),
};

const FLOOR_WEIGHTING_FACTOR_COLORS: Record<string, ColorDefinition> = {
  FullyTreated: colorDefinition("FullyTreated", "Fully Treated", "#F5E470"),
  Semi: colorDefinition("Semi", "Semi-Treated", "#B1934F"),
  Partial: colorDefinition("Partial", "Partially Treated", "#B9E98A"),
  Minimal: colorDefinition("Minimal", "Minimally Treated", "#88E2EF"),
  NonTreated: colorDefinition("NonTreated", "Non-Treated", "#EE00FF"),
  default: colorDefinition("default", "Unknown", "#C8C8C8"),
};

export const VIEWER_LINE_STYLES: Record<LineRenderable["lineStyle"], ViewerLineStyleDefinition> = {
  "duct-supply": { id: "duct-supply", label: "Supply", color: VIEWER_DUCT_SUPPLY_COLOR },
  "duct-exhaust": { id: "duct-exhaust", label: "Exhaust", color: VIEWER_DUCT_EXHAUST_COLOR },
  "pipe-distribution": {
    id: "pipe-distribution",
    label: "Distribution",
    color: VIEWER_PIPE_DISTRIBUTION_COLOR,
  },
  "pipe-recirc": { id: "pipe-recirc", label: "Recirc", color: VIEWER_PIPE_RECIRC_COLOR },
};

export function lineStyleDefinition(style: LineRenderable["lineStyle"]): ViewerLineStyleDefinition {
  return VIEWER_LINE_STYLES[style];
}

export function colorForThemedObject(
  meta: ModelObjectMeta,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): ColorDefinition | null {
  if (!isThemeAllowedForLens(lens, theme) || theme === "shaded") return null;
  switch (theme) {
    case "surface-type":
      return surfaceTypeColor(meta);
    case "boundary":
      return meta.type === "faceMesh"
        ? colorFromMap(BOUNDARY_COLORS, meta.boundary_condition?.type)
        : null;
    case "construction":
      return meta.type === "faceMesh"
        ? constructionColor(meta.properties.energy.construction?.identifier)
        : null;
    case "window-construction":
      return meta.type === "apertureMeshFace"
        ? constructionColor(meta.properties.energy.construction?.identifier)
        : null;
    case "ventilation-airflow":
      return meta.type === "spaceGroup"
        ? ventilationAirflowColor(meta.airflow?._v_sup, meta.airflow?._v_eta)
        : null;
    case "weighting-factor":
      return meta.type === "spaceFloorSegmentMeshFace"
        ? colorFromMap(
            FLOOR_WEIGHTING_FACTOR_COLORS,
            weightingFactorCategory(meta.weighting_factor),
          )
        : null;
  }
}

export function legendForModel(
  model: BuildingModel,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): ModelViewerLegend {
  if (lens === "ventilation") return miniKeyLegend("Ventilation", ventilationMiniKeyRows(model));
  if (lens === "hot-water") return miniKeyLegend("Hot Water", hotWaterMiniKeyRows(model));
  if (theme === "shaded" || !isThemeAllowedForLens(lens, theme)) return null;

  const rows = legendRowsForTheme(model.objects, lens, theme);
  if (rows.length === 0) return null;
  return {
    title: themeLabel(theme),
    kind: "theme",
    rows,
  };
}

export function weightingFactorCategory(value: number | null | undefined): string {
  if (value === null || value === undefined) return "default";
  if (value >= 0.6) return "FullyTreated";
  if (value >= 0.5) return "Semi";
  if (value >= 0.3) return "Partial";
  if (value > 0) return "Minimal";
  if (value === 0) return "NonTreated";
  return "default";
}

export function ventilationAirflowCategory(
  supplyM3S: number | null | undefined,
  extractM3S: number | null | undefined,
): string {
  const hasSupply = supplyM3S !== null && supplyM3S !== undefined && supplyM3S > 0;
  const hasExtract = extractM3S !== null && extractM3S !== undefined && extractM3S > 0;
  if (hasSupply && hasExtract) return "SupplyAndExtract";
  if (hasSupply) return "SupplyOnly";
  if (hasExtract) return "ExtractOnly";
  return "NoVentilation";
}

export function cyrb53(value: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function constructionColor(identifier: string | null | undefined): ColorDefinition {
  const label = identifier?.trim() || "Unknown";
  const hash1 = cyrb53(label, 0);
  const hash2 = cyrb53(label, hash1);
  const goldenRatio = 0.618033988749895;
  const baseHue = (hash1 % 1000) / 1000;
  const hue = (baseHue + goldenRatio * (hash2 % 100)) % 1.0;
  const saturation = 0.55 + ((hash1 >>> 20) % 30) / 100;
  const lightness = 0.4 + ((hash2 >>> 20) % 25) / 100;
  return colorDefinition(
    label,
    label,
    `#${new Color().setHSL(hue, saturation, lightness).getHexString()}`,
  );
}

function legendRowsForTheme(
  objects: ModelRenderable[],
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): ModelViewerLegendRow[] {
  const counts = new Map<string, ModelViewerLegendRow>();
  for (const object of objects) {
    if (object.lens !== lens) continue;
    const color = colorForThemedObject(object.meta, lens, theme);
    if (!color) continue;
    incrementLegendCount(counts, color);
  }
  if (theme === "construction" || theme === "window-construction") {
    return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label));
  }
  return staticLegendRows(theme, counts);
}

function staticLegendRows(
  theme: ModelViewerTheme,
  counts: Map<string, ModelViewerLegendRow>,
): ModelViewerLegendRow[] {
  const colorMap = staticThemeColorMap(theme);
  if (!colorMap) return [...counts.values()];
  return Object.entries(colorMap)
    .filter(([key]) => key !== "default")
    .map(([, color]) => counts.get(color.key) ?? { ...color, id: color.key, count: 0 })
    .filter((row) => row.count > 0);
}

function surfaceTypeColor(meta: ModelObjectMeta): ColorDefinition | null {
  if (meta.type === "apertureMeshFace") return colorFromMap(FACE_TYPE_COLORS, "Aperture");
  if (meta.type === "faceMesh") return colorFromMap(FACE_TYPE_COLORS, meta.face_type);
  return null;
}

function ventilationAirflowColor(
  supplyM3S: number | null | undefined,
  extractM3S: number | null | undefined,
): ColorDefinition {
  return colorFromMap(
    VENTILATION_AIRFLOW_COLORS,
    ventilationAirflowCategory(supplyM3S, extractM3S),
  );
}

function ventilationMiniKeyRows(model: BuildingModel): ModelViewerLegendRow[] {
  return lineStyleLegendRows(model, ["duct-supply", "duct-exhaust"]);
}

function hotWaterMiniKeyRows(model: BuildingModel): ModelViewerLegendRow[] {
  return lineStyleLegendRows(model, ["pipe-distribution", "pipe-recirc"]);
}

function miniKeyLegend(title: string, rows: ModelViewerLegendRow[]): ModelViewerLegend {
  return rows.length === 0 ? null : { title, kind: "mini-key", rows };
}

function incrementLegendCount(
  counts: Map<string, ModelViewerLegendRow>,
  color: ColorDefinition,
): void {
  const existing = counts.get(color.key);
  if (existing) {
    existing.count += 1;
    return;
  }
  counts.set(color.key, {
    id: color.key,
    label: color.label,
    color: color.color,
    count: 1,
  });
}

function colorFromMap(
  colorMap: Record<string, ColorDefinition>,
  key: string | null | undefined,
): ColorDefinition {
  const fallback = colorMap.default;
  if (!fallback) throw new Error("Color map is missing a default entry.");
  return colorMap[key ?? "default"] ?? fallback;
}

function colorDefinition(key: string, label: string, color: string): ColorDefinition {
  return { key, label, color };
}

function staticThemeColorMap(theme: ModelViewerTheme): Record<string, ColorDefinition> | null {
  switch (theme) {
    case "surface-type":
      return FACE_TYPE_COLORS;
    case "boundary":
      return BOUNDARY_COLORS;
    case "ventilation-airflow":
      return VENTILATION_AIRFLOW_COLORS;
    case "weighting-factor":
      return FLOOR_WEIGHTING_FACTOR_COLORS;
    case "construction":
    case "window-construction":
    case "shaded":
      return null;
  }
}

function lineStyleLegendRows(
  model: BuildingModel,
  styles: LineRenderable["lineStyle"][],
): ModelViewerLegendRow[] {
  return styles
    .map((style) => {
      const definition = lineStyleDefinition(style);
      return {
        id: definition.id,
        label: definition.label,
        color: definition.color,
        count: model.objects.filter(
          (object) => object.kind === "line" && object.lineStyle === style,
        ).length,
      };
    })
    .filter((row) => row.count > 0);
}
