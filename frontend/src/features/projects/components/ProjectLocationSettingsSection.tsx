import { useRef, useState, type ChangeEvent } from "react";
import { Check, Download, Upload } from "lucide-react";
import type { UnitSystem } from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { assetDownloadPath } from "../../assets/api";
import { uploadAsset } from "../../assets/hooks";
import {
  elevationUnitLabel,
  formatLocationElevationDisplay,
  type ProjectLocationFormValues,
} from "../location-form";
import type { EpwParseResponse, ProjectLocation } from "../types";

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
  projectId,
  isParsingEpw,
  onParseEpw,
  onChange,
  onApplyEpwSuggestion,
}: {
  location: ProjectLocation | undefined;
  values: ProjectLocationFormValues;
  unitSystem: UnitSystem;
  isViewer: boolean;
  isLoading: boolean;
  error: Error | null;
  warnings: string[];
  projectId: string;
  isParsingEpw: boolean;
  onParseEpw: (assetId: string) => Promise<EpwParseResponse>;
  onChange: (field: LocationFormField, value: string) => void;
  onApplyEpwSuggestion: (response: EpwParseResponse) => void;
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
        <ReadOnlyLocation projectId={projectId} location={location} unitSystem={unitSystem} />
      ) : (
        <EditableLocationFields
          location={location}
          values={values}
          unitSystem={unitSystem}
          projectId={projectId}
          isParsingEpw={isParsingEpw}
          onParseEpw={onParseEpw}
          onChange={onChange}
          onApplyEpwSuggestion={onApplyEpwSuggestion}
        />
      )}
    </section>
  );
}

function EditableLocationFields({
  location,
  values,
  unitSystem,
  projectId,
  isParsingEpw,
  onParseEpw,
  onChange,
  onApplyEpwSuggestion,
}: {
  location: ProjectLocation | undefined;
  values: ProjectLocationFormValues;
  unitSystem: UnitSystem;
  projectId: string;
  isParsingEpw: boolean;
  onParseEpw: (assetId: string) => Promise<EpwParseResponse>;
  onChange: (field: LocationFormField, value: string) => void;
  onApplyEpwSuggestion: (response: EpwParseResponse) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

function ReadOnlyLocation({
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

function formatEpwSuggestion(response: EpwParseResponse): string {
  const suggestion = response.suggestion;
  return [
    suggestion.city,
    suggestion.state,
    formatReadOnlyNumber(suggestion.latitude, "deg"),
    formatReadOnlyNumber(suggestion.longitude, "deg"),
  ]
    .filter((part) => part && part !== "None")
    .join(" / ");
}

function formatReadOnlyNumber(value: number | null, suffix: string): string {
  if (value === null) return "None";
  return `${Number.isInteger(value) ? value : Number(value.toFixed(6))} ${suffix}`;
}

function formatReadOnlyElevation(valueM: number | null, unitSystem: UnitSystem): string {
  if (valueM === null) return "None";
  return `${formatLocationElevationDisplay(valueM, unitSystem)} ${elevationUnitLabel(unitSystem)}`;
}
