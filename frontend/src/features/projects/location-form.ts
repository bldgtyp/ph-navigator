import {
  formatNumberUnitsDisplay,
  numberUnitLabel,
  parseNumberUnitsInput,
  type NumberUnitsConfig,
  type UnitSystem,
} from "../../lib/units";
import { parseDecimalInput, stripTrailingZeros } from "../../lib/units/format";
import type {
  EpwParseResponse,
  ProjectLocation,
  ProjectLocationFields,
  UpdateProjectLocationPayload,
} from "./types";

export type ProjectLocationFormValues = {
  latitude: string;
  longitude: string;
  elevation: string;
  timeZone: string;
  trueNorth: string;
  siteAddress: string;
  city: string;
  state: string;
  epwAssetId: string;
  epwSourceUrl: string;
};

export type ProjectLocationPayloadResult =
  | { ok: true; payload: UpdateProjectLocationPayload }
  | { ok: false; error: string };

export const LOCATION_ELEVATION_UNITS: NumberUnitsConfig = {
  mode: "fixed",
  unit_type: "length",
  si_unit: "m",
  ip_unit: "ft",
  precision_si: 1,
  precision_ip: 1,
};

export function emptyLocationFormValues(): ProjectLocationFormValues {
  return {
    latitude: "",
    longitude: "",
    elevation: "",
    timeZone: "",
    trueNorth: "",
    siteAddress: "",
    city: "",
    state: "",
    epwAssetId: "",
    epwSourceUrl: "",
  };
}

export function locationFormValuesFromLocation(
  location: ProjectLocation | null | undefined,
  unitSystem: UnitSystem,
): ProjectLocationFormValues {
  if (!location) return emptyLocationFormValues();
  return {
    latitude: formatOptionalNumber(location.latitude, 6),
    longitude: formatOptionalNumber(location.longitude, 6),
    elevation: formatNumberUnitsDisplay(location.elevation_m, LOCATION_ELEVATION_UNITS, unitSystem),
    timeZone: location.time_zone ?? "",
    trueNorth: formatOptionalNumber(location.true_north_deg, 2),
    siteAddress: location.site_address ?? "",
    city: location.city ?? "",
    state: location.state ?? "",
    epwAssetId: location.epw_asset_id ?? "",
    epwSourceUrl: location.epw_source_url ?? "",
  };
}

export function applyEpwSuggestionToLocationValues(
  current: ProjectLocationFormValues,
  response: EpwParseResponse,
  unitSystem: UnitSystem,
): ProjectLocationFormValues {
  const suggestion = response.suggestion;
  return {
    ...current,
    latitude: formatOptionalNumber(suggestion.latitude, 6),
    longitude: formatOptionalNumber(suggestion.longitude, 6),
    elevation: formatNumberUnitsDisplay(
      suggestion.elevation_m,
      LOCATION_ELEVATION_UNITS,
      unitSystem,
    ),
    timeZone: suggestion.time_zone ?? current.timeZone,
    city: suggestion.city ?? current.city,
    state: suggestion.state ?? current.state,
    epwAssetId: response.asset_id,
  };
}

export function elevationUnitLabel(unitSystem: UnitSystem): string {
  return numberUnitLabel(unitSystem === "IP" ? "ft" : "m");
}

export function formatLocationElevationDisplay(
  valueM: number | null,
  unitSystem: UnitSystem,
): string {
  if (valueM === null) return "None";
  return formatNumberUnitsDisplay(valueM, LOCATION_ELEVATION_UNITS, unitSystem);
}

export function reformatElevationForUnitSystem(
  value: string,
  fromUnitSystem: UnitSystem,
  toUnitSystem: UnitSystem,
): string {
  if (fromUnitSystem === toUnitSystem) return value;
  const parsed = parseNumberUnitsInput(value, LOCATION_ELEVATION_UNITS, fromUnitSystem);
  if (parsed === null) return "";
  if (parsed === undefined) return value;
  return formatNumberUnitsDisplay(parsed, LOCATION_ELEVATION_UNITS, toUnitSystem);
}

export function buildProjectLocationPayload(
  location: ProjectLocation | null | undefined,
  values: ProjectLocationFormValues,
  unitSystem: UnitSystem,
): ProjectLocationPayloadResult {
  const parsed = parseLocationFormValues(values, unitSystem);
  if (!parsed.ok) return parsed;
  const base = locationFields(location);
  const payload: UpdateProjectLocationPayload = {};
  for (const field of EDITABLE_LOCATION_FIELD_NAMES) {
    const nextValue = parsed.fields[field];
    if (!locationValuesEqual(base[field], nextValue)) {
      assignLocationPayloadField(payload, field, nextValue);
    }
  }
  return { ok: true, payload };
}

