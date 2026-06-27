import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useProjectLocationQuery } from "../../projects/hooks";
import { useAttachWeatherFromCatalogMutation, useEpwRosterQuery } from "../hooks";
import { formatDeltaFt } from "../lib";
import type { EpwRosterItem, EpwRosterSearch, ProjectClimateSource } from "../types";
import { ANY_STATE, STATE_FILTER_OPTIONS } from "../us-states";
import { ClimateMap } from "./ClimateMap";
import "../climate-picker.css";

// The weather "Select from map" picker: browses the OneBuilding EPW catalog for
// the project — filtered by state (default = the project's) — and attaches the
// chosen station's EPW + STAT bundle. Mirrors the PH dataset picker's UX but
// carries no certification verdict (D4): distance / elevation delta are shown
// for orientation only, and every pin is neutral. The map is the same shared
// Leaflet/OSM basemap, with a positioned-pin fallback in tests.
export function WeatherStationPickerModal({
  projectId,
  onClose,
  onRequestSetLocation,
  onOpenUploadModal,
  onAttached,
}: {
  projectId: string;
  onClose: () => void;
  onRequestSetLocation?: () => void;
  onOpenUploadModal?: () => void;
  onAttached?: (source: ProjectClimateSource) => void;
}) {
  const titleId = "weather-picker-title";

  const locationQuery = useProjectLocationQuery(projectId);
  const location = locationQuery.data;
  const locationIsSet = Boolean(
    location?.is_set && location.latitude !== null && location.longitude !== null,
  );

  // null = use the project's state (region omitted); ANY_STATE = nearest across
  // all states; otherwise an explicit state code.
  const [regionMode, setRegionMode] = useState<string | null>(null);
  const search: EpwRosterSearch =
    regionMode === null ? {} : regionMode === ANY_STATE ? { near: true } : { region: regionMode };
  const rosterQuery = useEpwRosterQuery(projectId, search, { enabled: locationIsSet });
  const roster = rosterQuery.data;
  const items = roster?.items ?? [];

  const attach = useAttachWeatherFromCatalogMutation(projectId);

  // A station is keyed by its catalog URL (the roster has no synthetic id).
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const selected = items.find((item) => item.source_url === selectedUrl) ?? null;

  const selectValue = regionMode ?? location?.state ?? roster?.project.state ?? "";

  function changeRegion(value: string): void {
    setRegionMode(value);
    setSelectedUrl(null);
  }

  function runAttach(): void {
    if (!selected) return;
    attach.mutate(selected.source_url, {
      onSuccess: (source) => {
        onAttached?.(source);
        onClose();
      },
    });
  }

  function openUpload(): void {
    onClose();
    onOpenUploadModal?.();
  }

  return (
    <ModalDialog
      id="weather-picker"
      title="Set Hourly Climate Data"
      titleId={titleId}
      onClose={onClose}
    >
      {locationQuery.isLoading ? (
        <p className="form-note">Loading project location…</p>
      ) : !locationIsSet ? (
        <div className="climate-picker-guard">
          <p>Set the project location first — the nearest stations need a site.</p>
          <div className="modal-actions climate-picker-actions">
            <div className="climate-picker-actions-secondary">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              {onOpenUploadModal ? (
                <button type="button" className="secondary-button" onClick={openUpload}>
                  Upload Climate Data
                </button>
              ) : null}
            </div>
            <div className="climate-picker-actions-primary">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestSetLocation?.();
                }}
              >
                Set the project location
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="climate-picker-content">
          <div className="climate-picker-toolbar">
            <p className="modal-subtitle">
              OneBuilding TMYx catalog
              {roster && roster.total > 0 ? ` · ${roster.total} weather files` : ""}
            </p>
            <AutocompleteSelect
              className="climate-picker-filter"
              label="State"
              value={selectValue}
              options={STATE_FILTER_OPTIONS}
              emptyMessage="No states match"
              onChange={changeRegion}
            />
          </div>

          <WeatherPickerBody
            isLoading={rosterQuery.isLoading}
            error={rosterQuery.error}
            project={roster?.project ?? null}
            items={items}
            selectedUrl={selectedUrl}
            onSelect={setSelectedUrl}
          />

          {selected ? <WeatherSelectionPreview item={selected} /> : null}

          <div className="modal-actions climate-picker-actions">
            <div className="climate-picker-actions-secondary">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              {onOpenUploadModal ? (
                <button type="button" className="secondary-button" onClick={openUpload}>
                  Upload Climate Data
                </button>
              ) : null}
            </div>
            <div className="climate-picker-actions-primary">
              <button type="button" onClick={runAttach} disabled={!selected || attach.isPending}>
                {attach.isPending ? "Attaching…" : "Attach weather file"}
              </button>
            </div>
          </div>
          {attach.error ? (
            <p className="form-error">
              {errorMessage(attach.error, "Could not attach the weather file.")}
            </p>
          ) : null}
        </div>
      )}
    </ModalDialog>
  );
}

function WeatherPickerBody({
  isLoading,
  error,
  project,
  items,
  selectedUrl,
  onSelect,
}: {
  isLoading: boolean;
  error: unknown;
  project: { latitude: number; longitude: number } | null;
  items: EpwRosterItem[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
}) {
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!selectedUrl) return;
    selectedRowRef.current?.scrollIntoView?.({ block: "center", inline: "nearest" });
  }, [selectedUrl]);

  if (isLoading) return <p className="form-note">Loading stations…</p>;
  if (error) {
    return <p className="form-error">{errorMessage(error, "Could not load weather stations.")}</p>;
  }
  if (items.length === 0 || project === null) {
    return <p className="form-note">No weather stations match this filter.</p>;
  }

  return (
    <div className="climate-picker-body">
      <ClimateMap
        className="climate-picker-map"
        ariaLabel="Weather station map"
        project={project}
        stations={items.map((item) => ({
          id: item.source_url,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
        }))}
        selectedId={selectedUrl}
        onSelectStation={onSelect}
      />
      <ul className="climate-picker-list">
        {items.map((item) => (
          <li key={item.source_url}>
            <button
              ref={item.source_url === selectedUrl ? selectedRowRef : null}
              type="button"
              className="climate-picker-row"
              data-selected={item.source_url === selectedUrl}
              onClick={() => onSelect(item.source_url)}
            >
              <span className="climate-picker-row-name">{item.name}</span>
              <span className="climate-picker-row-version">{item.version_label}</span>
              <span className="climate-picker-row-metrics">
                <span>{formatDistance(item.distance_mi)}</span>
                <span>{formatDeltaFt(item.elevation_delta_ft)}</span>
                {item.region ? <span>{item.region}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeatherSelectionPreview({ item }: { item: EpwRosterItem }) {
  return (
    <div className="climate-picker-preview">
      <p>
        {item.name} ({item.version_label}) — {formatDistance(item.distance_mi)} ·{" "}
        {formatDeltaFt(item.elevation_delta_ft)}
      </p>
    </div>
  );
}

function formatDistance(distanceMi: number | null): string {
  return distanceMi === null ? "— mi" : `${distanceMi.toFixed(1)} mi`;
}
