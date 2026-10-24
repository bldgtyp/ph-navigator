import { afterEach, describe, expect, test, vi } from "vitest";
import { climateBasemap, defaultBasemapStyle } from "../components/climateBasemap";

// Key/fallback contract: climateBasemap.ts (planning/features/climate-basemap-api-key/).

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("climateBasemap", () => {
  test("appends the configured key to CARTO tile URLs", () => {
    vi.stubEnv("VITE_CARTO_BASEMAP_KEY", "test-key-123");
    const basemap = climateBasemap("carto-positron");
    expect(basemap.url).toBe(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=test-key-123",
    );
    expect(basemap.attribution).toContain("CARTO");
  });

  test("omits the key parameter when none is configured", () => {
    vi.stubEnv("VITE_CARTO_BASEMAP_KEY", "");
    expect(climateBasemap("carto-positron").url).not.toContain("key=");
  });

  test("encodes key material into the query string", () => {
    vi.stubEnv("VITE_CARTO_BASEMAP_KEY", "a b&c");
    expect(climateBasemap("carto-positron-no-labels").url).toContain("key=a%20b%26c");
  });

  test("keeps the OSM standard style keyless", () => {
    vi.stubEnv("VITE_CARTO_BASEMAP_KEY", "test-key-123");
    const basemap = climateBasemap("osm-standard");
    expect(basemap.url).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(basemap.attribution).toContain("OpenStreetMap");
    expect(basemap.attribution).not.toContain("CARTO");
  });
});

describe("defaultBasemapStyle", () => {
  test("prefers CARTO Positron when a key is configured", () => {
    vi.stubEnv("VITE_CARTO_BASEMAP_KEY", "test-key-123");
    expect(defaultBasemapStyle()).toBe("carto-positron");
  });

  test("degrades to the keyless OSM standard style without a key", () => {
    vi.stubEnv("VITE_CARTO_BASEMAP_KEY", "");
    expect(defaultBasemapStyle()).toBe("osm-standard");
  });

  test("treats a whitespace-only key as absent", () => {
    vi.stubEnv("VITE_CARTO_BASEMAP_KEY", "   ");
    expect(defaultBasemapStyle()).toBe("osm-standard");
  });
});
