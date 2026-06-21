// Wire contracts for the climate feature. The reference datasets (Phius,
// PHI/PHPP) are app-scoped, mirroring backend `features/climate/models.py`
// + `record.py`; the project-scoped climate *sources* at the bottom mirror
// `features/project_climate_source/models.py`.

export type ClimateDataset = {
  id: string;
  provider: string;
  version: string;
  label: string | null;
  source: string | null;
  created_at: string;
  location_count: number;
};

export type ClimateDatasetListResponse = {
  items: ClimateDataset[];
};

// List/search projection — identity + coordinates, not the full record.
export type ClimateLocationSummary = {
  id: string;
  dataset_id: string;
  name: string;
  country: string | null;
  region: string | null;
  climate_zone: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  station_id: string | null;
};

export type ClimateLocationListResponse = {
  items: ClimateLocationSummary[];
  total: number;
};

// A length-12 monthly series (Jan…Dec), SI units per the owning field.
export type Monthly12 = number[];

export type ClimatePeakLoad = {
  temp_c: number;
  rad_north: number;
  rad_east: number;
  rad_south: number;
  rad_west: number;
  rad_global: number;
  dewpoint_c: number | null;
  sky_c: number | null;
  ground_c: number | null;
};

export type ClimateRecord = {
  display_name: string;
  provider: string | null;
  version: string | null;
  station_id: string | null;
  phpp_codes: {
    country_code: string;
    region_code: string;
    dataset_name: string;
  };
  location: {
    latitude: number;
    longitude: number;
    site_elevation_m: number | null;
    climate_zone: number;
    hours_from_utc: number;
  };
  climate: {
    station_elevation_m: number;
    summer_daily_temperature_swing_k: number;
    average_wind_speed_ms: number;
    monthly_temps: {
      air_c: Monthly12;
      dewpoint_c: Monthly12;
      sky_c: Monthly12;
      ground_c: Monthly12;
    };
    monthly_radiation: {
      north: Monthly12;
      east: Monthly12;
      south: Monthly12;
      west: Monthly12;
      glob: Monthly12;
    };
    peak_loads: {
      heat_load_1: ClimatePeakLoad;
      heat_load_2: ClimatePeakLoad;
      cooling_load_1: ClimatePeakLoad;
      cooling_load_2: ClimatePeakLoad;
    };
  };
  aux: {
    heating_degree_hours_12_20: number | null;
    cooling_degree_hours_24: number | null;
    wind_speed_jan_ms: number | null;
    wind_speed_jul_ms: number | null;
    temp_min_12h_c: number | null;
    summer_night_fraction_dry_pct: number | null;
    summer_night_fraction_humid_pct: number | null;
    albedo: number | null;
  };
};

export type ClimateLocationDetail = ClimateLocationSummary & {
  record: ClimateRecord;
};

// Filters for the location search endpoint. `near` switches to
// nearest-station ranking; otherwise country/region filter + paginate.
export type ClimateLocationSearch = {
  country?: string;
  region?: string;
  near?: { latitude: number; longitude: number };
  limit?: number;
  offset?: number;
};

// ---- Project-scoped climate sources (Phase 3b) ----
// Mirrors backend `features/project_climate_source/models.py`. `ref`/`data`
// are interpreted by `kind`: phius/phi → ref is a reference-location id and
// data may hold proximity flags; epw → ref is the project EPW asset id and
// data may hold STAT metrics; ashrae → ref is a station id and data may hold
// design conditions; custom → data is a standardized ClimateRecord.
export type ClimateSourceKind = "phius" | "phi" | "ashrae" | "epw" | "custom";

export type ProjectClimateSource = {
  id: string;
  project_id: string;
  kind: ClimateSourceKind;
  ref: string | null;
  label: string | null;
  is_default: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ProjectClimateSourceListResponse = {
  items: ProjectClimateSource[];
};

export type CreateClimateSourceRequest = {
  kind: ClimateSourceKind;
  ref?: string | null;
  label?: string | null;
  is_default?: boolean;
  data?: Record<string, unknown> | null;
};

// ---- Sun-path diagram (Phase 3c) ----
// Mirrors the backend `SunPathAndCompassDTOSchema` (ladybug geometry, served
// by GET /projects/{id}/sun-path). Origin-centered, unit-radius; the frontend
// projects it top-down to a 2D SVG. Defined here rather than imported from
// `model_viewer` because the climate→model_viewer import direction is
// forbidden (imports flow one-way, model_viewer→climate).
export type Vec3 = [number, number, number];

export type SunPathPlane = { n: Vec3; o: Vec3; x: Vec3 };

export type Polyline3D = { vertices: Vec3[] };

export type Arc3D = { plane: SunPathPlane; radius: number; a1: number; a2: number };

export type Arc2D = { c: [number, number]; r: number; a1: number; a2: number };

export type LineSegment2D = { p: [number, number]; v: [number, number] };

export type SunPathAndCompass = {
  sunpath: {
    hourly_analemma_polyline3d: Polyline3D[];
    monthly_day_arc3d: Arc3D[];
  };
  compass: {
    all_boundary_circles: Arc2D[];
    major_azimuth_ticks: LineSegment2D[];
    minor_azimuth_ticks: LineSegment2D[];
  };
};
