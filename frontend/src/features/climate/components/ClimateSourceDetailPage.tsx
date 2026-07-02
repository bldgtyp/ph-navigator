// @size-exception: planning/archive/climate-dataset-picker/PRD.md
import { useState, type ReactNode } from "react";
import { Download, MapPin, Trash2 } from "lucide-react";
import type { UnitSystem } from "../../../lib/units";
import { formatTemperatureFromC } from "../../../lib/units/temperature";
import { errorMessage } from "../../../shared/lib/errors";
import { AppMenu, AppMenuLink } from "../../../shared/ui/AppMenu";
import { assetDownloadPath } from "../../assets/api";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail } from "../../projects/types";
import {
  useAttachedClimateRecordQuery,
  useDeleteClimateSourceMutation,
  useDeriveClimateSourceMutation,
} from "../hooks";
import {
  climateSourceBadgeVersion,
  climateLocationTitle,
  climateSourceProximity,
  climateSourceProximityStatus,
  climateSourceStatusChip,
  climateSourceSubtitle,
  formatSi,
  isClimateRecord,
} from "../lib";
import type { ClimateSourceKind, ProjectClimateSource } from "../types";
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
  weather: {
    title: "Weather file",
    subtitle: "Set the nearest EPW + STAT bundle, or upload one manually.",
  },
  custom: {
    title: "Custom climate record",
    subtitle: "Add a custom climate record.",
  },
};

// The empty-state page for a canonical climate type with no attached source.
// PH and weather source actions live on their selected sidebar cards.
export function MissingSourcePage({
  project,
  kind,
}: {
  project: Pick<ProjectDetail, "id" | "access_mode">;
  kind: ClimateSourceKind;
}) {
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
      {!isPh && kind !== "weather" ? (
        <ClimateSetFromNearest
          project={project}
          kind={kind}
          label="Set from nearest weather file"
          variant="primary"
        />
      ) : null}
    </div>
  );
}

