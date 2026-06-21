import { useRef, useState, type ChangeEvent } from "react";
import { Check, Download, MapPin, Search, Upload } from "lucide-react";
import type { UnitSystem } from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { assetDownloadPath } from "../../assets/api";
import { uploadAsset } from "../../assets/hooks";
import {
  elevationUnitLabel,
  formatReadOnlyCoordinate,
  type ProjectLocationFormValues,
} from "../location-form";
import type { EpwParseResponse, GeocodeProjectLocationResponse, ProjectLocation } from "../types";

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

// The editable project-location fields plus the EPW upload/parse flow. The
// surrounding state (form values, validation, save) lives in
// `useProjectLocationForm`; this component is presentational.
export function ProjectLocationEditor({
  location,
  values,
  unitSystem,
  projectId,
  isParsingEpw,
  isGeocoding,
  isDeriving,
  onParseEpw,
  onGeocodeAddress,
  onApplyGeocodeCandidate,
  onDeriveLocation,
  onChange,
  onApplyEpwSuggestion,
}: {
  location: ProjectLocation | undefined;
  values: ProjectLocationFormValues;
  unitSystem: UnitSystem;
  projectId: string;
  isParsingEpw: boolean;
  isGeocoding: boolean;
  isDeriving: boolean;
  onParseEpw: (assetId: string) => Promise<EpwParseResponse>;
  onGeocodeAddress: (query: string) => Promise<GeocodeProjectLocationResponse>;
  onApplyGeocodeCandidate: (
    candidate: GeocodeProjectLocationResponse["candidates"][number],
  ) => void;
  onDeriveLocation: () => Promise<void>;
  onChange: (field: LocationFormField, value: string) => void;
  onApplyEpwSuggestion: (response: EpwParseResponse) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GeocodeProjectLocationResponse["candidates"]>([]);
  const [parsedEpw, setParsedEpw] = useState<EpwParseResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const handleChange = (field: LocationFormField) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange(field, event.target.value);
  };
  const linkedAssetId = values.epwAssetId || location?.epw_asset_id;
  const savedEpw = location?.epw;
  const linkedFilename =
    parsedEpw?.filename ?? (savedEpw && linkedAssetId === savedEpw.id ? savedEpw.filename : null);

  const uploadEpw = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const assetId = await uploadAsset(projectId, "epw", file);
      const response = await onParseEpw(assetId);
      setParsedEpw(response);
    } catch (error) {
      setUploadError(errorMessage(error, "Could not upload or parse the EPW file."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const geocodeAddress = async () => {
    setGeocodeError(null);
    setCandidates([]);
    try {
      const response = await onGeocodeAddress(geocodeQuery(values));
      setCandidates(response.candidates);
      if (response.candidates.length === 0) {
        setGeocodeError("No address candidates found.");
      }
    } catch (error) {
      setGeocodeError(errorMessage(error, "Could not geocode the address."));
    }
  };

  const deriveLocation = async () => {
    setDeriveError(null);
    try {
      await onDeriveLocation();
      setCandidates([]);
    } catch (error) {
      setDeriveError(errorMessage(error, "Could not populate climate data."));
    }
  };

  return (
    <>
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
          <div className="settings-location-inline-control">
            <input
              value={values.siteAddress}
              maxLength={500}
              onChange={handleChange("siteAddress")}
              placeholder="Street address"
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void geocodeAddress()}
              disabled={!values.siteAddress.trim() || isGeocoding}
            >
              <Search size={16} aria-hidden="true" />
              {isGeocoding ? "Finding..." : "Find"}
            </button>
          </div>
        </label>
        {candidates.length > 0 ? (
          <div className="settings-location-wide settings-location-candidates">
            {candidates.map((candidate) => (
              <button
                type="button"
                className="secondary-button"
                key={`${candidate.latitude}-${candidate.longitude}-${candidate.label}`}
                onClick={() => {
                  onApplyGeocodeCandidate(candidate);
                  setCandidates([]);
                }}
              >
                <MapPin size={16} aria-hidden="true" />
                {candidate.label}
              </button>
            ))}
          </div>
        ) : null}
        {geocodeError ? <p className="form-error settings-location-wide">{geocodeError}</p> : null}
        <label>
          <span>City</span>
          <input value={values.city} maxLength={200} onChange={handleChange("city")} />
        </label>
        <label>
          <span>State</span>
          <input value={values.state} maxLength={200} onChange={handleChange("state")} />
        </label>
        <label>
          <span>County</span>
          <input value={location?.county ?? ""} readOnly />
        </label>
        <label>
          <span>Climate zone</span>
          <input value={location?.climate_zone ?? ""} readOnly />
        </label>
        <label className="settings-location-wide">
          <span>EPW source URL</span>
          <input
            value={values.epwSourceUrl}
            maxLength={1000}
            onChange={handleChange("epwSourceUrl")}
            placeholder="https://climate.onebuilding.org/..."
          />
        </label>
      </div>
      <div className="settings-location-derived-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => void deriveLocation()}
          disabled={isDeriving || !values.latitude.trim() || !values.longitude.trim()}
        >
          <MapPin size={16} aria-hidden="true" />
          {isDeriving ? "Populating..." : "Populate climate data"}
        </button>
        {deriveError ? <p className="form-error">{deriveError}</p> : null}
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
            disabled={isUploading || isParsingEpw}
          >
            <Upload size={16} aria-hidden="true" />
            {isUploading || isParsingEpw ? "Uploading..." : "Upload EPW"}
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
                onApplyEpwSuggestion(parsedEpw);
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
    </>
  );
}

function geocodeQuery(values: ProjectLocationFormValues): string {
  return [values.siteAddress, values.city, values.state]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
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
