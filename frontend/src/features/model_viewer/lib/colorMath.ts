import { hexToRgb, rgbToHex } from "../../../shared/lib/color";

export function mixHexColor(from: string, to: string, fraction: number): string {
  const source = hexToRgb(from);
  const target = hexToRgb(to);
  if (!source || !target) return from;
  return (
    rgbToHex({
      r: lerp(source.r, target.r, fraction),
      g: lerp(source.g, target.g, fraction),
      b: lerp(source.b, target.b, fraction),
    }) ?? from
  );
}

function lerp(from: number, to: number, fraction: number): number {
  return Math.round(from + (to - from) * fraction);
}
