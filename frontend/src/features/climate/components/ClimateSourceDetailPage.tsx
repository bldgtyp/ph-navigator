// @size-exception: planning/archive/climate-dataset-picker/PRD.md
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, Download, MapPin, Trash2, Upload } from "lucide-react";
import type { UnitSystem } from "../../../lib/units";
import { formatTemperatureFromC } from "../../../lib/units/temperature";
import { errorMessage } from "../../../shared/lib/errors";
import { assetDownloadPath } from "../../assets/api";
import { uploadAsset } from "../../assets/hooks";
import { formatReadOnlyCoordinate } from "../../projects/location-form";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail } from "../../projects/types";
import type { EpwParseResponse } from "../../projects/types";
import { useProjectLocationForm } from "../../projects/useProjectLocationForm";
import {
  useClimateLocationQuery,
  useDeleteClimateSourceMutation,
  useDeriveClimateSourceMutation,
} from "../hooks";
import {
  climateSourceBadgeVersion,
  climateSourceProximity,
  climateSourceProximityStatus,
  climateSourceStatusChip,
  climateSourceSubtitle,
  formatSi,
  isClimateRecord,
} from "../lib";
import type { ClimateSourceKind, PhClimateKind, ProjectClimateSource } from "../types";
import { ClimateStatusChip, ClimateTypeBadge } from "./ClimateAtoms";
import { MonthlyRadiationChart, MonthlyTemperatureChart } from "./ClimateRecordCharts";
import {
  ClimatePeakLoadsTable,
  MonthlyRadiationTable,
  MonthlyTemperatureTable,
} from "./ClimateRecordTable";
import { ClimateRecordView } from "./ClimateRecordView";

const MISSING_SOURCE_COPY: Record<ClimateSourceKind, { title: string; subtitle: string }> = {
  phius: {
    title: "Phius climate dataset",
    subtitle: "Attach the nearest Phius reference dataset for this site.",
  },
  phi: {
    title: "PHI climate dataset",
    subtitle: "Attach the nearest PHI / PHPP reference dataset for this site.",
  },
  ashrae: {
    title: "ASHRAE design conditions",
    subtitle: "Set design conditions from the nearest weather file.",
  },
  epw: {
    title: "EPW weather file",
    subtitle: "Set the nearest weather file, or upload one manually.",
  },
  custom: {
    title: "Custom climate record",
    subtitle: "Add a custom climate record.",
  },
};

// The empty-state page for a canonical climate type with no attached source.
// Each type's primary action is "Set from nearest"; PH types also offer the
// manual dataset picker, and EPW keeps its upload controls.
export function MissingSourcePage({
  project,
  kind,
  onOpenPicker,
}: {
  project: ProjectDetail;
  kind: ClimateSourceKind;
  onOpenPicker?: (kind: PhClimateKind) => void;
}) {
  const canEdit = project.access_mode === "editor";
  const isPh = kind === "phius" || kind === "phi";
  const copy = MISSING_SOURCE_COPY[kind];
  return (
    <div className="climate-detail-page">
      <header className="climate-page-head">
        <div>
          <div className="climate-page-badges">
            <ClimateTypeBadge kind={kind} />
            <ClimateStatusChip tone="missing" label="Not set" />
          </div>
          <h3 className="climate-page-title">{copy.title}</h3>
          <div className="climate-page-sub">
            <span>{copy.subtitle}</span>
          </div>
        </div>
      </header>
      <ClimateSetFromNearest
        project={project}
        kind={kind}
        label={isPh ? "Set from nearest" : "Set from nearest weather file"}
        variant="primary"
      />
      {canEdit && isPh && onOpenPicker ? (
        <div className="climate-link-row">
          <button type="button" className="secondary-button" onClick={() => onOpenPicker(kind)}>
            Choose a dataset manually
          </button>
        </div>
      ) : null}
      {kind === "epw" ? <ProjectEpwControls project={project} /> : null}
      {kind === "ashrae" ? (
        <p className="form-note">
          ASHRAE design conditions are set together with the EPW weather file.
        </p>
      ) : null}
    </div>
  );
}

