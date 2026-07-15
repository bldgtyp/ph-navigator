import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MapPin, Search } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { elevationUnitLabel, type ProjectLocationFormValues } from "../../projects/location-form";
import { useProjectLocationForm } from "../../projects/useProjectLocationForm";
import { parseNumberInput } from "../../../lib/units/format";
import type { GeocodeProjectLocationResponse } from "../../projects/types";
import { ClimateMap } from "./ClimateMap";
import { pointPresentationNote, type PointPresentation } from "./location-point-presentation";

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

// Find an address or privacy-preserving Census locality point, then save the
// project geometry. Climate-source derivation and EPW file management remain
// on their own Climate pages so this modal stays focused.
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
  const [searchQuery, setSearchQuery] = useState("");
  const [pointPresentation, setPointPresentation] = useState<PointPresentation>("saved");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const searchInitialized = useRef(false);
  const searchEdited = useRef(false);
  const searchRequestSeq = useRef(0);

  useEffect(() => {
    if (searchInitialized.current || !form.location) return;
    searchInitialized.current = true;
    if (searchEdited.current) return;
    setSearchQuery(form.location.full_site_address ?? "");
  }, [form.location]);

  const hasCoords = values.latitude.trim() !== "" && values.longitude.trim() !== "";
  const latitude = parseNumberInput(values.latitude);
  const longitude = parseNumberInput(values.longitude);
  const coords = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const busy = form.isSaving;
  const handleField = (field: LocationFormField) => (event: ChangeEvent<HTMLInputElement>) => {
    if (field === "latitude" || field === "longitude") setPointPresentation("custom");
    form.updateField(field, event.target.value);
  };
  // Pin-drop refines the coordinates: write the clicked point back into the
  // lat/long fields (live map only — the fallback box has no projection).
  const dropPin = (lat: number, lon: number) => {
    setPointPresentation("custom");
    form.updateField("latitude", lat.toFixed(6));
    form.updateField("longitude", lon.toFixed(6));
  };

  const search = async () => {
    const requestSeq = (searchRequestSeq.current += 1);
    setGeocodeError(null);
    setCandidates([]);
    try {
      const response = await form.geocodeAddress(searchQuery.trim());
      if (requestSeq !== searchRequestSeq.current) return;
      setCandidates(response.candidates);
      if (response.candidates.length === 0) {
        setGeocodeError(
          "No address or town matches. Try a full street address or City, ST ZIP; " +
            "you can also set coordinates directly below.",
        );
      }
    } catch (error) {
      if (requestSeq !== searchRequestSeq.current) return;
      setGeocodeError(errorMessage(error, "Could not search for that address or town."));
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
          Search a full address or choose an approximate town-level Census point for privacy and
          climate lookup. You can also set coordinates directly.
        </p>
        {form.loadError ? (
          <p className="form-error">
            {errorMessage(form.loadError, "Could not load the project location.")}
          </p>
        ) : null}

        <label>
          <span>Address or town</span>
          <div className="settings-location-inline-control">
            <input
              value={searchQuery}
              maxLength={500}
              onChange={(event) => {
                searchRequestSeq.current += 1;
                searchEdited.current = true;
                setCandidates([]);
                setGeocodeError(null);
                setSearchQuery(event.target.value);
              }}
              placeholder="123 Main St, City, ST — or City, ST ZIP"
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void search()}
              disabled={!searchQuery.trim() || form.isGeocoding}
            >
              <Search size={16} aria-hidden="true" />
              {form.isGeocoding ? "Searching…" : "Search"}
            </button>
          </div>
        </label>
        {candidates.length > 0 ? (
          <div className="settings-location-candidates" aria-label="Location search results">
            {candidates.map((candidate) => (
              <button
                type="button"
                className="secondary-button"
                key={`${candidate.latitude}-${candidate.longitude}-${candidate.label}`}
                onClick={() => {
                  form.applyGeocodeCandidate(candidate);
                  searchEdited.current = true;
                  setSearchQuery(candidate.label);
                  setPointPresentation(candidate.result_type);
                  setCandidates([]);
                }}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>{candidate.label}</span>
                <span className="chip chip--sm chip--outline">
                  {candidate.result_type === "locality" ? "Town" : "Address"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <p className="visually-hidden" role="status" aria-live="polite">
          {candidates.length > 0 ? `${candidates.length} location search results available.` : ""}
        </p>
        {geocodeError ? (
          <p className="form-error" role="alert">
            {geocodeError}
          </p>
        ) : null}

        <ClimateMap
          className="set-location-map"
          ariaLabel="Project location pin-drop map"
          project={coords}
          onPickPoint={dropPin}
        />
        <p className="form-note">{pointPresentationNote(pointPresentation, Boolean(coords))}</p>

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
            <div className="set-location-elevation">
              <label>
                <span>Elevation ({elevationUnitLabel(unitSystem)})</span>
                <input
                  inputMode="decimal"
                  value={values.elevation}
                  onChange={handleField("elevation")}
                  placeholder={unitSystem === "IP" ? "1000" : "305"}
                />
              </label>
              {/* Auto-filled from the site coordinates (USGS 3DEP → Open-Meteo);
                  hand-editing the field above overrides it until "Reset to auto". */}
              <div className="set-location-elevation-status">
                {form.isLookingUpElevation ? (
                  <span className="form-note">Looking up elevation…</span>
                ) : form.elevationOverridden ? (
                  <button type="button" className="link-button" onClick={form.resetElevationToAuto}>
                    ↻ Reset to auto
                  </button>
                ) : form.elevationSource ? (
                  <span className="form-note">Auto · {form.elevationSource}</span>
                ) : null}
                {form.elevationNote ? (
                  <span className="form-error">{form.elevationNote}</span>
                ) : null}
              </div>
            </div>
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