function parseLocationFormValues(
  values: ProjectLocationFormValues,
  unitSystem: UnitSystem,
): { ok: true; fields: ProjectLocationFields } | { ok: false; error: string } {
  const latitude = parseOptionalDecimal(values.latitude, "Latitude");
  if (!latitude.ok) return latitude;
  if (latitude.value !== null && (latitude.value < -90 || latitude.value > 90)) {
    return { ok: false, error: "Latitude must be between -90 and 90 degrees." };
  }

  const longitude = parseOptionalDecimal(values.longitude, "Longitude");
  if (!longitude.ok) return longitude;
  if (longitude.value !== null && (longitude.value < -180 || longitude.value > 180)) {
    return { ok: false, error: "Longitude must be between -180 and 180 degrees." };
  }

  const elevation = parseNumberUnitsInput(values.elevation, LOCATION_ELEVATION_UNITS, unitSystem);
  if (elevation === undefined) return { ok: false, error: "Elevation must be a number." };
  if (elevation !== null && (elevation < -500 || elevation > 9000)) {
    return { ok: false, error: "Elevation must be between -500 and 9000 metres." };
  }

  const trueNorth = parseOptionalDecimal(values.trueNorth, "True north");
  if (!trueNorth.ok) return trueNorth;
  if (trueNorth.value !== null && (trueNorth.value < 0 || trueNorth.value >= 360)) {
    return {
      ok: false,
      error: "True north must be greater than or equal to 0 and less than 360 degrees.",
    };
  }

  return {
    ok: true,
    fields: {
      latitude: latitude.value,
      longitude: longitude.value,
      elevation_m: elevation,
      time_zone: trimmedOrNull(values.timeZone),
      true_north_deg: trueNorth.value,
      site_address: trimmedOrNull(values.siteAddress),
      city: trimmedOrNull(values.city),
      state: trimmedOrNull(values.state),
      epw_asset_id: trimmedOrNull(values.epwAssetId),
      epw_source_url: trimmedOrNull(values.epwSourceUrl),
    },
  };
}

function parseOptionalDecimal(
  raw: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = parseDecimalInput(trimmed);
  if (!Number.isFinite(parsed)) return { ok: false, error: `${label} must be a number.` };
  return { ok: true, value: parsed };
}

function locationFields(location: ProjectLocation | null | undefined): ProjectLocationFields {
  return {
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    elevation_m: location?.elevation_m ?? null,
    time_zone: location?.time_zone ?? null,
    true_north_deg: location?.true_north_deg ?? null,
    site_address: location?.site_address ?? null,
    city: location?.city ?? null,
    state: location?.state ?? null,
    epw_asset_id: location?.epw_asset_id ?? null,
    epw_source_url: location?.epw_source_url ?? null,
  };
}

function trimmedOrNull(value: string): string | null {
  return value.trim() || null;
}

function formatOptionalNumber(value: number | null, fractionDigits: number): string {
  if (value === null) return "";
  return Number.isInteger(value)
    ? String(value)
    : stripTrailingZeros(value.toFixed(fractionDigits));
}

function locationValuesEqual(
  a: ProjectLocationFields[keyof ProjectLocationFields],
  b: ProjectLocationFields[keyof ProjectLocationFields],
): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  return a === b;
}

function assignLocationPayloadField(
  payload: UpdateProjectLocationPayload,
  field: (typeof EDITABLE_LOCATION_FIELD_NAMES)[number],
  value: ProjectLocationFields[(typeof EDITABLE_LOCATION_FIELD_NAMES)[number]],
): void {
  switch (field) {
    case "latitude":
    case "longitude":
    case "elevation_m":
    case "true_north_deg":
      payload[field] = value as number | null;
      return;
    case "time_zone":
    case "site_address":
    case "city":
    case "state":
    case "epw_asset_id":
    case "epw_source_url":
      payload[field] = value as string | null;
      return;
  }
}

const EDITABLE_LOCATION_FIELD_NAMES = [
  "latitude",
  "longitude",
  "elevation_m",
  "time_zone",
  "true_north_deg",
  "site_address",
  "city",
  "state",
  "epw_asset_id",
  "epw_source_url",
] as const;
