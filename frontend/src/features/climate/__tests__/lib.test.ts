import { describe, expect, test } from "vitest";
import { datasetLabel, formatLatLong, formatSi, locationSubtitle, MONTH_LABELS } from "../lib";
import type { ClimateLocationSummary } from "../types";

const LOCATION: ClimateLocationSummary = {
  id: "loc-1",
  dataset_id: "ds-1",
  name: "Worcester",
  country: "US",
  region: "MA",
  climate_zone: null,
  latitude: 42.2671,
  longitude: -71.8831,
  elevation_m: 300,
  station_id: "WORCHESTER_REGIONAL_ARPT_MA",
};

describe("climate lib", () => {
  test("MONTH_LABELS is Jan…Dec", () => {
    expect(MONTH_LABELS).toHaveLength(12);
    expect(MONTH_LABELS[0]).toBe("Jan");
    expect(MONTH_LABELS[11]).toBe("Dec");
  });

  test("datasetLabel prefers the explicit label, falls back to provider/version", () => {
    expect(datasetLabel("Phius 2022", "phius", "2022")).toBe("Phius 2022");
    expect(datasetLabel(null, "phi", "10.6")).toBe("phi 10.6");
  });

  test("locationSubtitle appends region/country when present", () => {
    expect(locationSubtitle(LOCATION)).toBe("Worcester — MA, US");
    expect(locationSubtitle({ ...LOCATION, region: null, country: null })).toBe("Worcester");
  });

  test("formatLatLong rounds to 3 dp, em dash on null", () => {
    expect(formatLatLong(42.2671, -71.8831)).toBe("42.267, -71.883");
    expect(formatLatLong(null, -71.8831)).toBe("—");
  });

  test("formatSi rounds and guards null/undefined", () => {
    expect(formatSi(123.456)).toBe("123");
    expect(formatSi(0.2, 2)).toBe("0.20");
    expect(formatSi(null)).toBe("—");
    expect(formatSi(undefined)).toBe("—");
  });
});
