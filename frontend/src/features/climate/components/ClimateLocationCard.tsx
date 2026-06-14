import type { UnitSystem } from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { elevationUnitLabel, formatLocationElevationDisplay } from "../../projects/location-form";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectLocation } from "../../projects/types";

// The project's location record, read-only. The rich editor migrates into
// this tab in the next 3a step (D-CL-3); until then editing stays in
// project Settings.
export function ClimateLocationCard({
  projectId,
  unitSystem,
}: {
  projectId: string;
  unitSystem: UnitSystem;
}) {
  const locationQuery = useProjectLocationQuery(projectId);

  if (locationQuery.isLoading) {
    return <p className="form-note">Loading project location…</p>;
  }
  if (locationQuery.error) {
    return (
      <p className="form-error">
        {errorMessage(locationQuery.error, "Could not load project location.")}
      </p>
    );
  }

  const location = locationQuery.data;
  if (!location?.is_set) {
    return <p className="form-note">No location set. Set one in project Settings.</p>;
  }

  return (
    <dl className="climate-location-card">
      <Field label="Coordinates">{formatCoords(location)}</Field>
      <Field label="Elevation">
        {location.elevation_m === null
          ? "—"
          : `${formatLocationElevationDisplay(location.elevation_m, unitSystem)} ${elevationUnitLabel(unitSystem)}`}
      </Field>
      <Field label="Time zone">{location.time_zone ?? "—"}</Field>
      <Field label="True north">
        {location.true_north_deg === null ? "—" : `${location.true_north_deg}°`}
      </Field>
      <Field label="Address">{location.site_address ?? "—"}</Field>
      <Field label="City / state">
        {[location.city, location.state].filter(Boolean).join(", ") || "—"}
      </Field>
    </dl>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatCoords(location: ProjectLocation): string {
  if (location.latitude === null || location.longitude === null) return "—";
  return `${location.latitude}, ${location.longitude}`;
}
