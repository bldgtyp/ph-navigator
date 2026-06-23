import { MapPin, X } from "lucide-react";
import type { ProjectLocation } from "../../projects/types";
import {
  CANONICAL_CLIMATE_KINDS,
  climateSourceBadgeVersion,
  climateSourceStatusChip,
  climateSourceSubtitle,
} from "../lib";
import { useDeleteClimateSourceMutation } from "../hooks";
import type { ClimateSourceKind, PhClimateKind, ProjectClimateSource } from "../types";
import { ClimateStatusChip, ClimateTypeBadge } from "./ClimateAtoms";
import { ClimateMap } from "./ClimateMap";

// "location" | a source id | a `slot:<kind>` empty-state page for an
// unattached canonical type.
export type ClimateSelection = "location" | string;

export function ClimateSourceSidebar({
  projectId,
  location,
  sources,
  selected,
  canEdit,
  onSelect,
  onOpenSetLocation,
  onOpenPicker,
  onOpenWeatherPicker,
  onOpenUploadModal,
}: {
  projectId: string;
  location: ProjectLocation | undefined;
  sources: ProjectClimateSource[];
  selected: ClimateSelection;
  canEdit: boolean;
  onSelect: (selection: ClimateSelection) => void;
  onOpenSetLocation?: () => void;
  onOpenPicker?: (kind: PhClimateKind) => void;
  onOpenWeatherPicker?: () => void;
  onOpenUploadModal?: () => void;
}) {
  const remove = useDeleteClimateSourceMutation(projectId);
  return (
    <aside className="climate-sidebar" aria-label="Climate pages">
      <LocationCard
        location={location}
        active={selected === "location"}
        canEdit={canEdit}
        onSelect={() => onSelect("location")}
        onOpenSetLocation={onOpenSetLocation}
      />

      <div className="climate-side-divider">
        Climate sources
        <span className="line" />
      </div>

      {CANONICAL_CLIMATE_KINDS.map((kind) => {
        const kindSources = sources.filter((source) => source.kind === kind);
        if (kindSources.length === 0) {
          // Every unattached canonical type routes to its own empty-state page,
          // which hosts the "Set from nearest" action (and the picker for PH).
          const slot = `slot:${kind}`;
          return (
            <MissingSourceCard
              key={kind}
              kind={kind}
              active={selected === slot}
              onSelect={canEdit ? () => onSelect(slot) : undefined}
              canEdit={canEdit}
              onOpenPicker={
                kind === "phius" || kind === "phi" ? () => onOpenPicker?.(kind) : undefined
              }
              onOpenWeatherPicker={kind === "weather" ? onOpenWeatherPicker : undefined}
              onOpenUploadModal={kind === "weather" ? onOpenUploadModal : undefined}
            />
          );
        }
        return kindSources.map((source) => {
          const phKind = source.kind === "phius" || source.kind === "phi" ? source.kind : null;
          return (
            <SourceCard
              key={source.id}
              source={source}
              active={selected === source.id}
              onSelect={() => onSelect(source.id)}
              canEdit={canEdit}
              isRemoving={remove.isPending}
              onOpenPicker={phKind ? () => onOpenPicker?.(phKind) : undefined}
              onOpenWeatherPicker={source.kind === "weather" ? onOpenWeatherPicker : undefined}
              onOpenUploadModal={source.kind === "weather" ? onOpenUploadModal : undefined}
              onRemove={
                phKind || source.kind === "weather" ? () => remove.mutate(source.id) : undefined
              }
            />
          );
        });
      })}

      {sources
        .filter((source) => !CANONICAL_CLIMATE_KINDS.includes(source.kind))
        .map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            active={selected === source.id}
            onSelect={() => onSelect(source.id)}
            canEdit={canEdit}
            isRemoving={remove.isPending}
          />
        ))}
    </aside>
  );
}

