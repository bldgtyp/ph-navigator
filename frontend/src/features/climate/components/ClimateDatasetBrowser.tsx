import { useState } from "react";
import { MapPin } from "lucide-react";
import type { UnitSystem } from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import {
  useClimateDatasetsQuery,
  useClimateLocationQuery,
  useClimateLocationsQuery,
} from "../hooks";
import { datasetLabel, formatLatLong, locationSubtitle } from "../lib";
import type { ClimateLocationSearch, ClimateLocationSummary } from "../types";
import { ClimateRecordTable } from "./ClimateRecordTable";

const PAGE_SIZE = 25;

// Browse the app-wide reference datasets: pick a dataset version, filter
// its locations by country/region (or nearest-to-project), and inspect one
// location's standardized record. When `onAttach` is supplied (editors), the
// selected Phius/PHI location can be attached to the project as a source.
export function ClimateDatasetBrowser({
  unitSystem,
  projectCoords,
  onAttach,
  attachPending = false,
}: {
  unitSystem: UnitSystem;
  projectCoords: { latitude: number; longitude: number } | null;
  onAttach?: (source: { kind: "phius" | "phi"; ref: string; label: string }) => void;
  attachPending?: boolean;
}) {
  const datasetsQuery = useClimateDatasetsQuery();
  const [datasetId, setDatasetId] = useState<string | undefined>(undefined);
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [nearest, setNearest] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);

  // The dataset picker defaults to the first dataset once loaded.
  const datasets = datasetsQuery.data ?? [];
  const activeDatasetId = datasetId ?? datasets[0]?.id;

  const search: ClimateLocationSearch =
    nearest && projectCoords
      ? { near: projectCoords, limit: PAGE_SIZE }
      : {
          country: country.trim() || undefined,
          region: region.trim() || undefined,
          limit: PAGE_SIZE,
        };
  const locationsQuery = useClimateLocationsQuery(activeDatasetId, search);
  const detailQuery = useClimateLocationQuery(activeDatasetId, selectedLocationId);
  const detail = detailQuery.data;

  // Only Phius/PHI datasets pin to a project source (D-CL-4); the kind is
  // the active dataset's provider.
  const activeDataset = datasets.find((dataset) => dataset.id === activeDatasetId);
  const attachKind: "phius" | "phi" | null =
    activeDataset?.provider === "phius" || activeDataset?.provider === "phi"
      ? activeDataset.provider
      : null;

  const selectDataset = (id: string) => {
    setDatasetId(id);
    setSelectedLocationId(undefined);
  };

  if (datasetsQuery.isLoading) {
    return <p className="form-note">Loading climate datasets…</p>;
  }
  if (datasetsQuery.error) {
    return (
      <p className="form-error">
        {errorMessage(datasetsQuery.error, "Could not load climate datasets.")}
      </p>
    );
  }
  if (datasets.length === 0) {
    return <p className="form-note">No reference climate datasets have been seeded yet.</p>;
  }

  return (
    <div className="climate-browser">
      <div className="climate-browser-controls">
        <label>
          <span>Dataset</span>
          <select value={activeDatasetId} onChange={(event) => selectDataset(event.target.value)}>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {datasetLabel(dataset.label, dataset.provider, dataset.version)} (
                {dataset.location_count})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Country</span>
          <input
            value={country}
            disabled={nearest}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="US"
          />
        </label>
        <label>
          <span>Region</span>
          <input
            value={region}
            disabled={nearest}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="MA"
          />
        </label>
        {projectCoords ? (
          <button
            type="button"
            className={nearest ? "secondary-button active" : "secondary-button"}
            onClick={() => setNearest((value) => !value)}
          >
            <MapPin size={16} aria-hidden="true" />
            {nearest ? "Showing nearest" : "Nearest to project"}
          </button>
        ) : null}
      </div>

      <div className="climate-browser-body">
        <ClimateLocationList
          isLoading={locationsQuery.isLoading}
          error={locationsQuery.error}
          total={locationsQuery.data?.total ?? 0}
          items={locationsQuery.data?.items ?? []}
          selectedLocationId={selectedLocationId}
          onSelect={setSelectedLocationId}
        />
        <div className="climate-browser-detail">
          {selectedLocationId == null ? (
            <p className="form-note">Select a location to view its climate record.</p>
          ) : detailQuery.isLoading ? (
            <p className="form-note">Loading record…</p>
          ) : detailQuery.error ? (
            <p className="form-error">
              {errorMessage(detailQuery.error, "Could not load the climate record.")}
            </p>
          ) : detail ? (
            <>
              <div className="climate-detail-header">
                <h4 className="climate-detail-title">{detail.name}</h4>
                {onAttach && attachKind ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={attachPending}
                    onClick={() =>
                      onAttach({ kind: attachKind, ref: detail.id, label: detail.name })
                    }
                  >
                    {attachPending ? "Attaching…" : "Attach as source"}
                  </button>
                ) : null}
              </div>
              <ClimateRecordTable record={detail.record} unitSystem={unitSystem} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ClimateLocationList({
  isLoading,
  error,
  total,
  items,
  selectedLocationId,
  onSelect,
}: {
  isLoading: boolean;
  error: unknown;
  total: number;
  items: ClimateLocationSummary[];
  selectedLocationId: string | undefined;
  onSelect: (locationId: string) => void;
}) {
  if (isLoading) return <p className="form-note">Loading locations…</p>;
  if (error)
    return <p className="form-error">{errorMessage(error, "Could not load locations.")}</p>;
  if (items.length === 0) return <p className="form-note">No locations match this filter.</p>;

  return (
    <div className="climate-location-list">
      <p className="climate-location-count">
        {items.length} of {total} location{total === 1 ? "" : "s"}
      </p>
      <ul>
        {items.map((location) => (
          <li key={location.id}>
            <button
              type="button"
              className={location.id === selectedLocationId ? "active" : ""}
              onClick={() => onSelect(location.id)}
            >
              <span className="climate-location-name">{locationSubtitle(location)}</span>
              <span className="climate-location-coords">
                {formatLatLong(location.latitude, location.longitude)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
