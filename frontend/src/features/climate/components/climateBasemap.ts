// The climate-area basemap catalogue (D-DP-6, amended for the CARTO Basemaps
// API-key requirement — see planning/features/climate-basemap-api-key/ and the
// linked GitHub issue). Kept Leaflet-free and statically importable so the
// React shell can resolve the default style before (and without) lazy-loading
// the imperative Leaflet controller.
//
// CARTO now requires a Basemaps API key on every tile URL (announced
// 2026-09-23; key serves as a public, referrer-restricted browser credential,
// not a server secret). The key is injected at build time via
// VITE_CARTO_BASEMAP_KEY and read at call time so tests can stub it. With no
// key configured the CARTO styles would render CARTO's "API KEY REQUIRED"
// watermark placeholder tiles, so the app default degrades to the keyless OSM
// standard style instead (explicit style choices are still honoured).

export type ClimateBasemapStyle = "carto-positron" | "carto-positron-no-labels" | "osm-standard";

export type ClimateBasemap = {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
};

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attribution">CARTO</a>`;

// Read per call (not at module init) so `vi.stubEnv` can exercise both states.
function cartoBasemapKey(): string {
  return (import.meta.env.VITE_CARTO_BASEMAP_KEY ?? "").trim();
}

// Append the key parameter to a CARTO tile URL template. Leaflet replaces its
// own `{s}/{z}/{x}/{y}{r}` tokens and passes the query string through.
function cartoUrl(path: string): string {
  const key = cartoBasemapKey();
  const url = `https://{s}.basemaps.cartocdn.com${path}`;
  return key ? `${url}?key=${encodeURIComponent(key)}` : url;
}

const CARTO_TILE_PATHS: Record<"carto-positron" | "carto-positron-no-labels", string> = {
  "carto-positron": "/light_all/{z}/{x}/{y}{r}.png",
  "carto-positron-no-labels": "/light_nolabels/{z}/{x}/{y}{r}.png",
};

export function climateBasemap(style: ClimateBasemapStyle): ClimateBasemap {
  if (style === "osm-standard") {
    return {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    };
  }
  return {
    url: cartoUrl(CARTO_TILE_PATHS[style]),
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ["a", "b", "c", "d"],
  };
}

// The app-wide default: CARTO Positron when a key is configured, else the
// keyless OSM standard style (never a watermarked CARTO tile).
export function defaultBasemapStyle(): ClimateBasemapStyle {
  return cartoBasemapKey() ? "carto-positron" : "osm-standard";
}
