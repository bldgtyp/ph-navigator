import type { ClimatePeakLoad, ClimateRecord } from "../types";

const months = (value: number): number[] => Array.from({ length: 12 }, () => value);

const peak = (temp: number): ClimatePeakLoad => ({
  temp_c: temp,
  rad_north: 45,
  rad_east: 80,
  rad_south: 110,
  rad_west: 75,
  rad_global: 95,
  dewpoint_c: null,
  sky_c: null,
  ground_c: null,
});

// A minimal but complete ClimateRecord for component tests. air_c[0] = 10
// is the IP/SI anchor (10 °C ⇒ 50.0 °F).
export function makeClimateRecord(overrides: Partial<ClimateRecord> = {}): ClimateRecord {
  const air = months(20);
  air[0] = 10;
  return {
    display_name: "Worcester",
    provider: "phius",
    version: "2022",
    station_id: "WORCHESTER_REGIONAL_ARPT_MA",
    phpp_codes: { country_code: "US", region_code: "MA", dataset_name: "Worcester" },
    location: {
      latitude: 42.267,
      longitude: -71.883,
      site_elevation_m: 300,
      climate_zone: 1,
      hours_from_utc: -5,
    },
    climate: {
      station_elevation_m: 300,
      summer_daily_temperature_swing_k: 8.9,
      average_wind_speed_ms: 4.05,
      monthly_temps: {
        air_c: air,
        dewpoint_c: months(5),
        sky_c: months(-10),
        ground_c: months(0),
      },
      monthly_radiation: {
        north: months(30),
        east: months(60),
        south: months(90),
        west: months(60),
        glob: months(120),
      },
      peak_loads: {
        heat_load_1: peak(-12.6),
        heat_load_2: peak(-7.4),
        cooling_load_1: peak(23.8),
        cooling_load_2: peak(0),
      },
    },
    aux: {
      heating_degree_hours_12_20: 99668,
      cooling_degree_hours_24: 907,
      wind_speed_jan_ms: 4.9,
      wind_speed_jul_ms: 3.2,
      temp_min_12h_c: -22.6,
      summer_night_fraction_dry_pct: 30.4,
      summer_night_fraction_humid_pct: 1.5,
      albedo: 0.2,
    },
    ...overrides,
  };
}
