import { describe, expect, test } from "vitest";
import {
  applyGeocodeCandidateToLocationValues,
  buildProjectLocationPayload,
  elevationCoordsKey,
  elevationInputFromMeters,
  elevationSourceLabel,
  emptyLocationFormValues,
  locationFormValuesFromLocation,
  reformatElevationForUnitSystem,
} from "../location-form";
import type { GeocodeProjectLocationCandidate, ProjectLocation } from "../types";
import { ADDRESS_GEOCODE_CANDIDATE, LOCALITY_GEOCODE_CANDIDATE } from "../testing/locationFixtures";

const LOCATION: ProjectLocation = {
  is_set: true,
  latitude: 42.2876,
  longitude: -73.3662,
  elevation_m: 304.8,
  time_zone: "America/New_York",
  true_north_deg: 12,
  street_address: "1 Main St",
  city: "West Stockbridge",
  state: "MA",
  postal_code: "01266",
  full_site_address: "1 Main St, West Stockbridge, MA 01266",
  county: "Berkshire",
  county_fips: "25003",
  country: "US",
  climate_zone: "5A",
  geodata_provenance: {},
  epw_asset_id: null,
  epw_source_url: null,
  updated_at: "2026-06-12T18:00:00Z",
  epw: null,
};

describe("project location form helpers", () => {
  test("applies a locality as a complete streetless address tuple", () => {
    const current = locationFormValuesFromLocation(LOCATION, "SI");
    const locality = LOCALITY_GEOCODE_CANDIDATE;

    expect(applyGeocodeCandidateToLocationValues(current, locality)).toMatchObject({
      latitude: "42.312354",
      longitude: "-73.388044",
      siteAddress: "",
      city: "West Stockbridge",
      state: "MA",
      postalCode: "01266",
    });
  });

  test("clears stale address components that the selected candidate omits", () => {
    const current = locationFormValuesFromLocation(LOCATION, "SI");
    const candidate: GeocodeProjectLocationCandidate = {
      ...LOCALITY_GEOCODE_CANDIDATE,
      label: "Privacy Point, MA",
      latitude: 42,
      longitude: -73,
      city: "Privacy Point",
      postal_code: null,
      full_site_address: "Privacy Point, MA",
    };

    expect(applyGeocodeCandidateToLocationValues(current, candidate)).toMatchObject({
      siteAddress: "",
      city: "Privacy Point",
      state: "MA",
      postalCode: "",
    });
  });

  test("keeps normalized address fields without copying the presentation label", () => {
    const current = locationFormValuesFromLocation(LOCATION, "SI");
    const address: GeocodeProjectLocationCandidate = {
      ...ADDRESS_GEOCODE_CANDIDATE,
      label: "10 DISPLAY LABEL, NEW YORK, NY 10001",
      latitude: 40.75,
      longitude: -73.99,
      street_address: "10 W 30TH ST",
      city: "NEW YORK",
      state: "NY",
      postal_code: "10001",
      full_site_address: "10 W 30TH ST, NEW YORK, NY 10001",
    };

    expect(applyGeocodeCandidateToLocationValues(current, address)).toMatchObject({
      siteAddress: "10 W 30TH ST",
      city: "NEW YORK",
      state: "NY",
      postalCode: "10001",
    });
  });

  test("round-trips elevation between metres and feet without converting angular fields", () => {
    const ipValues = locationFormValuesFromLocation(LOCATION, "IP");

    expect(ipValues.elevation).toBe("1000.0");
    expect(ipValues.latitude).toBe("42.2876");
    expect(ipValues.longitude).toBe("-73.3662");
    expect(ipValues.trueNorth).toBe("12");

    const siElevation = reformatElevationForUnitSystem(ipValues.elevation, "IP", "SI");
    expect(siElevation).toBe("304.8");
  });

  test("builds a partial SI payload and preserves explicit-null clears", () => {
    const values = {
      ...locationFormValuesFromLocation(LOCATION, "IP"),
      elevation: "1100",
      city: " ",
      latitude: "42.3",
    };

    const result = buildProjectLocationPayload(LOCATION, values, "IP");

    expect(result).toEqual({
      ok: true,
      payload: {
        latitude: 42.3,
        elevation_m: 335.28,
        city: null,
      },
    });
  });

  test("rejects invalid coordinate and north ranges", () => {
    expect(
      buildProjectLocationPayload(null, { ...emptyLocationFormValues(), latitude: "91" }, "SI"),
    ).toEqual({ ok: false, error: "Latitude must be between -90 and 90 degrees." });
    expect(
      buildProjectLocationPayload(null, { ...emptyLocationFormValues(), trueNorth: "360" }, "SI"),
    ).toEqual({
      ok: false,
      error: "True north must be greater than or equal to 0 and less than 360 degrees.",
    });
  });
});

describe("elevation auto-fill helpers", () => {
  test("labels known elevation providers and passes others through", () => {
    expect(elevationSourceLabel("usgs_epqs")).toBe("USGS 3DEP");
    expect(elevationSourceLabel("open_meteo")).toBe("Open-Meteo");
    expect(elevationSourceLabel("custom")).toBe("custom");
    expect(elevationSourceLabel(null)).toBeNull();
  });

  test("coordinate key is stable to 6 dp and empty when a part is missing", () => {
    expect(elevationCoordsKey(42.1, -73.2)).toBe("42.100000,-73.200000");
    expect(elevationCoordsKey(null, -73.2)).toBe("");
    expect(elevationCoordsKey(42.1, null)).toBe("");
  });

  test("formats a metre elevation into the active unit system", () => {
    expect(elevationInputFromMeters(304.8, "SI")).toBe("304.8");
    expect(elevationInputFromMeters(304.8, "IP")).toBe("1000.0");
  });
});
