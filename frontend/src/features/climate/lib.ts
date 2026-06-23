import type { UnitSystem } from "../../lib/units";
import { elevationUnitLabel, formatLocationElevationDisplay } from "../projects/location-form";
import type {
  ClimateLocationSummary,
  ClimateRecord,
  ClimateSourceKind,
  ProjectClimateSource,
} from "./types";
import { stateCodeFromRegion } from "./us-states";

// Jan…Dec — the ordering of every `Monthly12` series in a ClimateRecord.
export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// One climate dataset's human label, e.g. "Phius 2022". Falls back to
// provider/version when the dataset row has no explicit label.
export function datasetLabel(label: string | null, provider: string, version: string): string {
  return label ?? `${provider} ${version}`;
}

// Format a coordinate pair compactly; nulls render as an em dash.
export function formatLatLong(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) return "—";
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

// Elevation formatted for the app unit system with its unit label, or null
// when unset. Shared by the sidebar location card and the location page.
export function formatLocationElevationLabel(
  elevationM: number | null | undefined,
  unitSystem: UnitSystem,
): string | null {
  if (elevationM == null) return null;
  return `${formatLocationElevationDisplay(elevationM, unitSystem)} ${elevationUnitLabel(unitSystem)}`;
}

// Round a SI radiation / energy value for display (kWh/m² monthly, W/m²
// peak). Radiation has no IP form in the units registry, so it stays SI.
export function formatSi(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(fractionDigits);
}

// A station's site-vs-station elevation delta, in feet. Shared by both station
// pickers' list rows (PH dataset + weather catalog).
export function formatDeltaFt(elevationDeltaFt: number | null): string {
  return elevationDeltaFt === null ? "Δ — ft" : `Δ ${elevationDeltaFt.toFixed(0)} ft`;
}

const SOURCE_KIND_LABELS: Record<ClimateSourceKind, string> = {
  phius: "Phius",
  phi: "PHI",
  weather: "Weather File",
  custom: "Custom",
};

// Short display name for a source kind (e.g. "Phius", "ASHRAE").
export function climateSourceKindLabel(kind: ClimateSourceKind): string {
  return SOURCE_KIND_LABELS[kind] ?? kind;
}

// One-line description of an attached source for the roster: its label, or
// a kind-appropriate fallback derived from `ref`.
export function climateSourceSubtitle(source: ProjectClimateSource): string {
  if (source.label) return source.label;
  if (source.kind === "custom") return "Custom record";
  return source.ref ?? "—";
}

export function climateLocationTitle(
  location: Pick<ClimateLocationSummary, "name" | "region"> | null | undefined,
  fallback: string,
): string {
  if (!location?.name) return fallback;
  const stateCode = stateCodeFromRegion(location.region);
  return stateCode ? `${location.name}, ${stateCode}` : location.name;
}

export function climateSourceProximity(source: ProjectClimateSource): string | null {
  const data = climateSourceProximityData(source);
  if (!data || (source.kind !== "phius" && source.kind !== "phi")) return null;
  const distanceMi = numberValue(data.distance_mi);
  const elevationDeltaFt = numberValue(data.elevation_delta_ft);
  const message = stringValue(data.message);
  if (distanceMi === null && elevationDeltaFt === null && message === null) return null;
  const parts = [];
  if (distanceMi !== null) parts.push(`${distanceMi.toFixed(1)} mi`);
  if (elevationDeltaFt !== null) parts.push(`${elevationDeltaFt.toFixed(0)} ft elev delta`);
  if (message !== null) parts.push(message);
  return parts.join(" · ");
}

export function climateSourceProximityStatus(
  source: ProjectClimateSource,
): "pass" | "warning" | "fail" | null {
  const status = stringValue(climateSourceProximityData(source)?.status);
  if (status === "pass" || status === "warning" || status === "fail") return status;
  return null;
}

function climateSourceProximityData(source: ProjectClimateSource): Record<string, unknown> | null {
  const data = source.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const proximity = data.proximity;
  return proximity && typeof proximity === "object" && !Array.isArray(proximity)
    ? (proximity as Record<string, unknown>)
    : data;
}

export type ClimateStatusTone = "pass" | "warning" | "fail" | "missing";

// The three climate-source types every project should establish, in their
// canonical sidebar order. A type with no attached source still shows as a
// "not set" slot so the gap is visible (e.g. no nearby PHI dataset).
export const CANONICAL_CLIMATE_KINDS: ClimateSourceKind[] = ["phius", "phi", "weather"];

// The sidebar/header status chip for a source: a proximity verdict when one
// is recorded (Phius/PHI), otherwise an attached source reads as OK.
export function climateSourceStatusChip(source: ProjectClimateSource): {
  tone: ClimateStatusTone;
  label: string;
} {
  const status = climateSourceProximityStatus(source);
  if (status === "fail") return { tone: "fail", label: "Fail" };
  if (status === "warning") return { tone: "warning", label: "Check" };
  return { tone: "pass", label: "OK" };
}

// A dataset edition/version suffix for the type badge ("2022", "10.6") when
// the source carries one; never fabricated.
export function climateSourceBadgeVersion(source: ProjectClimateSource): string | null {
  return (
    stringValue(source.data?.version) ??
    stringValue(source.data?.edition) ??
    stringValue(source.data?.dataset_version)
  );
}

// The two compact attribute chips on a source's nav card. Proximity (mi/ft)
// for Phius/PHI; degree-days (HDD65/CDD50) for the weather file.
export function climateSourceNavAttrs(source: ProjectClimateSource): string[] {
  const data = source.data;
  if (!data) return [];
  if (source.kind === "phius" || source.kind === "phi") {
    const distanceMi = numberValue(data.distance_mi);
    const elevationDeltaFt = numberValue(data.elevation_delta_ft);
    const attrs: string[] = [];
    if (distanceMi !== null) attrs.push(`${distanceMi.toFixed(0)} mi`);
    if (elevationDeltaFt !== null) attrs.push(`Δ ${formatSignedFt(elevationDeltaFt)}`);
    return attrs;
  }
  if (source.kind === "weather") {
    const stat = recordValue(data.stat_metrics);
    const hdd65 = numberValue(stat?.hdd65_f_days);
    const cdd50 = numberValue(stat?.cdd50_f_days);
    const attrs: string[] = [];
    if (hdd65 !== null) attrs.push(`HDD65 ${hdd65.toFixed(0)}`);
    if (cdd50 !== null) attrs.push(`CDD50 ${cdd50.toFixed(0)}`);
    return attrs;
  }
  return [];
}

function formatSignedFt(valueFt: number): string {
  return `${valueFt > 0 ? "+" : ""}${valueFt.toFixed(0)} ft`;
}

export function isClimateRecord(value: unknown): value is ClimateRecord {
  const record = recordValue(value);
  return Boolean(
    record?.display_name && recordValue(record.climate) && recordValue(record.location),
  );
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
