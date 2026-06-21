import type { UnitSystem } from "../../../lib/units";
import type { ProjectLocation } from "../../projects/types";
import {
  CANONICAL_CLIMATE_KINDS,
  climateSourceBadgeVersion,
  climateSourceCta,
  climateSourceNavAttrs,
  climateSourceStatusChip,
  climateSourceSubtitle,
  formatLatLong,
  formatLocationElevationLabel,
} from "../lib";
import type { ClimateSourceKind, ProjectClimateSource } from "../types";
import { ClimateStatusChip, ClimateTypeBadge, LocationPrivacyTag } from "./ClimateAtoms";

export type ClimateSelection = "location" | "add" | string;

export function ClimateSourceSidebar({
  location,
  sources,
  selected,
  canEdit,
  unitSystem,
  onSelect,
}: {
  location: ProjectLocation | undefined;
  sources: ProjectClimateSource[];
  selected: ClimateSelection;
  canEdit: boolean;
  unitSystem: UnitSystem;
  onSelect: (selection: ClimateSelection) => void;
}) {
  return (
    <aside className="climate-sidebar" aria-label="Climate pages">
      <LocationCard
        location={location}
        unitSystem={unitSystem}
        active={selected === "location"}
        onSelect={() => onSelect("location")}
      />

      <div className="climate-side-divider">
        Climate sources
        <span className="line" />
      </div>

      {CANONICAL_CLIMATE_KINDS.map((kind) => {
        const kindSources = sources.filter((source) => source.kind === kind);
        if (kindSources.length === 0) {
          return (
            <MissingSourceCard
              key={kind}
              kind={kind}
              onSelect={canEdit ? () => onSelect("add") : undefined}
            />
          );
        }
        return kindSources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            unitSystem={unitSystem}
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
            unitSystem={unitSystem}
            active={selected === source.id}
            onSelect={() => onSelect(source.id)}
          />
        ))}

      {canEdit ? (
        <button
          type="button"
          className={["climate-nav-card", "climate-add-card", selected === "add" && "active"]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onSelect("add")}
        >
          <strong>＋ Add source · re-populate</strong>
          <span>Browse datasets or attach a custom record</span>
        </button>
      ) : null}
    </aside>
  );
}

function LocationCard({
  location,
  unitSystem,
  active,
  onSelect,
}: {
  location: ProjectLocation | undefined;
  unitSystem: UnitSystem;
  active: boolean;
  onSelect: () => void;
}) {
  const place = [location?.city ?? location?.county, location?.state].filter(Boolean).join(", ");
  const elevation = formatLocationElevationLabel(location?.elevation_m, unitSystem);
  return (
    <button
      type="button"
      className={["climate-nav-card", "climate-nav-loc", active && "active"]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      <span className="climate-map-surface climate-mini-map" aria-hidden="true">
        <span className="climate-map-pin" style={{ left: "48%", top: "46%" }} />
      </span>
      <span className="climate-nav-loc-body">
        <span className="climate-nav-loc-title">Project location</span>
        <span className="climate-nav-loc-place">
          {place || "Location unset"}
          {location?.is_set ? (
            <>
              {" · "}
              <LocationPrivacyTag />
            </>
          ) : null}
        </span>
        <span className="climate-loc-pills">
          <b>{formatLatLong(location?.latitude ?? null, location?.longitude ?? null)}</b>
          {elevation ? <b>{elevation}</b> : null}
          {location?.climate_zone ? <b>{location.climate_zone}</b> : null}
        </span>
      </span>
    </button>
  );
}

function SourceCard({
  source,
  unitSystem,
  active,
  onSelect,
}: {
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
  active: boolean;
  onSelect: () => void;
}) {
  const status = climateSourceStatusChip(source);
  const cta = climateSourceCta(source);
  const attrs = climateSourceNavAttrs(source, unitSystem);
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
        <span className="climate-default-star" data-default={source.is_default} aria-hidden="true">
          {source.is_default ? "★" : "☆"}
        </span>
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
        {active ? (
          <span className="climate-nav-cta">viewing →</span>
        ) : cta ? (
          <span className="climate-nav-cta" data-tone={cta.tone}>
            {cta.label} →
          </span>
        ) : null}
      </span>
    </button>
  );
}

// A canonical climate type with no attached source. Rendered so the four
// required bases are always visible as a checklist; editors can click through
// to the add/re-populate surface.
function MissingSourceCard({ kind, onSelect }: { kind: ClimateSourceKind; onSelect?: () => void }) {
  const className = "climate-nav-card climate-source-card climate-source-missing";
  const body = (
    <>
      <span className="climate-nav-top">
        <ClimateTypeBadge kind={kind} />
        <span className="climate-default-star" aria-hidden="true">
          ☆
        </span>
      </span>
      <span className="climate-nav-name">No source attached</span>
      <span className="climate-nav-foot">
        <ClimateStatusChip tone="missing" label="Not set" />
        {onSelect ? <span className="climate-nav-cta">add →</span> : null}
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