function LocationCard({
  location,
  active,
  canEdit,
  onSelect,
  onOpenSetLocation,
}: {
  location: ProjectLocation | undefined;
  active: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onOpenSetLocation?: () => void;
}) {
  const cityState = [location?.city ?? location?.county, location?.state]
    .filter(Boolean)
    .join(", ");
  const place = [cityState, location?.postal_code].filter(Boolean).join(" ");
  const coords =
    location?.latitude != null && location?.longitude != null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;
  return (
    <div
      className={["climate-nav-card", "climate-nav-loc", active && "active"]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="climate-nav-loc-select"
        aria-pressed={active}
        onClick={onSelect}
      >
        <ClimateMap
          className="climate-mini-map"
          interactive={false}
          singlePointZoom={7}
          ariaHidden
          project={coords}
        />
        <span className="climate-nav-loc-body">
          <span className="climate-nav-loc-title">Project location</span>
          {canEdit && location?.street_address ? (
            <span className="climate-nav-loc-private">
              <span>{location.street_address}</span>
              <span className="climate-privacy-tag">(private)</span>
            </span>
          ) : null}
          <span className="climate-nav-loc-place">{place || "Location unset"}</span>
        </span>
      </button>
      {active && canEdit && onOpenSetLocation ? (
        <button
          type="button"
          className="primary-button climate-nav-loc-set-button"
          onClick={onOpenSetLocation}
        >
          <MapPin size={14} aria-hidden="true" />
          Set Location
        </button>
      ) : null}
    </div>
  );
}

function SourceCard({
  source,
  active,
  onSelect,
  canEdit,
  isRemoving,
  onOpenPicker,
  onOpenWeatherPicker,
  onOpenUploadModal,
  onRemove,
}: {
  source: ProjectClimateSource;
  active: boolean;
  onSelect: () => void;
  canEdit: boolean;
  isRemoving: boolean;
  onOpenPicker?: () => void;
  onOpenWeatherPicker?: () => void;
  onOpenUploadModal?: () => void;
  onRemove?: () => void;
}) {
  const status = climateSourceStatusChip(source);
  const clearLabel = `Clear ${source.kind === "phius" ? "Phius" : climateSourceKindTitle(source.kind)} Climate Data from Project`;
  const hasSourceActions =
    active && canEdit && (onOpenPicker || onOpenWeatherPicker || onOpenUploadModal || onRemove);
  return (
    <div
      className={[
        "climate-nav-card",
        "climate-source-card",
        hasSourceActions && "has-actions",
        hasSourceActions && onRemove && "has-remove",
        active && "active",
      ]
        .filter(Boolean)
        .join(" ")}
      data-status={status.tone}
    >
      <button
        type="button"
        className="climate-source-select"
        aria-pressed={active}
        onClick={onSelect}
      >
        <span className="climate-nav-top">
          <ClimateTypeBadge kind={source.kind} version={climateSourceBadgeVersion(source)} />
          <span className="climate-nav-status-actions">
            <ClimateStatusChip tone={status.tone} label={status.label} />
          </span>
        </span>
        <span className="climate-nav-name">{climateSourceSubtitle(source)}</span>
      </button>
      {hasSourceActions && onRemove ? (
        <button
          type="button"
          className="climate-source-remove"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={onRemove}
          disabled={isRemoving}
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
      {hasSourceActions && onOpenPicker ? (
        <button
          type="button"
          className="primary-button climate-source-set-button"
          onClick={onOpenPicker}
          disabled={isRemoving}
        >
          {source.kind === "phius" ? "Set Phius Climate Data" : "Set PHI Climate Data"}
        </button>
      ) : null}
      {hasSourceActions && onOpenWeatherPicker ? (
        <button
          type="button"
          className="primary-button climate-source-set-button"
          onClick={onOpenWeatherPicker}
          disabled={isRemoving}
        >
          Select from Map
        </button>
      ) : null}
      {hasSourceActions && onOpenUploadModal ? (
        <button
          type="button"
          className="primary-button climate-source-set-button"
          onClick={onOpenUploadModal}
          disabled={isRemoving}
        >
          Upload Climate Data
        </button>
      ) : null}
    </div>
  );
}

// A canonical climate type with no attached source. Rendered so the four
// required bases are always visible as a checklist.
function MissingSourceCard({
  kind,
  active = false,
  onSelect,
  canEdit,
  onOpenPicker,
  onOpenWeatherPicker,
  onOpenUploadModal,
}: {
  kind: ClimateSourceKind;
  active?: boolean;
  onSelect?: () => void;
  canEdit: boolean;
  onOpenPicker?: () => void;
  onOpenWeatherPicker?: () => void;
  onOpenUploadModal?: () => void;
}) {
  const hasSourceAction =
    active && canEdit && (onOpenPicker || onOpenWeatherPicker || onOpenUploadModal);
  const className = [
    "climate-nav-card",
    "climate-source-card",
    "climate-source-missing",
    hasSourceAction && "has-actions",
    active && "active",
  ]
    .filter(Boolean)
    .join(" ");
  const sourceContent = (
    <>
      <span className="climate-nav-top">
        <ClimateTypeBadge kind={kind} />
        <ClimateStatusChip tone="missing" label="Not set" />
      </span>
      <span className="climate-nav-name">No source attached</span>
    </>
  );
  const body = (
    <>
      {onSelect ? (
        <button
          type="button"
          className="climate-source-select"
          aria-pressed={active}
          onClick={onSelect}
        >
          {sourceContent}
        </button>
      ) : (
        <div className="climate-source-select climate-source-static">{sourceContent}</div>
      )}
      {hasSourceAction && onOpenPicker ? (
        <button
          type="button"
          className="primary-button climate-source-set-button"
          onClick={onOpenPicker}
        >
          {kind === "phius" ? "Set Phius Climate Data" : "Set PHI Climate Data"}
        </button>
      ) : null}
      {hasSourceAction && onOpenWeatherPicker ? (
        <button
          type="button"
          className="primary-button climate-source-set-button"
          onClick={onOpenWeatherPicker}
        >
          Select from Map
        </button>
      ) : null}
      {hasSourceAction && onOpenUploadModal ? (
        <button
          type="button"
          className="primary-button climate-source-set-button"
          onClick={onOpenUploadModal}
        >
          Upload Climate Data
        </button>
      ) : null}
    </>
  );
  return (
    <div className={className} data-status="missing">
      {body}
    </div>
  );
}

function climateSourceKindTitle(kind: ClimateSourceKind): "PHI" | "Weather File" | "Custom" {
  if (kind === "phi") return "PHI";
  if (kind === "weather") return "Weather File";
  return "Custom";
}
