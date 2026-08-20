import { hexToRgb, rgbToHex, type RgbColor } from "../../../shared/lib/color";

export function mixHexColor(from: string, to: string, fraction: number): string {
  const source = hexToRgb(from);
  const target = hexToRgb(to);
  if (!source || !target) return from;
  return mixRgbColor(source, target, fraction);
}

export function mixRgbColor(from: RgbColor, to: RgbColor, fraction: number): string {
  const mixed = rgbToHex({
    r: lerp(from.r, to.r, fraction),
    g: lerp(from.g, to.g, fraction),
    b: lerp(from.b, to.b, fraction),
  });
  if (!mixed) throw new Error("RGB interpolation produced an invalid color.");
  return mixed;
}

function lerp(from: number, to: number, fraction: number): number {
  return Math.round(from + (to - from) * fraction);
}