// "Set from nearest" action for one climate page: derives + attaches the type's
// source from the project's saved coordinates, surfacing derive warnings and a
// hint when the location is not yet set. `weather` is the EPW + STAT bundle. The
// action is inherently editor-only, so it self-guards rather than asking every
// caller to gate it.
export function ClimateSetFromNearest({
  project,
  kind,
  label,
  variant = "secondary",
  onDerived,
}: {
  project: Pick<ProjectDetail, "id" | "access_mode">;
  kind: ClimateSourceKind;
  label: string;
  variant?: "primary" | "secondary";
  onDerived?: () => void;
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
      onDerived?.();
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
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  if (source.kind === "phius" || source.kind === "phi") {
    return <PassiveHouseSourcePage project={project} source={source} unitSystem={unitSystem} />;
  }
  if (source.kind === "weather") {
    return <WeatherSourcePage project={project} source={source} unitSystem={unitSystem} />;
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
  showActions = true,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  title?: string;
  subItems?: (string | null)[];
  detail?: ReactNode;
  onChangeDataset?: () => void;
  showActions?: boolean;
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
      {canEdit && showActions ? (
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
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const query = useAttachedClimateRecordQuery(project.id, source.id);
  const record = query.data?.record;
  const title = climateLocationTitle(query.data, climateSourceSubtitle(source));
  return (
    <div className="climate-detail-page">
      <SourceHeader
        project={project}
        source={source}
        title={title}
        detail={<PhLimitCheck source={source} unitSystem={unitSystem} />}
        subItems={[]}
        showActions={false}
      />
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

// The merged Weather File page: one station's EPW + STAT bundle. Shows the
// location name, the STAT performance metrics (HDD/CDD/records), and the full
// ASHRAE design-condition set (heating + cooling DB/MCWB across 0.4/1/2%), all
// in the app's SI/IP unit system (D-CL-21).
function WeatherSourcePage({
  project,
  source,
  unitSystem,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const metrics = recordValue(source.data?.stat_metrics);
  const design = recordValue(source.data?.design_conditions);
  const station = recordValue(source.data?.station);
  const stationName = stringValue(station?.name) ?? stringValue(source.label);
  const sourceUrl = stringValue(source.data?.source_url);
  const statAssetId = stringValue(source.data?.stat_asset_id);
  const ddyAssetId = stringValue(source.data?.ddy_asset_id);
  return (
    <div className="climate-detail-page climate-detail-page--with-main-menu">
      <WeatherFileActionsMenu
        projectId={project.id}
        sourceUrl={sourceUrl}
        epwAssetId={source.ref}
        statAssetId={statAssetId}
        ddyAssetId={ddyAssetId}
      />
      <SourceHeader
        project={project}
        source={source}
        title={stationName ?? undefined}
        subItems={[stringValue(design?.basis)]}
        showActions={false}
      />
      <p className="climate-subhead">Performance</p>
      <div className="climate-metric-grid">
        <Metric label="HDD65" value={numberText(metrics?.hdd65_f_days, 0)} />
        <Metric label="CDD50" value={numberText(metrics?.cdd50_f_days, 0)} />
        <Metric label="Record low" value={tempText(metrics?.record_low_c, unitSystem)} />
        <Metric label="Record high" value={tempText(metrics?.record_high_c, unitSystem)} />
      </div>
      <p className="climate-subhead">Design conditions</p>
      <div className="climate-metric-grid">
        <Metric label="Htg 99.6% DB" value={tempText(design?.heating_996_db_c, unitSystem)} />
        <Metric label="Htg 99% DB" value={tempText(design?.heating_990_db_c, unitSystem)} />
        <Metric label="Clg 0.4% DB" value={tempText(design?.cooling_004_db_c, unitSystem)} />
        <Metric label="Clg 1% DB" value={tempText(design?.cooling_010_db_c, unitSystem)} />
        <Metric label="Clg 2% DB" value={tempText(design?.cooling_020_db_c, unitSystem)} />
        <Metric label="Clg 0.4% MCWB" value={tempText(design?.cooling_004_mcwb_c, unitSystem)} />
        <Metric label="Clg 1% MCWB" value={tempText(design?.cooling_010_mcwb_c, unitSystem)} />
        <Metric label="Clg 2% MCWB" value={tempText(design?.cooling_020_mcwb_c, unitSystem)} />
        <Metric
          label="Dehum 1% DP"
          value={tempText(design?.dehumidification_010_dp_c, unitSystem)}
        />
        <Metric
          label="Dehum 1% MCDB"
          value={tempText(design?.dehumidification_010_mcdb_c, unitSystem)}
        />
      </div>
    </div>
  );
}

function WeatherFileActionsMenu({
  projectId,
  sourceUrl,
  epwAssetId,
  statAssetId,
  ddyAssetId,
}: {
  projectId: string;
  sourceUrl: string | null;
  epwAssetId: string | null;
  statAssetId: string | null;
  ddyAssetId: string | null;
}) {
  if (!sourceUrl && !epwAssetId && !statAssetId && !ddyAssetId) return null;
  return (
    <AppMenu label="Weather file actions" className="climate-main-menu">
      {sourceUrl ? (
        <AppMenuLink icon={Download} href={sourceUrl}>
          Download OneBuilding .zip file
        </AppMenuLink>
      ) : null}
      {epwAssetId ? (
        <AssetDownloadMenuLink projectId={projectId} assetId={epwAssetId} label="EPW" />
      ) : null}
      {statAssetId ? (
        <AssetDownloadMenuLink projectId={projectId} assetId={statAssetId} label="STAT" />
      ) : null}
      {ddyAssetId ? (
        <AssetDownloadMenuLink projectId={projectId} assetId={ddyAssetId} label="DDY" />
      ) : null}
    </AppMenu>
  );
}

function AssetDownloadMenuLink({
  projectId,
  assetId,
  label,
}: {
  projectId: string;
  assetId: string;
  label: string;
}) {
  return (
    <AppMenuLink icon={Download} href={assetDownloadPath(projectId, assetId)}>
      Download {label}
    </AppMenuLink>
  );
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
