import { useEffect, useRef, useState } from "react";
import type { ClimateProximityVerdict } from "../types";
import type {
  ClimateBasemapStyle,
  ClimateLeafletController,
  ClimateMapData,
} from "./climateLeafletMap";
import "../climate-map.css";

// A station pin's colour tone. The PH picker passes the proximity verdict
// status; the weather picker omits it (no verdict, D4) and gets the neutral pin.
export type ClimateMapPinStatus = ClimateProximityVerdict["status"] | "neutral";

// One station as the map needs it: identity, coordinates (may be null), and an
// optional pin tone (omitted → neutral).
export type ClimateMapStation = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  status?: ClimateMapPinStatus;
};

export type PinPlacement = { x: number; y: number };

type LatLon = { latitude: number; longitude: number };

// Edge padding so pins never sit flush against the map border.
const PAD = 0.12;

// The live Leaflet basemap (D-DP-6) renders everywhere except the unit-test
// runtime, where jsdom has no layout/tiles and tests assert the deterministic
// `placePins` fallback. Same env signal the model-viewer debug hook uses.
const LIVE_MAP = import.meta.env.MODE !== "test";

// Project lat/long onto the 0–100% box the fallback positions pins in. Pure
// display geometry — distances/verdicts come from the backend (D-DP-2), never
// recomputed here. North maps to the top; a zero-span axis (single point or a
// shared coordinate) centres on that axis. Exported for unit testing.
export function placePins(
  project: LatLon,
  stations: { id: string; latitude: number | null; longitude: number | null }[],
): { project: PinPlacement; stations: Record<string, PinPlacement> } {
  const located = stations.filter(
    (station): station is { id: string; latitude: number; longitude: number } =>
      station.latitude !== null && station.longitude !== null,
  );
  const lats = [project.latitude, ...located.map((station) => station.latitude)];
  const lons = [project.longitude, ...located.map((station) => station.longitude)];
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const norm = (value: number, min: number, max: number): number =>
    max === min ? 0.5 : PAD + ((value - min) / (max - min)) * (1 - 2 * PAD);
  const place = (latitude: number, longitude: number): PinPlacement => ({
    x: norm(longitude, minLon, maxLon) * 100,
    y: (1 - norm(latitude, minLat, maxLat)) * 100,
  });

  return {
    project: place(project.latitude, project.longitude),
    stations: Object.fromEntries(
      located.map((station) => [station.id, place(station.latitude, station.longitude)] as const),
    ),
  };
}

type ClimateMapProps = {
  // The project location; null renders the decorative empty surface (no
  // coordinates yet), so callers need no own "is the location set?" guard.
  project: LatLon | null;
  // Roster pins (picker); omit for a project-pin-only map (Location / mini-map).
  stations?: ClimateMapStation[];
  selectedId?: string | null;
  // Station-marker click (picker). Omit on read-only maps.
  onSelectStation?: (stationId: string) => void;
  // Map-click → coordinate (Set-Location pin-drop). Live mode only.
  onPickPoint?: (latitude: number, longitude: number) => void;
  // The proximity gate to draw as a reference ring (metres); null = none.
  limitRingMeters?: number | null;
  // false → static basemap: no pan/zoom/controls (sidebar mini-map).
  interactive?: boolean;
  // Sizing class for the map frame (`.climate-big-map`, `.climate-mini-map`, …).
  className?: string;
  // Accessible label for the map region (ignored when `ariaHidden`).
  ariaLabel?: string;
  // Decorative use (e.g. the sidebar thumbnail): hide from the a11y tree and
  // drop the `group` role so it doesn't pollute an enclosing control's name.
  ariaHidden?: boolean;
  // Defaults to CARTO Positron; callers can opt into the no-label or OSM style.
  basemapStyle?: ClimateBasemapStyle;
};

