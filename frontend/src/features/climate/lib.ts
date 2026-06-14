import type { ClimateSourceKind, ProjectClimateSource } from "./types";
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