// "Set from nearest" action for one climate page: derives + attaches the type's
// source from the project's saved coordinates, surfacing derive warnings and a
// hint when the location is not yet set. `weather` covers EPW + ASHRAE. The
// action is inherently editor-only, so it self-guards rather than asking every
// caller to gate it.
function ClimateSetFromNearest({
  project,
  kind,
  label,
  variant = "secondary",
}: {
  project: ProjectDetail;
  kind: ClimateSourceKind;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const derive = useDeriveClimateSourceMutation(project.id);
  const location = useProjectLocationQuery(project.id).data;
  const hasLocation = location?.latitude != null && location?.longitude != null;
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  if (project.access_mode !== "editor") return null;
  const deriveKind = kind === "phius" ? "phius" : kind === "phi" ? "phi" : "weather";

  const run = async () => {
    setError(null);
    setWarnings([]);
    try {
      const response = await derive.mutateAsync(deriveKind);
      setWarnings(response.warnings);
    } catch (err) {
      setError(errorMessage(err, "Could not set climate data from the nearest source."));
    }
  };

  return (
    <div className="climate-derive-action">
      <button
        type="button"
        className={`${variant}-button`}
        onClick={() => void run()}
        disabled={!hasLocation || derive.isPending}
      >
        <MapPin size={16} aria-hidden="true" />
        {derive.isPending ? "Setting…" : label}
      </button>
      {!hasLocation ? (
        <p className="form-note">Set the project location first to find the nearest source.</p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <div className="draft-banner" role="status">
          {warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ClimateSourceDetailPage({
  project,
  source,
  unitSystem,
  onOpenPicker,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
  onOpenPicker?: (kind: PhClimateKind) => void;
}) {
  if (source.kind === "phius" || source.kind === "phi") {
    const kind = source.kind;
    return (
      <PassiveHouseSourcePage
        project={project}
        source={source}
        unitSystem={unitSystem}
        onChangeDataset={onOpenPicker ? () => onOpenPicker(kind) : undefined}
      />
    );
  }
  if (source.kind === "ashrae") {
    return <AshraeSourcePage project={project} source={source} unitSystem={unitSystem} />;
  }
  if (source.kind === "epw") {
    return <EpwSourcePage project={project} source={source} unitSystem={unitSystem} />;
  }
  return <CustomSourcePage project={project} source={source} unitSystem={unitSystem} />;
}

// The shared page header (badge + status chip + title + metadata sub-row) and
// the editor's remove action, used by every source page.
function SourceHeader({
  project,
  source,
  title,
  subItems,
  detail,
  onChangeDataset,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  title?: string;
  subItems?: (string | null)[];
  detail?: ReactNode;
  onChangeDataset?: () => void;
}) {
  const canEdit = project.access_mode === "editor";
  const status = climateSourceStatusChip(source);
  const remove = useDeleteClimateSourceMutation(project.id);
  const busy = remove.isPending;
  const items = (subItems ?? [climateSourceProximity(source)]).filter((item): item is string =>
    Boolean(item),
  );
  return (
    <header className="climate-page-head">
      <div>
        <div className="climate-page-badges">
          <ClimateTypeBadge kind={source.kind} version={climateSourceBadgeVersion(source)} />
          <ClimateStatusChip tone={status.tone} label={status.label} />
        </div>
        <h3 className="climate-page-title">{title ?? climateSourceSubtitle(source)}</h3>
        {items.length > 0 ? (
          <div className="climate-page-sub">
            {items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
        {detail}
      </div>
      {canEdit ? (
        <div className="climate-page-head-actions">
          {onChangeDataset ? (
            <button
              type="button"
              className="primary-button"
              onClick={onChangeDataset}
              disabled={busy}
            >
              Change dataset
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            onClick={() => remove.mutate(source.id)}
            disabled={busy}
          >
            <Trash2 size={16} aria-hidden="true" />
            Remove
          </button>
        </div>
      ) : null}
    </header>
  );
}

function PassiveHouseSourcePage({
  project,
  source,
  unitSystem,
  onChangeDataset,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
  onChangeDataset?: () => void;
}) {
  const datasetId = stringValue(source.data?.dataset_id);
  const locationId = source.ref ?? stringValue(source.data?.location_id) ?? undefined;
  const query = useClimateLocationQuery(datasetId ?? undefined, locationId);
  const record = query.data?.record;
  return (
    <div className="climate-detail-page">
      <SourceHeader
        project={project}
        source={source}
        detail={<PhLimitCheck source={source} unitSystem={unitSystem} />}
        subItems={[]}
        onChangeDataset={onChangeDataset}
      />
      <ClimateSetFromNearest project={project} kind={source.kind} label="Set from nearest" />
      {!datasetId || !locationId ? (
        <p className="form-note">
          This source is missing the dataset pointer needed to load values.
        </p>
      ) : null}
      {source.kind === "phius" && climateSourceProximityStatus(source) === "fail" ? (
        <PhiusLimitWarning source={source} />
      ) : null}
      {query.isLoading ? <p className="form-note">Loading climate record…</p> : null}
      {query.error ? <p className="form-error">Could not load climate record.</p> : null}
      {record ? (
        <>
          <section className="climate-record-section" aria-labelledby="climate-monthly-title">
            <div className="climate-record-section-head">
              <h4 id="climate-monthly-title">Monthly data</h4>
              <p className="form-note">
                Monthly temperatures and facade radiation from the selected climate station.
              </p>
            </div>
            <MonthlyTemperatureChart record={record} unitSystem={unitSystem} />
            <MonthlyTemperatureTable record={record} unitSystem={unitSystem} />
            <MonthlyRadiationChart record={record} unitSystem={unitSystem} />
            <MonthlyRadiationTable record={record} unitSystem={unitSystem} />
          </section>

          <section className="climate-record-section" aria-labelledby="climate-peaks-title">
            <div className="climate-record-section-head">
              <h4 id="climate-peaks-title">Peak loads</h4>
              <p className="form-note">
                Design temperature and peak radiation values used by PHPP/Phius workflows.
              </p>
            </div>
            <ClimatePeakLoadsTable peaks={record.climate.peak_loads} unitSystem={unitSystem} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function PhiusLimitWarning({ source }: { source: ProjectClimateSource }) {
  const proximity = proximityRecord(source);
  return (
    <div className="climate-fail-hero" role="status">
      <ClimateStatusChip tone="fail" label="Phius limit warning" />
      <h4>This climate dataset is outside the Phius distance/elevation limits.</h4>
      <p>
        {stringValue(proximity?.message) ??
          "The selected Phius station is outside the 50 mi / 400 ft limit. A custom climate " +
            "set may be required for certification."}
      </p>
      <p>
        You can keep using this dataset if the project has a justified exception. Document the
        rationale before certification submission.
      </p>
      <div className="climate-fail-actions">
        <a
          className="secondary-button climate-custom-set-link"
          href="https://www.phius.org/climate-data"
        >
          Request custom set · $75
        </a>
      </div>
    </div>
  );
}

const PH_DISTANCE_LIMIT_MI = 50;
const PH_ELEVATION_LIMIT_FT = 400;
const KM_PER_MI = 1.609344;
const M_PER_FT = 0.3048;

function PhLimitCheck({
  source,
  unitSystem,
}: {
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const proximity = proximityRecord(source);
  const distanceMi = numberValue(proximity?.distance_mi);
  const elevationDeltaFt = numberValue(proximity?.elevation_delta_ft);
  if (distanceMi === null && elevationDeltaFt === null) return null;

  const limitLabel = source.kind === "phius" ? "Phius limit" : "PHI advisory band";
  const rows = [
    {
      metric: "Distance",
      current: formatPhDistance(distanceMi, unitSystem),
      limit: formatPhDistance(PH_DISTANCE_LIMIT_MI, unitSystem),
      result: verdictLabel(source.kind, distanceMi, PH_DISTANCE_LIMIT_MI),
    },
    {
      metric: "Elevation",
      current: formatPhElevationDelta(elevationDeltaFt, unitSystem),
      limit: formatPhElevationDelta(PH_ELEVATION_LIMIT_FT, unitSystem),
      result: verdictLabel(source.kind, elevationDeltaFt, PH_ELEVATION_LIMIT_FT),
    },
  ];

  return (
    <table
      className="climate-limit-check"
      aria-label={source.kind === "phius" ? "Phius certification limits" : "PHI advisory limits"}
    >
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col">Site vs climate data difference</th>
          <th scope="col">{limitLabel}</th>
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.metric}>
            <th scope="row">{row.metric}</th>
            <td>{row.current}</td>
            <td>{row.limit}</td>
            <td>
              <span className="climate-limit-result" data-status={row.result.status}>
                {row.result.label}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatPhDistance(valueMi: number | null, unitSystem: UnitSystem) {
  if (valueMi === null) return "—";
  if (unitSystem === "IP") return `${formatPhiusDecimal(valueMi)} mi`;
  return `${(valueMi * KM_PER_MI).toFixed(1)} km`;
}

function formatPhElevationDelta(valueFt: number | null, unitSystem: UnitSystem) {
  if (valueFt === null) return "—";
  const absFt = Math.abs(valueFt);
  if (unitSystem === "IP") return `${absFt.toFixed(0)} ft`;
  return `${(absFt * M_PER_FT).toFixed(0)} m`;
}

function formatPhiusDecimal(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function verdictLabel(
  kind: ClimateSourceKind,
  value: number | null,
  limit: number,
): { label: "pass" | "fail" | "check"; status: "pass" | "fail" | "warning" } {
  if (value === null) return { label: "check", status: "warning" };
  if (kind === "phi" && Math.abs(value) > limit) return { label: "check", status: "warning" };
  return Math.abs(value) <= limit
    ? { label: "pass", status: "pass" }
    : { label: "fail", status: "fail" };
}

function AshraeSourcePage({
  project,
  source,
  unitSystem,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const design = recordValue(source.data?.design_conditions);
  const url = stringValue(source.data?.url) ?? stringValue(source.data?.source_url);
  return (
    <div className="climate-detail-page">
      <SourceHeader project={project} source={source} subItems={[stringValue(design?.basis)]} />
      <ClimateSetFromNearest
        project={project}
        kind={source.kind}
        label="Set from nearest weather file"
      />
      <p className="climate-subhead">Design conditions</p>
      <div className="climate-metric-grid">
        <Metric label="Htg 99.6% DB" value={tempText(design?.heating_996_db_c, unitSystem)} />
        <Metric label="Htg 99% DB" value={tempText(design?.heating_990_db_c, unitSystem)} />
        <Metric label="Clg 1% DB" value={tempText(design?.cooling_010_db_c, unitSystem)} />
        <Metric label="Clg 1% MCWB" value={tempText(design?.cooling_010_mcwb_c, unitSystem)} />
        <Metric
          label="Dehum 1% DP"
          value={tempText(design?.dehumidification_010_dp_c, unitSystem)}
        />
        <Metric
          label="Dehum 1% MCDB"
          value={tempText(design?.dehumidification_010_mcdb_c, unitSystem)}
        />
      </div>
      {url ? (
        <div className="climate-link-row">
          <a className="secondary-button" href={url}>
            Open ASHRAE source
          </a>
        </div>
      ) : null}
    </div>
  );
}

function EpwSourcePage({
  project,
  source,
  unitSystem,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const metrics = recordValue(source.data?.stat_metrics);
  const sourceUrl = stringValue(source.data?.source_url);
  return (
    <div className="climate-detail-page">
      <SourceHeader project={project} source={source} />
      <ClimateSetFromNearest
        project={project}
        kind={source.kind}
        label="Set from nearest weather file"
      />
      <p className="climate-subhead">Derived metrics</p>
      <div className="climate-metric-grid">
        <Metric label="HDD65" value={numberText(metrics?.hdd65_f_days, 0)} />
        <Metric label="CDD50" value={numberText(metrics?.cdd50_f_days, 0)} />
        <Metric label="Record low" value={tempText(metrics?.record_low_c, unitSystem)} />
        <Metric label="Record high" value={tempText(metrics?.record_high_c, unitSystem)} />
      </div>
      <div className="climate-link-row">
        {sourceUrl ? (
          <a className="secondary-button" href={sourceUrl}>
            Open OneBuilding source
          </a>
        ) : null}
        {source.ref ? (
          <a className="secondary-button" href={assetDownloadPath(project.id, source.ref)}>
            Download stored EPW
          </a>
        ) : null}
      </div>
      {project.access_mode === "editor" ? <ProjectEpwControls project={project} /> : null}
    </div>
  );
}

function ProjectEpwControls({ project }: { project: ProjectDetail }) {
  const form = useProjectLocationForm(project.id);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedEpw, setParsedEpw] = useState<EpwParseResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const linkedAssetId = form.values.epwAssetId || form.location?.epw_asset_id;
  const savedEpw = form.location?.epw;
  const linkedFilename =
    parsedEpw?.filename ?? (savedEpw && linkedAssetId === savedEpw.id ? savedEpw.filename : null);

  const uploadEpw = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setSaveError(null);
    setIsUploading(true);
    try {
      const assetId = await uploadAsset(project.id, "epw", file);
      setParsedEpw(await form.parseEpw(assetId));
    } catch (error) {
      setUploadError(errorMessage(error, "Could not upload or parse the EPW file."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveWeatherFile = async () => {
    setSaveError(null);
    try {
      await form.save();
    } catch (error) {
      setSaveError(errorMessage(error, "Could not save the EPW weather file settings."));
    }
  };

  return (
    <section className="climate-epw-tools" aria-labelledby="climate-epw-tools-title">
      <div>
        <p id="climate-epw-tools-title" className="climate-subhead">
          Weather file
        </p>
        <p className="form-note">
          Temporary home for EPW upload and source tracking while the EPW page is refactored.
        </p>
      </div>
      <label className="settings-location-wide">
        <span>EPW source URL</span>
        <input
          value={form.values.epwSourceUrl}
          maxLength={1000}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            form.updateField("epwSourceUrl", event.target.value)
          }
          placeholder="https://climate.onebuilding.org/..."
        />
      </label>
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
            <a className="secondary-button" href={assetDownloadPath(project.id, linkedAssetId)}>
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
      {form.validationError ? <p className="form-error">{form.validationError}</p> : null}
      {saveError ? (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      ) : null}
      {form.warnings.length > 0 ? (
        <div className="draft-banner" role="status">
          {form.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      <div className="climate-link-row">
        <button
          type="button"
          className="primary-button"
          onClick={() => void saveWeatherFile()}
          disabled={!form.canSave || form.isSaving || Boolean(form.validationError)}
        >
          {form.isSaving ? "Saving…" : "Save EPW Settings"}
        </button>
      </div>
    </section>
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

function CustomSourcePage({
  project,
  source,
  unitSystem,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const record = isClimateRecord(source.data) ? source.data : null;
  return (
    <div className="climate-detail-page">
      <SourceHeader project={project} source={source} />
      {record ? (
        <ClimateRecordView record={record} unitSystem={unitSystem} />
      ) : (
        <p className="form-note">No custom climate record is stored.</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="climate-metric-card">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function proximityRecord(source: ProjectClimateSource): Record<string, unknown> | null {
  const data = recordValue(source.data);
  return recordValue(data?.proximity) ?? data;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberText(value: unknown, fractionDigits = 1): string {
  const valueNumber = numberValue(value);
  return valueNumber !== null ? formatSi(valueNumber, fractionDigits) : "—";
}

function tempText(value: unknown, unitSystem: UnitSystem): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatTemperatureFromC(value, { unitSystem })
    : "—";
}
