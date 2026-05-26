import { formatNumberWithUnit } from "./format";
import type { UnitFormatOptions } from "./types";

const CFM_PER_M3_H = 0.588577779;
const CFM_PER_M3_S = 2118.8800032893;

export function m3hToCfm(valueM3H: number): number {
  return valueM3H * CFM_PER_M3_H;
}

export function cfmToM3h(valueCfm: number): number {
  return valueCfm / CFM_PER_M3_H;
}

export function m3sToCfm(valueM3S: number): number {
  return valueM3S * CFM_PER_M3_S;
}

export function cfmToM3s(valueCfm: number): number {
  return valueCfm / CFM_PER_M3_S;
}

export function formatAirflowFromM3H(
  valueM3H: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(valueM3H === null || valueM3H === undefined ? valueM3H : m3hToCfm(valueM3H), "cfm", {
        fractionDigits: 1,
        ...options,
      })
    : formatNumberWithUnit(valueM3H, "m3/h", { fractionDigits: 1, ...options });
}

export function formatAirflowFromM3S(
  valueM3S: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(valueM3S === null || valueM3S === undefined ? valueM3S : m3sToCfm(valueM3S), "cfm", {
        fractionDigits: 1,
        ...options,
      })
    : formatNumberWithUnit(valueM3S, "m3/s", { fractionDigits: 3, ...options });
}
