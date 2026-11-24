import type { ApertureThermalComfortResult } from "./comfort-types";

export type ComfortChipTone = "success" | "warning" | "danger" | "neutral";

export type ComfortChipPresentation = {
  label: string;
  tone: ComfortChipTone;
  muted: boolean;
};

/**
 * Mirrors `envelope/condensation-chip.ts` exactly: `{ label, tone, muted }`
 * using the existing `success | warning | danger | neutral` chip tones.
 */
export function thermalComfortChipPresentation(
  result: ApertureThermalComfortResult | null,
  loading: boolean,
  unavailable: boolean,
): ComfortChipPresentation {
  if (loading) return { label: "Comfort: calculating", tone: "neutral", muted: true };
  if (unavailable || result === null) {
    return { label: "Comfort: unavailable", tone: "neutral", muted: true };
  }
  if (result.state === "blocked") {
    if (result.blocked_reasons.includes("missing_sill_height")) {
      return { label: "Comfort: needs sill height", tone: "neutral", muted: false };
    }
    if (result.blocked_reasons.includes("missing_climate_source")) {
      return { label: "Comfort: needs a climate source", tone: "neutral", muted: false };
    }
    return { label: "Comfort: needs review", tone: "neutral", muted: false };
  }
  if (result.state === "fail") {
    const n = result.failing_count;
    return {
      label: `Comfort: ${n} ${n === 1 ? "lite fails" : "lites fail"}`,
      tone: "danger",
      muted: false,
    };
  }
  if (result.state === "alternative") {
    return { label: "Comfort: passes on alternative", tone: "warning", muted: false };
  }
  if (result.state === "exempt") {
    return { label: "Comfort: exempt", tone: "neutral", muted: true };
  }
  return { label: "Comfort: OK", tone: "success", muted: false };
}
