import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useProjectLocationQuery } from "../../projects/hooks";
import {
  useClimateDatasetRosterQuery,
  useClimateSourcesQuery,
  useCreateClimateSourceMutation,
} from "../hooks";
import { climateSourceKindLabel, datasetLabel, type ClimateStatusTone } from "../lib";
import type {
  ClimateDatasetRosterItem,
  ClimateProximityVerdict,
  ClimateRosterSearch,
  PhClimateKind,
} from "../types";
import { US_STATES } from "../us-states";
import { ClimateMap } from "./ClimateMap";
import { ClimateStatusChip } from "./ClimateAtoms";
import "../climate-picker.css";

// Select sentinel for the any-state nearest mode (O-DP-3); distinct from a
// 2-letter state code.
const ANY_STATE = "__any__";
const STATE_OPTIONS = [
  { value: ANY_STATE, label: "Nearest to project (any state)" },
  ...US_STATES.map((state) => ({ value: state.code, label: state.name })),
];

// The 50 mi proximity gate (D-CL-17), drawn on the live basemap as a reference
// ring. 50 mi = 80,467 m; both PH kinds reference the same distance.
const PROXIMITY_LIMIT_METERS = 80_467;

// The manual climate-dataset picker (D-DP-1): one generic modal mounted with
// `kind="phius"` or `kind="phi"`. Browses a PH dataset's stations for the
// project — filtered by state (default = the project's), each with the
// backend-computed proximity verdict — and attaches the chosen one. The map is
// the live Leaflet/OSM basemap (D-DP-6), with a positioned-pin fallback in tests.
export function ClimateDatasetPickerModal({
  projectId,
  kind,
  onClose,
  onRequestSetLocation,
}: {
  projectId: string;
  kind: PhClimateKind;
  onClose: () => void;
  onRequestSetLocation?: () => void;
}) {
  const kindLabel = climateSourceKindLabel(kind);
  const titleId = "climate-picker-title";

  const locationQuery = useProjectLocationQuery(projectId);
  const location = locationQuery.data;
  const locationIsSet = Boolean(
    location?.is_set && location.latitude !== null && location.longitude !== null,
  );

  // null = use the project's state (region omitted); ANY_STATE = nearest across
  // all states; otherwise an explicit state code.
  const [regionMode, setRegionMode] = useState<string | null>(null);
  const search: ClimateRosterSearch =
    regionMode === null ? {} : regionMode === ANY_STATE ? { near: true } : { region: regionMode };
  const rosterQuery = useClimateDatasetRosterQuery(projectId, kind, search, {
    enabled: locationIsSet,
  });
  const roster = rosterQuery.data;
  const items = roster?.items ?? [];

  const existingSources = useClimateSourcesQuery(projectId).data ?? [];
  const hasExisting = existingSources.some((source) => source.kind === kind);

  const create = useCreateClimateSourceMutation(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  // The select shows the explicit choice, else the project's own state (which
  // is the region the roster defaults to when none is passed).
  const selectValue = regionMode ?? location?.state ?? roster?.project.state ?? "";

  function changeRegion(value: string): void {
    setRegionMode(value);
    setSelectedId(null);
  }

  function attach(): void {
    if (!selected) return;
    create.mutate({ kind, ref: selected.id, label: selected.name }, { onSuccess: onClose });
  }

  return (
    <ModalDialog
      id="climate-picker"
      title={`Select ${kindLabel} climate dataset`}
      titleId={titleId}
      onClose={onClose}
    >
      {locationQuery.isLoading ? (
        <p className="form-note">Loading project location…</p>
      ) : !locationIsSet ? (
        <div className="climate-picker-guard">
          <p>Set the project location first — proximity needs a site.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
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
      ) : (
        <div className="climate-picker-content">
          <div className="climate-picker-toolbar">
            {roster?.dataset ? (
              <p className="modal-subtitle">
                {datasetLabel(
                  roster.dataset.label,
                  roster.dataset.provider,
                  roster.dataset.version,
                )}
                {roster.total > 0 ? ` · ${roster.total} stations` : ""}
              </p>
            ) : null}
            <AutocompleteSelect
              className="climate-picker-filter"
              label="State"
              value={selectValue}
              options={STATE_OPTIONS}
              emptyMessage="No states match"
              onChange={changeRegion}
            />
          </div>

          <PickerBody
            isLoading={rosterQuery.isLoading}
            error={rosterQuery.error}
            kindLabel={kindLabel}
            datasetMissing={roster != null && roster.dataset === null}
            project={roster?.project ?? null}
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {selected ? <SelectionPreview kind={kind} proximity={selected.proximity} /> : null}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" onClick={attach} disabled={!selected || create.isPending}>
              {create.isPending ? "Attaching…" : hasExisting ? "Replace current dataset" : "Attach"}
            </button>
          </div>
          {create.error ? (
            <p className="form-error">
              {errorMessage(create.error, "Could not attach the dataset.")}
            </p>
          ) : null}
        </div>
      )}
    </ModalDialog>
  );
}

function PickerBody({
  isLoading,
  error,
  kindLabel,
  datasetMissing,
  project,
  items,
  selectedId,
  onSelect,
}: {
  isLoading: boolean;
  error: unknown;
  kindLabel: string;
  datasetMissing: boolean;
  project: { latitude: number; longitude: number } | null;
  items: ClimateDatasetRosterItem[];
  selectedId: string | null;
  onSelect: (stationId: string) => void;
}) {
  if (isLoading) return <p className="form-note">Loading stations…</p>;
  if (error) {
    return <p className="form-error">{errorMessage(error, "Could not load climate stations.")}</p>;
  }
  if (datasetMissing) {
    return <p className="form-note">No {kindLabel} dataset is available yet.</p>;
  }
  if (items.length === 0 || project === null) {
    return <p className="form-note">No {kindLabel} stations match this filter.</p>;
  }

  return (
    <div className="climate-picker-body">
      <ClimateMap
        className="climate-picker-map"
        ariaLabel="Station map"
        project={project}
        stations={items.map((item) => ({
          id: item.id,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          status: item.proximity.status,
        }))}
        selectedId={selectedId}
        onSelectStation={onSelect}
        limitRingMeters={PROXIMITY_LIMIT_METERS}
      />
      <ul className="climate-picker-list">
        {items.map((item) => {
          const chip = verdictChip(item.proximity.status);
          return (
            <li key={item.id}>
              <button
                type="button"
                className="climate-picker-row"
                data-selected={item.id === selectedId}
                onClick={() => onSelect(item.id)}
              >
                <span className="climate-picker-row-name">{item.name}</span>
                <span className="climate-picker-row-metrics">
                  <span>{item.proximity.distance_mi.toFixed(1)} mi</span>
                  <span>{formatDeltaFt(item.proximity.elevation_delta_ft)}</span>
                  {item.climate_zone ? <span>Zone {item.climate_zone}</span> : null}
                </span>
                <ClimateStatusChip tone={chip.tone} label={chip.label} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SelectionPreview({
  kind,
  proximity,
}: {
  kind: PhClimateKind;
  proximity: ClimateProximityVerdict;
}) {
  const chip = verdictChip(proximity.status);
  return (
    <div className="climate-picker-preview" data-status={proximity.status}>
      <ClimateStatusChip tone={chip.tone} label={chip.label} />
      <p>{proximity.message}</p>
      {kind === "phius" && proximity.status === "fail" ? (
        <p className="climate-picker-warning">
          This station fails the Phius 50 mi / 400 ft gate. You can attach it as a working basis,
          but a custom climate set is required for certification.
        </p>
      ) : null}
    </div>
  );
}

const VERDICT_LABELS: Record<ClimateProximityVerdict["status"], string> = {
  pass: "Pass",
  warning: "Check",
  fail: "Fail",
};

// The verdict status is itself the chip tone; only the label is mapped.
function verdictChip(status: ClimateProximityVerdict["status"]): {
  tone: ClimateStatusTone;
  label: string;
} {
  return { tone: status, label: VERDICT_LABELS[status] };
}

function formatDeltaFt(elevationDeltaFt: number | null): string {
  return elevationDeltaFt === null ? "Δ — ft" : `Δ ${elevationDeltaFt.toFixed(0)} ft`;
}
