import { formatNumberWithUnit, parseDecimalInput } from "./format";
import type { UnitFormatOptions, UnitParseResult } from "./types";

const BTU_H_FT2_F_PER_W_M2K = 0.1761101838;
const IP_R_PER_SI_R = 5.678263337;
const BTU_H_FT_F_PER_W_MK = 0.577789317;
const R_PER_IN_PER_W_MK = 1 / (BTU_H_FT_F_PER_W_MK * 12);

export function wm2kToBtuHft2F(valueWm2K: number): number {
  return valueWm2K * BTU_H_FT2_F_PER_W_M2K;
}

export function btuHft2FToWm2K(valueBtuHft2F: number): number {
  return valueBtuHft2F / BTU_H_FT2_F_PER_W_M2K;
}

export function m2kWToHft2FBtu(valueM2KW: number): number {
  return valueM2KW * IP_R_PER_SI_R;
}

export function hft2FBtuToM2kW(valueHft2FBtu: number): number {
  return valueHft2FBtu / IP_R_PER_SI_R;
}

export function wmkToBtuHftF(valueWmK: number): number {
  return valueWmK * BTU_H_FT_F_PER_W_MK;
}

export function btuHftFToWmK(valueBtuHftF: number): number {
  return valueBtuHftF / BTU_H_FT_F_PER_W_MK;
}

export function conductivityWmKToRPerIn(valueWmK: number): number {
  return R_PER_IN_PER_W_MK / valueWmK;
}

export function rPerInToConductivityWmK(valueRPerIn: number): number {
  return R_PER_IN_PER_W_MK / valueRPerIn;
}

export function formatUValueFromWm2K(
  valueWm2K: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueWm2K === null || valueWm2K === undefined ? valueWm2K : wm2kToBtuHft2F(valueWm2K),
        "Btu/(h-ft2-F)",
        { fractionDigits: 3, ...options },
      )
    : formatNumberWithUnit(valueWm2K, "W/(m2-K)", { fractionDigits: 3, ...options });
}

export function parseUValueToWm2K(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter a U-value." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0) return { ok: false, code: "negative", message: "U-value cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? btuHft2FToWm2K(parsed) : parsed };
}

export function formatRValueFromM2KPerW(
  valueM2KW: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueM2KW === null || valueM2KW === undefined ? valueM2KW : m2kWToHft2FBtu(valueM2KW),
        "h-ft2-F/Btu",
        { fractionDigits: 2, ...options },
      )
    : formatNumberWithUnit(valueM2KW, "m2-K/W", { fractionDigits: 2, ...options });
}

export function formatLinearPsiFromWmK(
  valueWmK: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueWmK === null || valueWmK === undefined ? valueWmK : wmkToBtuHftF(valueWmK),
        "Btu/(h-ft-F)",
        { fractionDigits: 3, ...options },
      )
    : formatNumberWithUnit(valueWmK, "W/(m-K)", { fractionDigits: 3, ...options });
}

export function parseLinearPsiToWmK(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter a psi-value." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0) return { ok: false, code: "negative", message: "Psi-value cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? btuHftFToWmK(parsed) : parsed };
}

export function formatConductivityFromWmK(
  valueWmK: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return options.unitSystem === "IP"
    ? formatNumberWithUnit(
        valueWmK === null || valueWmK === undefined ? valueWmK : wmkToBtuHftF(valueWmK),
        "Btu/(h-ft-F)",
        { fractionDigits: 3, ...options },
      )
    : formatNumberWithUnit(valueWmK, "W/(m-K)", { fractionDigits: 3, ...options });
}

export function parseConductivityToWmK(input: string, options: UnitFormatOptions): UnitParseResult {
  const parsed = parseDecimalInput(input);
  if (parsed === null) return { ok: false, code: "empty", message: "Enter conductivity." };
  if (Number.isNaN(parsed))
    return { ok: false, code: "invalid_number", message: "Enter a number." };
  if (parsed < 0)
    return { ok: false, code: "negative", message: "Conductivity cannot be negative." };
  return { ok: true, valueSi: options.unitSystem === "IP" ? btuHftFToWmK(parsed) : parsed };
}

export function formatRPerInFromConductivityWmK(
  valueWmK: number | null | undefined,
  options: UnitFormatOptions,
): string {
  return formatNumberWithUnit(
    valueWmK === null || valueWmK === undefined || valueWmK === 0
      ? valueWmK
      : conductivityWmKToRPerIn(valueWmK),
    "h-ft2-F/Btu-in",
    { fractionDigits: 2, ...options },
  );
}
