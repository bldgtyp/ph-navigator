import type { UnitSystem } from "../../../lib/units";
import { assetDownloadPath } from "../../assets/api";
import {
  elevationUnitLabel,
  formatLocationElevationDisplay,
  formatReadOnlyCoordinate,
} from "../location-form";
import type { ProjectLocation } from "../types";

// Read-only project-location summary: the viewer affordance in the Climate
// tab and the compact display in project settings (editing lives in the
// Climate tab editor, D-CL-3).
export function ProjectLocationSummary({
  projectId,
  location,
  unitSystem,
}: {
  projectId: string;
  location: ProjectLocation | undefined;
  unitSystem: UnitSystem;
}) {
  if (!location?.is_set) {
    return <p className="form-note">No location set.</p>;
  }
  return (
    <dl className="settings-readonly-list">
      <div>
        <dt>Coordinates</dt>
        <dd>
          {formatReadOnlyCoordinate(location.latitude)} /{" "}
          {formatReadOnlyCoordinate(location.longitude)}
        </dd>
      </div>
      <div>
        <dt>Elevation</dt>
        <dd>{formatReadOnlyElevation(location.elevation_m, unitSystem)}</dd>
      </div>
      <div>
        <dt>Time zone</dt>
        <dd>{location.time_zone ?? "None"}</dd>
      </div>
      <div>
        <dt>True north</dt>
        <dd>{formatReadOnlyCoordinate(location.true_north_deg)}</dd>
      </div>
      <div>
        <dt>Address</dt>
        <dd>{location.site_address ?? "None"}</dd>
      </div>
      <div>
        <dt>City / state</dt>
        <dd>{[location.city, location.state].filter(Boolean).join(", ") || "None"}</dd>
      </div>
      <div>
        <dt>EPW</dt>
        <dd>
          {location.epw ? (
            <a href={assetDownloadPath(projectId, location.epw.id)}>
              {location.epw.filename ?? location.epw.id}
            </a>
          ) : (
            "None"
          )}
        </dd>
      </div>
      <div>
        <dt>EPW source</dt>
        <dd>{location.epw_source_url ?? "None"}</dd>
      </div>
    </dl>
  );
}

function formatReadOnlyElevation(valueM: number | null, unitSystem: UnitSystem): string {
  if (valueM === null) return "None";
  return `${formatLocationElevationDisplay(valueM, unitSystem)} ${elevationUnitLabel(unitSystem)}`;
}
