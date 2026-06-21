import type { ClimateRecord, ClimateSourceKind, ProjectClimateSource } from "./types";
import type { ClimateLocationSummary } from "./types";

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

// One-line location descriptor for list rows: "Name — REGION, COUNTRY".
export function locationSubtitle(location: ClimateLocationSummary): string {
  const place = [location.region, location.country].filter(Boolean).join(", ");
  return place ? `${location.name} — ${place}` : location.name;
}

// Format a coordinate pair compactly; nulls render as an em dash.
export function formatLatLong(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) return "—";
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

// Round a SI radiation / energy value for display (kWh/m² monthly, W/m²
// peak). Radiation has no IP form in the units registry, so it stays SI.
export function formatSi(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(fractionDigits);
}

const SOURCE_KIND_LABELS: Record<ClimateSourceKind, string> = {
  phius: "Phius",
  phi: "PHI",
  ashrae: "ASHRAE",
  epw: "EPW",
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

export function climateSourceProximity(source: ProjectClimateSource): string | null {
  const data = source.data;
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
  const status = stringValue(source.data?.status);
  if (status === "pass" || status === "warning" || status === "fail") return status;
  return null;
}

export function climateSourceCachedMetrics(source: ProjectClimateSource): string | null {
  if (!source.data) return null;
  if (source.kind === "epw") {
    const stat = recordValue(source.data.stat_metrics);
    const hdd65 = numberValue(stat?.hdd65_f_days);
    const cdd50 = numberValue(stat?.cdd50_f_days);
    const recordLow = numberValue(stat?.record_low_c);
    const recordHigh = numberValue(stat?.record_high_c);
    const parts = [];
    if (hdd65 !== null) parts.push(`HDD65 ${hdd65.toFixed(0)}`);
    if (cdd50 !== null) parts.push(`CDD50 ${cdd50.toFixed(0)}`);
    if (recordLow !== null && recordHigh !== null) {
      parts.push(`records ${recordLow.toFixed(1)} / ${recordHigh.toFixed(1)} °C`);
    }
    return parts.length ? parts.join(" · ") : null;
  }
  if (source.kind === "ashrae") {
    const design = recordValue(source.data.design_conditions);
    const heating = numberValue(design?.heating_996_db_c);
    const cooling = numberValue(design?.cooling_010_db_c);
    const basis = stringValue(design?.basis);
    const parts = [];
    if (heating !== null) parts.push(`Htg 99.6% ${heating.toFixed(1)} °C`);
    if (cooling !== null) parts.push(`Clg 1% ${cooling.toFixed(1)} °C`);
    if (basis !== null) parts.push(basis);
    return parts.length ? parts.join(" · ") : null;
  }
  return null;
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
