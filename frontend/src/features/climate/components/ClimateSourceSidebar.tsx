import { MapPin } from "lucide-react";
import type { UnitSystem } from "../../../lib/units";
import type { ProjectLocation } from "../../projects/types";
import {
  CANONICAL_CLIMATE_KINDS,
  climateSourceBadgeVersion,
  climateSourceNavAttrs,
  climateSourceStatusChip,
  climateSourceSubtitle,
  formatLatLong,
  formatLocationElevationLabel,
} from "../lib";
import type { ClimateSourceKind, ProjectClimateSource } from "../types";
import { ClimateStatusChip, ClimateTypeBadge } from "./ClimateAtoms";
import { ClimateMap } from "./ClimateMap";

// "location" | a source id | a `slot:<kind>` empty-state page for an
// unattached canonical type.
export type ClimateSelection = "location" | string;

export function ClimateSourceSidebar({
  location,
  sources,
  selected,
  canEdit,
  unitSystem,
  onSelect,
  onOpenSetLocation,
}: {
  location: ProjectLocation | undefined;
  sources: ProjectClimateSource[];
  selected: ClimateSelection;
  canEdit: boolean;
  unitSystem: UnitSystem;
  onSelect: (selection: ClimateSelection) => void;
  onOpenSetLocation?: () => void;
}) {
  return (
    <aside className="climate-sidebar" aria-label="Climate pages">
      <LocationCard
        location={location}
        unitSystem={unitSystem}
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
            />
          );
        }
        return kindSources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            active={selected === source.id}
            onSelect={() => onSelect(source.id)}
          />
        ));
      })}

      {sources
        .filter((source) => !CANONICAL_CLIMATE_KINDS.includes(source.kind))
        .map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            active={selected === source.id}
            onSelect={() => onSelect(source.id)}
          />
        ))}
    </aside>
  );
}

function LocationCard({
  location,
  unitSystem,
  active,
  canEdit,
  onSelect,
  onOpenSetLocation,
}: {
  location: ProjectLocation | undefined;
  unitSystem: UnitSystem;
  active: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onOpenSetLocation?: () => void;
}) {
  const cityState = [location?.city ?? location?.county, location?.state]
    .filter(Boolean)
    .join(", ");
  const place = [cityState, location?.postal_code].filter(Boolean).join(" ");
  const elevation = formatLocationElevationLabel(location?.elevation_m, unitSystem);
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
        <ClimateMap className="climate-mini-map" interactive={false} ariaHidden project={coords} />
        <span className="climate-nav-loc-body">
          <span className="climate-nav-loc-title">Project location</span>
          {canEdit && location?.street_address ? (
            <span className="climate-nav-loc-private">
              <span>{location.street_address}</span>
              <span className="climate-privacy-tag">(private)</span>
            </span>
          ) : null}
          <span className="climate-nav-loc-place">{place || "Location unset"}</span>
          <span className="climate-loc-pills">
            <b>{formatLatLong(location?.latitude ?? null, location?.longitude ?? null)}</b>
            {elevation ? <b>{elevation}</b> : null}
            {location?.climate_zone ? <b>{location.climate_zone}</b> : null}
          </span>
        </span>
      </button>
      {canEdit && onOpenSetLocation ? (
        <button
          type="button"
          className="secondary-button climate-nav-loc-set-button"
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
}: {
  source: ProjectClimateSource;
  active: boolean;
  onSelect: () => void;
}) {
  const status = climateSourceStatusChip(source);
  const attrs = climateSourceNavAttrs(source);
  return (
    <button
      type="button"
      className={["climate-nav-card", "climate-source-card", active && "active"]
        .filter(Boolean)
        .join(" ")}
      data-status={status.tone}
      onClick={onSelect}
    >
      <span className="climate-nav-top">
        <ClimateTypeBadge kind={source.kind} version={climateSourceBadgeVersion(source)} />
      </span>
      <span className="climate-nav-name">{climateSourceSubtitle(source)}</span>
      {attrs.length > 0 ? (
        <span className="climate-nav-attrs">
          {attrs.map((attr) => (
            <span key={attr}>{attr}</span>
          ))}
        </span>
      ) : null}
      <span className="climate-nav-foot">
        <ClimateStatusChip tone={status.tone} label={status.label} />
      </span>
    </button>
  );
}

// A canonical climate type with no attached source. Rendered so the four
// required bases are always visible as a checklist.
function MissingSourceCard({
  kind,
  active = false,
  onSelect,
}: {
  kind: ClimateSourceKind;
  active?: boolean;
  onSelect?: () => void;
}) {
  const className = [
    "climate-nav-card",
    "climate-source-card",
    "climate-source-missing",
    active && "active",
  ]
    .filter(Boolean)
    .join(" ");
  const body = (
    <>
      <span className="climate-nav-top">
        <ClimateTypeBadge kind={kind} />
      </span>
      <span className="climate-nav-name">No source attached</span>
      <span className="climate-nav-foot">
        <ClimateStatusChip tone="missing" label="Not set" />
      </span>
    </>
  );
  if (!onSelect) {
    return (
      <div className={className} data-status="missing">
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={className} data-status="missing" onClick={onSelect}>
      {body}
    </button>
  );
}
