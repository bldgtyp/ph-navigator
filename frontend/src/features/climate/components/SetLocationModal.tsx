import { useRef, useState, type ChangeEvent } from "react";
import { Check, Download, MapPin, Search, Upload } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { assetDownloadPath } from "../../assets/api";
import { uploadAsset } from "../../assets/hooks";
import {
  elevationUnitLabel,
  formatReadOnlyCoordinate,
  type ProjectLocationFormValues,
} from "../../projects/location-form";
import { useProjectLocationForm } from "../../projects/useProjectLocationForm";
import type { EpwParseResponse, GeocodeProjectLocationResponse } from "../../projects/types";

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

// The address-first "Set location" modal: the single entry point that
// establishes a project's climate basis. Find the site by address (or set
// coordinates directly for an address-less rural site), then "Locate Climate
// Data" runs the derive/repopulate finder — persisting the location, deriving
// county/elevation/zone, and auto-attaching the nearest Phius/PHI/ASHRAE/EPW
// sources. Mounted only while open, so Cancel discards in-progress edits.
export function SetLocationModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const form = useProjectLocationForm(projectId);
  const { values, unitSystem } = form;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [candidates, setCandidates] = useState<GeocodeProjectLocationResponse["candidates"]>([]);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [parsedEpw, setParsedEpw] = useState<EpwParseResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const hasCoords = values.latitude.trim() !== "" && values.longitude.trim() !== "";
  const busy = form.isDeriving || form.isSaving;
  const handleField =
    (field: LocationFormField) => (event: ChangeEvent<HTMLInputElement>) =>
      form.updateField(field, event.target.value);

  const linkedAssetId = values.epwAssetId || form.location?.epw_asset_id;
  const savedEpw = form.location?.epw;
  const linkedFilename =
    parsedEpw?.filename ?? (savedEpw && linkedAssetId === savedEpw.id ? savedEpw.filename : null);

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

  const uploadEpw = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const assetId = await uploadAsset(projectId, "epw", file);
      setParsedEpw(await form.parseEpw(assetId));
    } catch (error) {
      setUploadError(errorMessage(error, "Could not upload or parse the EPW file."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // The primary commit: persist any manual edits, then run the derive finder
  // (which attaches the climate sources) and close on success.
  const locateClimateData = async () => {
    setActionError(null);
    try {
      if (form.canSave) await form.save();
      await form.deriveLocation();
      onClose();
    } catch (error) {
      setActionError(errorMessage(error, "Could not locate the climate data."));
    }
  };

  return (
    <ModalDialog title="Set project location" titleId="set-location-title" onClose={onClose}>
      <form className="project-form set-location-modal" onSubmit={(event) => event.preventDefault()}>
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

        <div className="set-location-map climate-map-surface" aria-hidden="true">
          {hasCoords ? <span className="climate-map-pin" style={{ left: "50%", top: "50%" }} /> : null}
          <span className="set-location-map-note">
            {hasCoords ? `${values.latitude}, ${values.longitude}` : "No location set yet"}
          </span>
        </div>
        <p className="form-note">Map preview · interactive pin-drop arrives with map tiles.</p>

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
          <summary>Advanced — elevation, time zone, orientation, weather file</summary>
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
            <label className="settings-location-wide">
              <span>EPW source URL</span>
              <input
                value={values.epwSourceUrl}
                maxLength={1000}
                onChange={handleField("epwSourceUrl")}
                placeholder="https://climate.onebuilding.org/..."
              />
            </label>
          </div>
          <div className="settings-location-epw">
            <div className="settings-location-epw-row">
              <input
                ref={fileInputRef}
                className="attachment-file-input"
                type="file"
                accept=".epw,text/plain,application/octet-stream"
                onChange={(event) => void uploadEpw(event.target.files)}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || form.isParsingEpw}
              >
                <Upload size={16} aria-hidden="true" />
                {isUploading || form.isParsingEpw ? "Uploading…" : "Upload EPW"}
              </button>
              {linkedAssetId ? (
                <a className="secondary-button" href={assetDownloadPath(projectId, linkedAssetId)}>
                  <Download size={16} aria-hidden="true" />
                  Download EPW
                </a>
              ) : null}
              {linkedFilename ? <span className="form-note">{linkedFilename}</span> : null}
            </div>
            {parsedEpw ? (
              <div className="settings-location-epw-suggestion">
                <span>{formatEpwSuggestion(parsedEpw)}</span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    form.applyEpwSuggestion(parsedEpw);
                    setParsedEpw(null);
                  }}
                >
                  <Check size={16} aria-hidden="true" />
                  Apply EPW values
                </button>
              </div>
            ) : null}
            {uploadError ? <p className="form-error">{uploadError}</p> : null}
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
            onClick={() => void locateClimateData()}
            disabled={!hasCoords || busy || Boolean(form.validationError)}
          >
            <MapPin size={16} aria-hidden="true" />
            {busy ? "Locating…" : "Locate Climate Data"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

function formatEpwSuggestion(response: EpwParseResponse): string {
  const suggestion = response.suggestion;
  return [
    suggestion.city,
    suggestion.state,
    formatReadOnlyCoordinate(suggestion.latitude),
    formatReadOnlyCoordinate(suggestion.longitude),
  ]
    .filter((part) => part && part !== "None")
    .join(" / ");
}
