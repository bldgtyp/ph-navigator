import type { ChangeEvent } from "react";
import type { UnitSystem } from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import {
  elevationUnitLabel,
  formatLocationElevationDisplay,
  type ProjectLocationFormValues,
} from "../location-form";
import type { ProjectLocation } from "../types";

type LocationFormField = keyof ProjectLocationFormValues;

const COMMON_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

export function ProjectLocationSettingsSection({
  location,
  values,
  unitSystem,
  isViewer,
  isLoading,
  error,
  warnings,
  onChange,
}: {
  location: ProjectLocation | undefined;
  values: ProjectLocationFormValues;
  unitSystem: UnitSystem;
  isViewer: boolean;
  isLoading: boolean;
  error: Error | null;
  warnings: string[];
  onChange: (field: LocationFormField, value: string) => void;
}) {
  return (
    <section className="settings-section" aria-labelledby="settings-location-title">
      <div className="settings-section-heading">
        <h3 id="settings-location-title">Location</h3>
        <span>{elevationUnitLabel(unitSystem)}</span>
      </div>
      {isLoading ? <p className="form-note">Loading project location...</p> : null}
      {error ? (
        <p className="form-error">{errorMessage(error, "Could not load project location.")}</p>
      ) : null}
      {warnings.length > 0 ? (
        <div className="draft-banner settings-location-warning" role="status">
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      {isViewer ? (
        <ReadOnlyLocation location={location} unitSystem={unitSystem} />
      ) : (
        <EditableLocationFields values={values} unitSystem={unitSystem} onChange={onChange} />
      )}
    </section>
  );
}

function EditableLocationFields({
  values,
  unitSystem,
  onChange,
}: {
  values: ProjectLocationFormValues;
  unitSystem: UnitSystem;
  onChange: (field: LocationFormField, value: string) => void;
}) {
  const handleChange = (field: LocationFormField) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange(field, event.target.value);
  };

  return (
    <div className="settings-location-grid">
      <label>
        <span>Latitude</span>
        <input
          inputMode="decimal"
          value={values.latitude}
          onChange={handleChange("latitude")}
          placeholder="42.2876"
        />
      </label>
      <label>
        <span>Longitude</span>
        <input
          inputMode="decimal"
          value={values.longitude}
          onChange={handleChange("longitude")}
          placeholder="-73.3662"
        />
      </label>
      <label>
        <span>Elevation ({elevationUnitLabel(unitSystem)})</span>
        <input
          inputMode="decimal"
          value={values.elevation}
          onChange={handleChange("elevation")}
          placeholder={unitSystem === "IP" ? "1000" : "305"}
        />
      </label>
      <label>
        <span>Time zone</span>
        <input
          list="project-location-time-zones"
          value={values.timeZone}
          onChange={handleChange("timeZone")}
          placeholder="America/New_York"
        />
        <datalist id="project-location-time-zones">
          {COMMON_TIME_ZONES.map((timeZone) => (
            <option key={timeZone} value={timeZone} />
          ))}
        </datalist>
      </label>
      <label>
        <span>True north (deg)</span>
        <input
          inputMode="decimal"
          value={values.trueNorth}
          onChange={handleChange("trueNorth")}
          placeholder="0"
        />
      </label>
      <label className="settings-location-wide">
        <span>Site address</span>
        <input
          value={values.siteAddress}
          maxLength={500}
          onChange={handleChange("siteAddress")}
          placeholder="Street address"
        />
      </label>
      <label>
        <span>City</span>
        <input value={values.city} maxLength={200} onChange={handleChange("city")} />
      </label>
      <label>
        <span>State</span>
        <input value={values.state} maxLength={200} onChange={handleChange("state")} />
      </label>
    </div>
  );
}

function ReadOnlyLocation({
  location,
  unitSystem,
}: {
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
          {formatReadOnlyNumber(location.latitude, "deg")} /{" "}
          {formatReadOnlyNumber(location.longitude, "deg")}
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
        <dd>{formatReadOnlyNumber(location.true_north_deg, "deg")}</dd>
      </div>
      <div>
        <dt>Address</dt>
        <dd>{location.site_address ?? "None"}</dd>
      </div>
      <div>
        <dt>City / state</dt>
        <dd>{[location.city, location.state].filter(Boolean).join(", ") || "None"}</dd>
      </div>
    </dl>
  );
}

function formatReadOnlyNumber(value: number | null, suffix: string): string {
  if (value === null) return "None";
  return `${Number.isInteger(value) ? value : Number(value.toFixed(6))} ${suffix}`;
}

function formatReadOnlyElevation(valueM: number | null, unitSystem: UnitSystem): string {
  if (valueM === null) return "None";
  return `${formatLocationElevationDisplay(valueM, unitSystem)} ${elevationUnitLabel(unitSystem)}`;
}
