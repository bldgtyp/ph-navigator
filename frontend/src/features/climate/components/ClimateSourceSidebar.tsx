import type { ProjectLocation } from "../../projects/types";
import {
  climateSourceCachedMetrics,
  climateSourceKindLabel,
  climateSourceProximity,
  climateSourceProximityStatus,
  climateSourceSubtitle,
  formatLatLong,
} from "../lib";
import type { ProjectClimateSource } from "../types";

export type ClimateSelection = "location" | "add" | string;

export function ClimateSourceSidebar({
  location,
  sources,
  selected,
  canEdit,
  onSelect,
}: {
  location: ProjectLocation | undefined;
  sources: ProjectClimateSource[];
  selected: ClimateSelection;
  canEdit: boolean;
  onSelect: (selection: ClimateSelection) => void;
}) {
  return (
    <aside className="climate-sidebar" aria-label="Climate pages">
      <button
        type="button"
        className={selected === "location" ? "climate-nav-card active" : "climate-nav-card"}
        onClick={() => onSelect("location")}
      >
        <span className="climate-source-kind">Location</span>
        <strong>{formatLatLong(location?.latitude ?? null, location?.longitude ?? null)}</strong>
        <span>{[location?.county, location?.state].filter(Boolean).join(", ") || "Unset"}</span>
        <span>{location?.climate_zone ? `Zone ${location.climate_zone}` : "No climate zone"}</span>
      </button>
      {sources.map((source) => {
        const status = climateSourceProximityStatus(source);
        return (
          <button
            key={source.id}
            type="button"
            className={[
              "climate-nav-card",
              selected === source.id ? "active" : "",
              status ? `climate-nav-${status}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelect(source.id)}
          >
            <span className="climate-source-kind">{climateSourceKindLabel(source.kind)}</span>
            <strong>{climateSourceSubtitle(source)}</strong>
            {source.is_default ? <span>Default source</span> : null}
            <span>
              {climateSourceProximity(source) ?? climateSourceCachedMetrics(source) ?? "Attached"}
            </span>
          </button>
        );
      })}
      {canEdit ? (
        <button
          type="button"
          className={selected === "add" ? "climate-nav-card active" : "climate-nav-card"}
          onClick={() => onSelect("add")}
        >
          <span className="climate-source-kind">Add source</span>
          <strong>Re-populate / override</strong>
          <span>Browse datasets or attach custom pointers</span>
        </button>
      ) : null}
    </aside>
  );
}
