import { useState, type ChangeEvent } from "react";
import { MapPin, Search } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { elevationUnitLabel, type ProjectLocationFormValues } from "../../projects/location-form";
import { useProjectLocationForm } from "../../projects/useProjectLocationForm";
import { parseNumberInput } from "../../../lib/units/format";
import type { GeocodeProjectLocationResponse } from "../../projects/types";
import { ClimateMap } from "./ClimateMap";

const COMMON_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

type LocationFormField = keyof ProjectLocationFormValues;

// The address-first "Set location" modal: find the site by address (or set
// coordinates directly for an address-less rural site), then save the site
// geometry. Climate-source derivation and EPW file management live on their
// own Climate pages so this modal stays focused.
export function SetLocationModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const form = useProjectLocationForm(projectId);
  const { values, unitSystem } = form;
  const [candidates, setCandidates] = useState<GeocodeProjectLocationResponse["candidates"]>([]);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasCoords = values.latitude.trim() !== "" && values.longitude.trim() !== "";
  const latitude = parseNumberInput(values.latitude);
  const longitude = parseNumberInput(values.longitude);
  const coords = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const busy = form.isSaving;
  const handleField = (field: LocationFormField) => (event: ChangeEvent<HTMLInputElement>) =>
    form.updateField(field, event.target.value);
  // Pin-drop refines the coordinates: write the clicked point back into the
  // lat/long fields (live map only — the fallback box has no projection).
  const dropPin = (lat: number, lon: number) => {
    form.updateField("latitude", lat.toFixed(6));
    form.updateField("longitude", lon.toFixed(6));
  };

  const search = async () => {
    setGeocodeError(null);
    setCandidates([]);
    try {
      // Geocode exactly what the editor typed — the single address field holds
      // the full address, so appending stale city/state would corrupt the query.
      const response = await form.geocodeAddress(values.siteAddress.trim());
      setCandidates(response.candidates);
      if (response.candidates.length === 0) {
        setGeocodeError(
          "No matches — search needs a full street address (e.g. 123 Main St, City, ST). " +
            "For a site without an address, set the coordinates directly below.",
        );
      }
    } catch (error) {
      setGeocodeError(errorMessage(error, "Could not search for that address."));
    }
  };

  const saveLocation = async () => {
    setActionError(null);
    try {
      await form.save();
      onClose();
    } catch (error) {
      setActionError(errorMessage(error, "Could not save the project location."));
    }
  };

  return (
    <ModalDialog title="Set project location" titleId="set-location-title" onClose={onClose}>
      <form
        className="project-form set-location-modal"
        onSubmit={(event) => event.preventDefault()}
      >
        <p className="modal-subtitle">
          Enter the building&rsquo;s address to find its coordinates and climate basis — or set
          coordinates directly for a site without a mailing address.
        </p>
        {form.loadError ? (
          <p className="form-error">
            {errorMessage(form.loadError, "Could not load the project location.")}
          </p>
        ) : null}

        <label>
          <span>Site address</span>
          <div className="settings-location-inline-control">
            <input
              value={values.siteAddress}
              maxLength={500}
              onChange={handleField("siteAddress")}
              placeholder="123 Main St, City, ST"
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void search()}
              disabled={!values.siteAddress.trim() || form.isGeocoding}
            >
              <Search size={16} aria-hidden="true" />
              {form.isGeocoding ? "Searching…" : "Search"}
            </button>
          </div>
        </label>
        {candidates.length > 0 ? (
          <div className="settings-location-candidates">
            {candidates.map((candidate) => (
              <button
                type="button"
                className="secondary-button"
                key={`${candidate.latitude}-${candidate.longitude}-${candidate.label}`}
                onClick={() => {
                  form.applyGeocodeCandidate(candidate);
                  setCandidates([]);
                }}
              >
                <MapPin size={16} aria-hidden="true" />
                {candidate.label}
              </button>
            ))}
          </div>
        ) : null}
        {geocodeError ? <p className="form-error">{geocodeError}</p> : null}

        <ClimateMap
          className="set-location-map"
          ariaLabel="Project location pin-drop map"
          project={coords}
          onPickPoint={dropPin}
        />
        <p className="form-note">
          {coords
            ? "Click the map to drop a pin and refine the coordinates."
            : "Set an address or coordinates below to place the project, then drop a pin to refine."}
        </p>

        <div className="settings-location-grid">
          <label>
            <span>Latitude</span>
            <input
              inputMode="decimal"
              value={values.latitude}
              onChange={handleField("latitude")}
              placeholder="42.2876"
            />
          </label>
          <label>
            <span>Longitude</span>
            <input
              inputMode="decimal"
              value={values.longitude}
              onChange={handleField("longitude")}
              placeholder="-73.3662"
            />
          </label>
        </div>

        <details className="set-location-advanced">
          <summary>Advanced — elevation, time zone, orientation</summary>
          <div className="settings-location-grid set-location-advanced-body">
            <label>
              <span>Elevation ({elevationUnitLabel(unitSystem)})</span>
              <input
                inputMode="decimal"
                value={values.elevation}
                onChange={handleField("elevation")}
                placeholder={unitSystem === "IP" ? "1000" : "305"}
              />
            </label>
            <label>
              <span>Time zone</span>
              <input
                list="set-location-time-zones"
                value={values.timeZone}
                onChange={handleField("timeZone")}
                placeholder="America/New_York"
              />
              <datalist id="set-location-time-zones">
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
                onChange={handleField("trueNorth")}
                placeholder="0"
              />
            </label>
          </div>
        </details>

        {form.validationError ? <p className="form-error">{form.validationError}</p> : null}
        {actionError ? (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {form.warnings.length > 0 ? (
          <div className="draft-banner" role="status">
            {form.warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void saveLocation()}
            disabled={!hasCoords || !form.canSave || busy || Boolean(form.validationError)}
          >
            <MapPin size={16} aria-hidden="true" />
            {busy ? "Saving…" : "Save Location"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
