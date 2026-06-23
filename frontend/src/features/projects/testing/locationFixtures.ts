import { vi } from "vitest";
import type { ProjectDetail, ProjectLocation } from "../types";

// Shared fixtures for the project-location editor tests, used by both the
// Climate-tab section test and the (now read-only) settings-modal test.

export const LOCATION_PROJECT: ProjectDetail = {
  id: "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5",
  name: "West Stockbridge House",
  bt_number: "2426",
  client: "May",
  cert_programs: ["phi"],
  phius_number: null,
  phius_dropbox_url: null,
  owner_display_name: "Ed May",
  active_version_id: "61561caa-44d0-401d-9daa-0fa113df8340",
  last_saved_at: "2026-05-12T18:00:00Z",
  created_at: "2026-05-12T18:00:00Z",
  updated_at: "2026-05-12T18:00:00Z",
  access_mode: "editor",
  active_version: {
    id: "61561caa-44d0-401d-9daa-0fa113df8340",
    project_id: "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5",
    name: "Working",
    kind: "working",
    locked: false,
    schema_version: 1,
    body_size_bytes: 230,
    created_at: "2026-05-12T18:00:00Z",
    updated_at: "2026-05-12T18:00:00Z",
  },
  versions: [],
};

export const UNSET_LOCATION: ProjectLocation = {
  is_set: false,
  latitude: null,
  longitude: null,
  elevation_m: null,
  time_zone: null,
  true_north_deg: null,
  street_address: null,
  city: null,
  state: null,
  postal_code: null,
  full_site_address: null,
  county: null,
  county_fips: null,
  country: null,
  climate_zone: null,
  geodata_provenance: {},
  epw_asset_id: null,
  epw_source_url: null,
  updated_at: null,
  epw: null,
};

export const SET_LOCATION: ProjectLocation = {
  ...UNSET_LOCATION,
  is_set: true,
  latitude: 42.2876,
  longitude: -73.3662,
  elevation_m: 304.8,
  time_zone: "America/New_York",
  true_north_deg: 8,
  street_address: "1 Main St",
  city: "West Stockbridge",
  state: "MA",
  postal_code: "01266",
  full_site_address: "1 Main St, West Stockbridge, MA 01266",
  county: "Berkshire",
  county_fips: "25003",
  country: "US",
  climate_zone: "5A",
  geodata_provenance: {
    county: "fcc_area_api",
    elevation_m: "usgs_epqs",
    climate_zone: "pnnl_2021_iecc",
  },
  updated_at: "2026-06-12T18:00:00Z",
};

export function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  });
}

// A response whose promise only settles once `resolve()` is called — lets a
// test interleave user input with a still-pending location fetch.
export function deferredResponse(body: unknown) {
  let resolve!: () => void;
  const ready = new Promise<void>((next) => {
    resolve = next;
  });
  return {
    resolve,
    response: ready.then(() => jsonResponse(body)),
  };
}

export function stubCrypto() {
  vi.stubGlobal("crypto", {
    randomUUID: () => "req-test",
    subtle: {
      digest: async () => new Uint8Array(32).buffer,
    },
  });
}
