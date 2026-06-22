import type { ClimateProximityVerdict } from "../types";

// One station as the map needs it: identity, coordinates (may be null), and its
// proximity verdict's status (which colours the pin).
export type ClimateMapStation = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  status: ClimateProximityVerdict["status"];
};

export type PinPlacement = { x: number; y: number };

type LatLon = { latitude: number; longitude: number };

// Edge padding so pins never sit flush against the map border.
const PAD = 0.12;

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

// The picker's map. For now this is the key-less fallback: a positioned-pin
// backdrop over the decorative `.climate-map-surface`. P2b mounts a
// MapLibre/MapTiler basemap behind these pins once O4 (key + vetted dep + tile
// proxy) lands; the pin geometry (placePins) is shared between both modes.
export function ClimateMap({
  project,
  stations,
  selectedId,
  onSelect,
}: {
  project: LatLon;
  stations: ClimateMapStation[];
  selectedId: string | null;
  onSelect: (stationId: string) => void;
}) {
  const placement = placePins(project, stations);
  const statusById = new Map(stations.map((station) => [station.id, station] as const));

  return (
    <div className="climate-picker-map climate-map-surface" role="group" aria-label="Station map">
      <span
        className="climate-map-pin climate-map-pin--project"
        style={{ left: `${placement.project.x}%`, top: `${placement.project.y}%` }}
        aria-hidden="true"
      />
      {Object.entries(placement.stations).map(([id, pin]) => {
        const station = statusById.get(id);
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
            onClick={() => onSelect(id)}
          />
        );
      })}
    </div>
  );
}
