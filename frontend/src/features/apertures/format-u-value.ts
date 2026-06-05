// Format the composite window U-Value for display. SI keeps the
// stored ``W/m²K`` value; IP converts using the standard
// 1 W/m²K = 0.1761 BTU/(hr·ft²·°F) factor (ISO 9251 / NIST). The chip
// surface uses two decimal places per PRD §11 / §8.

export type UValueUnitSystem = "si" | "ip";

export const W_M2K_TO_BTU_HRFT2F = 0.1761;

export function formatWindowUValue(
  valueWm2k: number | null | undefined,
  system: UValueUnitSystem,
): string {
  if (valueWm2k === null || valueWm2k === undefined || !Number.isFinite(valueWm2k)) {
    return "Window U-Value: --";
  }
  if (system === "ip") {
    return `Window U-Value: ${(valueWm2k * W_M2K_TO_BTU_HRFT2F).toFixed(2)} BTU/(hr·ft²·°F)`;
  }
  return `Window U-Value: ${valueWm2k.toFixed(2)} W/m²K`;
}

export function formatElementUValue(
  valueWm2k: number | null | undefined,
  system: UValueUnitSystem,
): string {
  if (valueWm2k === null || valueWm2k === undefined || !Number.isFinite(valueWm2k)) {
    return "U-Value: --";
  }
  if (system === "ip") {
    return `U-Value: ${(valueWm2k * W_M2K_TO_BTU_HRFT2F).toFixed(2)} BTU/(hr·ft²·°F)`;
  }
  return `U-Value: ${valueWm2k.toFixed(2)} W/m²K`;
}
