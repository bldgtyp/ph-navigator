import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ClimateMapPinStatus, ClimateMapStation } from "./ClimateMap";

// Imperative Leaflet wrapper for the app's live basemaps (D-DP-6: vanilla
// Leaflet + keyless raster tiles — no key, no proxy, no committed secret). The
// React shell (`ClimateMap`) lazy-imports this only in a real browser; unit
// tests stay on the `placePins` fallback. Distances/verdicts are still computed
// server-side (D-DP-2) — Leaflet only draws.
//
// One controller serves every consumer (P3): the dataset picker (interactive,
// station roster + ring + selection), the Location page (project pin only), the
// sidebar mini-map (static, non-interactive), and the Set-Location pin-drop
// (`onPickPoint`). The handler bag is all-optional so a consumer wires only the
// interactions it needs rather than the picker's contract leaking everywhere.

export type ClimateBasemapStyle = "carto-positron" | "carto-positron-no-labels" | "osm-standard";

type ClimateBasemap = {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
};

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attribution">CARTO</a>`;

const CLIMATE_BASEMAPS: Record<ClimateBasemapStyle, ClimateBasemap> = {
  "carto-positron": {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ["a", "b", "c", "d"],
  },
  "carto-positron-no-labels": {
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    subdomains: ["a", "b", "c", "d"],
  },
  "osm-standard": {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
};

const DEFAULT_BASEMAP_STYLE: ClimateBasemapStyle = "carto-positron";

// The pin colours, resolved from CSS custom properties so they track the active
// theme. Keeping every colour in the CSS token layer means this module holds no
// colour literals (the repo's no-hex guard covers .ts too); the fallbacks are
// CSS colour *keywords*, never hex / colour-function literals.
type Palette = {
  accent: string;
  bgCard: string;
  border: string;
  project: string;
  status: Record<ClimateMapPinStatus, string>;
};

// One `getComputedStyle` per call — resolve the whole palette up front rather
// than re-reading the document root once per pin.
function readPalette(scope: Element = document.documentElement): Palette {
  const scoped = getComputedStyle(scope);
  const root = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string =>
    scoped.getPropertyValue(name).trim() || root.getPropertyValue(name).trim() || fallback;
  const stationPin = read("--climate-map-station-pin", read("--accent", "blue"));
  const mutedStationPin = read(
    "--climate-map-station-pin-muted",
    read("--accent-light", stationPin),
  );
  return {
    accent: read("--accent", "blue"),
    bgCard: read("--bg-card", "white"),
    border: read("--border-strong", "gray"),
    project: read("--climate-map-project-pin", read("--highlight", "red")),
    status: {
      pass: stationPin,
      warning: mutedStationPin,
      fail: mutedStationPin,
      neutral: stationPin,
    },
  };
}

// The geometry + stroke that change when a station pin is (de)selected. Shared
// by the initial build and the in-place restyle so the two can never drift.
function selectionStyle(isSelected: boolean, palette: Palette): L.CircleMarkerOptions {
  return {
    radius: isSelected ? 9 : 6,
    weight: isSelected ? 3 : 2,
    color: isSelected ? palette.accent : palette.bgCard,
  };
}

export type ClimateMapData = {
  project: { latitude: number; longitude: number };
  stations: ClimateMapStation[];
  // The Phius/PHI 50 mi proximity gate, drawn as a reference ring; null = none.
  limitRingMeters: number | null;
};

export type ClimateLeafletController = {
  setData(data: ClimateMapData): void;
  setSelected(selectedId: string | null): void;
  destroy(): void;
};

// Optional per-consumer wiring. `interactive: false` is the static mini-map
// (no pan/zoom/controls). `onSelectStation` is the picker's marker-click;
// `onPickPoint` is the Set-Location pin-drop (click empty map → coordinate).
export type ClimateLeafletOptions = {
  basemapStyle?: ClimateBasemapStyle;
  interactive?: boolean;
  singlePointZoom?: number;
  onSelectStation?: (stationId: string) => void;
  onPickPoint?: (latitude: number, longitude: number) => void;
};

type LocatedStation = ClimateMapStation & { latitude: number; longitude: number };

function isLocated(station: ClimateMapStation): station is LocatedStation {
  return station.latitude !== null && station.longitude !== null;
}

export function createClimateLeafletMap(
  container: HTMLElement,
  options: ClimateLeafletOptions = {},
): ClimateLeafletController {
  const {
    basemapStyle = DEFAULT_BASEMAP_STYLE,
    interactive = true,
    singlePointZoom = 11,
    onSelectStation,
    onPickPoint,
  } = options;
  const basemap = CLIMATE_BASEMAPS[basemapStyle];
  const map = L.map(container, {
    attributionControl: interactive,
    zoomControl: interactive,
    dragging: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
    touchZoom: interactive,
  });
  // Establish a view immediately so the CRS projection is ready before any
  // layer is added (Leaflet throws on projection calls with no view); setData's
  // fitBounds then frames the actual data. Neutral default = US centroid.
  map.setView([39.5, -98.35], 4);
  const tileOptions: L.TileLayerOptions = {
    maxZoom: basemap.maxZoom,
    attribution: basemap.attribution,
  };
  if (basemap.subdomains) tileOptions.subdomains = basemap.subdomains;
  L.tileLayer(basemap.url, tileOptions).addTo(map);
  // Pin-drop: an empty-map click emits a coordinate the caller writes back.
  if (onPickPoint) {
    map.on("click", (event) => onPickPoint(event.latlng.lat, event.latlng.lng));
  }

  // One overlay group we can wipe + rebuild on each data change.
  const overlay = L.layerGroup().addTo(map);
  // Station markers kept by id so selection can restyle them in place.
  const stationMarkers = new Map<string, L.CircleMarker>();
  let selectedId: string | null = null;
  // Whether setData has framed the view at least once (so single-point
  // re-centres preserve the existing zoom rather than resetting it).
  let framed = false;

  function stationStyle(station: LocatedStation, palette: Palette): L.CircleMarkerOptions {
    return {
      ...selectionStyle(station.id === selectedId, palette),
      fillColor: palette.status[station.status ?? "neutral"],
      fillOpacity: 1,
    };
  }

  function setData(data: ClimateMapData): void {
    overlay.clearLayers();
    stationMarkers.clear();
    const palette = readPalette(container);

    const projectLatLng = L.latLng(data.project.latitude, data.project.longitude);
    const located = data.stations.filter(isLocated);
    const bounds = L.latLngBounds([projectLatLng]);

    if (data.limitRingMeters !== null) {
      L.circle(projectLatLng, {
        radius: data.limitRingMeters,
        color: palette.border,
        weight: 2,
        dashArray: "5 5",
        fillColor: palette.accent,
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(overlay);
      // Extend the frame to the ring's footprint without touching the map
      // projection: toBounds() is pure lat/long + metres geometry.
      bounds.extend(projectLatLng.toBounds(data.limitRingMeters * 2));
    }

    L.circleMarker(projectLatLng, {
      radius: 7,
      weight: 3,
      color: palette.bgCard,
      fillColor: palette.project,
      fillOpacity: 1,
      interactive: false,
    }).addTo(overlay);

    for (const station of located) {
      const marker = L.circleMarker([station.latitude, station.longitude], {
        ...stationStyle(station, palette),
        interactive: onSelectStation !== undefined,
      });
      marker.bindTooltip(station.name, { direction: "top" });
      if (onSelectStation) marker.on("click", () => onSelectStation(station.id));
      marker.addTo(overlay);
      stationMarkers.set(station.id, marker);
      bounds.extend(marker.getLatLng());
    }

    if (bounds.isValid() && (located.length > 0 || data.limitRingMeters !== null)) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    } else {
      // Project-pin-only (Location page / mini-map / pin-drop): centre the single
      // point. Keep the zoom the user/initial frame already settled on so a
      // pin-drop re-centre doesn't reset their zoom — only the first frame picks
      // the consumer's configured project-only zoom.
      map.setView(projectLatLng, framed ? map.getZoom() : singlePointZoom);
    }
    framed = true;
    // The modal sizes its grid after mount; nudge Leaflet to remeasure so the
    // first paint isn't a half-loaded tile grid.
    map.invalidateSize();
  }

  function setSelected(nextSelectedId: string | null): void {
    selectedId = nextSelectedId;
    const palette = readPalette(container);
    for (const [id, marker] of stationMarkers) {
      const isSelected = id === selectedId;
      marker.setStyle(selectionStyle(isSelected, palette));
      if (isSelected) marker.bringToFront();
    }
  }

  function destroy(): void {
    map.remove();
  }

  return { setData, setSelected, destroy };
}