// The app's one shared map (D-DP-6, P3). In a real browser it mounts a
// vanilla-Leaflet + keyless-OSM basemap; in tests — or if Leaflet fails to load
// — it degrades to the positioned-pin fallback over `.climate-map-surface`. The
// picker passes stations + selection + a ring; the Location page and sidebar
// pass a project pin only; the Set-Location modal passes `onPickPoint`. Both
// render modes honour the same props, so consumers are unaware which is up.
export function ClimateMap({
  project,
  stations = [],
  selectedId = null,
  onSelectStation,
  onPickPoint,
  limitRingMeters = null,
  interactive = true,
  className,
  ariaLabel = "Map",
  ariaHidden = false,
  basemapStyle = "carto-positron",
}: ClimateMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ClimateLeafletController | null>(null);
  const [failed, setFailed] = useState(false);
  const showLive = LIVE_MAP && !failed;

  // The data the async Leaflet init reads once it resolves, and each redraw
  // reads — kept on a ref so it never goes stale. null while the project has no
  // coordinates (the map then renders the decorative empty surface, below).
  const data: ClimateMapData | null = project ? { project, stations, limitRingMeters } : null;
  const latestRef = useRef<{ data: ClimateMapData | null; selectedId: string | null }>({
    data,
    selectedId,
  });
  latestRef.current = { data, selectedId };
  // Handlers can change identity each render; keep them on their own ref so the
  // controller's long-lived listeners always call the current one.
  const handlersRef = useRef({ onSelectStation, onPickPoint });
  handlersRef.current = { onSelectStation, onPickPoint };
  // Whether each interaction is wired is mount-time controller config (a station
  // marker is interactive only if it can be selected; the map listens for clicks
  // only to pin-drop), so a change must re-create the map. The handler
  // *identities* are read via the ref, so they are not deps.
  const canSelectStation = onSelectStation !== undefined;
  const canPickPoint = onPickPoint !== undefined;
  const hasProject = project !== null;

  // Mount Leaflet once per live session (re-create when interactivity or the
  // presence of coordinates flips); apply current state on resolve.
  useEffect(() => {
    if (!showLive || !hasProject || !containerRef.current) return;
    let cancelled = false;
    let controller: ClimateLeafletController | null = null;
    import("./climateLeafletMap")
      .then(({ createClimateLeafletMap }) => {
        const { data } = latestRef.current;
        if (cancelled || !containerRef.current || !data) return;
        controller = createClimateLeafletMap(containerRef.current, {
          basemapStyle,
          interactive,
          onSelectStation: canSelectStation
            ? (id) => handlersRef.current.onSelectStation?.(id)
            : undefined,
          onPickPoint: canPickPoint
            ? (lat, lon) => handlersRef.current.onPickPoint?.(lat, lon)
            : undefined,
        });
        controllerRef.current = controller;
        controller.setData(data);
        controller.setSelected(latestRef.current.selectedId);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Climate basemap unavailable; using positioned-pin fallback.", error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [showLive, hasProject, basemapStyle, interactive, canSelectStation, canPickPoint]);

  // Redraw markers/ring when the roster or project moves; restyle on selection.
  const dataSignature = JSON.stringify({
    p: project && [project.latitude, project.longitude],
    r: limitRingMeters,
    s: stations.map((station) => [station.id, station.latitude, station.longitude, station.status]),
  });
  useEffect(() => {
    const { data } = latestRef.current;
    if (data) controllerRef.current?.setData(data);
  }, [dataSignature]);
  useEffect(() => {
    controllerRef.current?.setSelected(selectedId);
  }, [selectedId]);

  const rootClassName = ["climate-map", "climate-map-surface", className].filter(Boolean).join(" ");

  // No coordinates yet: the decorative empty surface (all hooks above still run
  // so the live map mounts cleanly once a location is set).
  if (!project) {
    return <div className={rootClassName} aria-hidden="true" />;
  }

  const ariaProps = ariaHidden
    ? { "aria-hidden": true as const }
    : { role: "group", "aria-label": ariaLabel };

  return (
    <div className={rootClassName} {...ariaProps}>
      {showLive ? (
        <div ref={containerRef} className="climate-map-canvas" />
      ) : (
        <FallbackPins
          project={project}
          stations={stations}
          selectedId={selectedId}
          onSelectStation={onSelectStation}
        />
      )}
    </div>
  );
}

// Key-less / test rendering: positioned pins over the decorative surface,
// placed by the pure `placePins` geometry (no tiles, no DOM measurement). The
// pin-drop (`onPickPoint`) is live-only — the fallback box has no projection —
// so this path covers the project pin and optional station selection.
function FallbackPins({
  project,
  stations,
  selectedId,
  onSelectStation,
}: {
  project: LatLon;
  stations: ClimateMapStation[];
  selectedId: string | null;
  onSelectStation?: (stationId: string) => void;
}) {
  const placement = placePins(project, stations);
  const stationById = new Map(stations.map((station) => [station.id, station] as const));

  return (
    <>
      <span
        className="climate-map-pin climate-map-pin--project"
        style={{ left: `${placement.project.x}%`, top: `${placement.project.y}%` }}
        aria-hidden="true"
      />
      {onSelectStation
        ? Object.entries(placement.stations).map(([id, pin]) => {
            const station = stationById.get(id);
            return (
              <button
                key={id}
                type="button"
                className="climate-map-station-pin"
                data-status={station?.status}
                data-selected={id === selectedId}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                aria-label={station ? `Select ${station.name}` : "Select station"}
                aria-pressed={id === selectedId}
                onClick={() => onSelectStation(id)}
              />
            );
          })
        : null}
    </>
  );
}
