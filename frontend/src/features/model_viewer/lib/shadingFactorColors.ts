import {
  VIEWER_SHADING_FACTOR_COLOR_STOPS,
  VIEWER_SHADING_FACTOR_MISSING_COLOR,
} from "./colorTokens";
import { mixRgbColor } from "./colorMath";
import { hexToRgb } from "../../../shared/lib/color";
import type { ModelObjectMeta, ShadingFactorSeason } from "../types";

export { VIEWER_SHADING_FACTOR_COLOR_STOPS, VIEWER_SHADING_FACTOR_MISSING_COLOR };

const PREPARED_COLOR_STOPS = VIEWER_SHADING_FACTOR_COLOR_STOPS.map((stop) => {
  const rgb = hexToRgb(stop.color);
  if (!rgb) throw new Error(`Invalid shading-factor color stop: ${stop.color}`);
  return { ...stop, rgb };
});

export function isValidShadingFactor(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function shadingFactorValue(
  meta: ModelObjectMeta,
  season: ShadingFactorSeason,
): number | null | undefined {
  if (meta.type !== "apertureMeshFace") return null;
  return season === "summer"
    ? meta.properties.ph?.summer_shading_factor
    : meta.properties.ph?.winter_shading_factor;
}

export function shadingFactorColor(value: number | null | undefined): string {
  if (!isValidShadingFactor(value)) {
    return VIEWER_SHADING_FACTOR_MISSING_COLOR;
  }

  const upperIndex = PREPARED_COLOR_STOPS.findIndex((stop) => value <= stop.value);
  const upper = PREPARED_COLOR_STOPS[upperIndex];
  if (!upper) return VIEWER_SHADING_FACTOR_MISSING_COLOR;
  if (upperIndex === 0 || value === upper.value) return upper.color;

  const lower = PREPARED_COLOR_STOPS[upperIndex - 1];
  if (!lower) return upper.color;
  const fraction = (value - lower.value) / (upper.value - lower.value);
  return mixRgbColor(lower.rgb, upper.rgb, fraction).toUpperCase();
}
