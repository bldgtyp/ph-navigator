import { Trash2 } from "lucide-react";
import type { UnitSystem } from "../../../lib/units";
import { formatTemperatureFromC } from "../../../lib/units/temperature";
import { assetDownloadPath } from "../../assets/api";
import type { ProjectDetail } from "../../projects/types";
import {
  useClimateLocationQuery,
  useDeleteClimateSourceMutation,
  useSetClimateSourceDefaultMutation,
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
import type { ClimatePeakLoad, PhClimateKind, ProjectClimateSource } from "../types";
import { ClimateStatusChip, ClimateTypeBadge } from "./ClimateAtoms";
import { ClimateRecordView } from "./ClimateRecordView";

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
  if (source.kind === "phius" && climateSourceProximityStatus(source) === "fail") {
    return (
      <FailPage
        project={project}
        source={source}
        onChangeDataset={onOpenPicker ? () => onOpenPicker("phius") : undefined}
      />
    );
  }
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
// the editor's default/remove actions, used by every source page.
function SourceHeader({
  project,
  source,
  title,
  subItems,
  onChangeDataset,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  title?: string;
  subItems?: (string | null)[];
  onChangeDataset?: () => void;
}) {
  const canEdit = project.access_mode === "editor";
  const status = climateSourceStatusChip(source);
  const setDefault = useSetClimateSourceDefaultMutation(project.id);
  const remove = useDeleteClimateSourceMutation(project.id);
  const busy = setDefault.isPending || remove.isPending;
  const items = (subItems ?? [climateSourceProximity(source)]).filter((item): item is string =>
    Boolean(item),
  );
  return (
    <header className="climate-page-head">
      <div>
        <div className="climate-page-badges">
          <ClimateTypeBadge kind={source.kind} version={climateSourceBadgeVersion(source)} />
          <ClimateStatusChip tone={status.tone} label={status.label} />
          {source.is_default ? (
            <span className="chip chip--sm climate-status-chip climate-status-pass">★ Default</span>
          ) : null}
        </div>
        <h3 className="climate-page-title">{title ?? climateSourceSubtitle(source)}</h3>
        {items.length > 0 ? (
          <div className="climate-page-sub">
            {items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <div className="climate-page-head-actions">
          {onChangeDataset ? (
            <button
              type="button"
              className="secondary-button"
              onClick={onChangeDataset}
              disabled={busy}
            >
              Change dataset
            </button>
          ) : null}
          {!source.is_default ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDefault.mutate(source.id)}
              disabled={busy}
            >
              ★ Set default
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
      <SourceHeader project={project} source={source} onChangeDataset={onChangeDataset} />
      {query.isLoading ? <p className="form-note">Loading climate record…</p> : null}
      {query.error ? <p className="form-error">Could not load climate record.</p> : null}
      {record ? (
        <>
          <PeakLoads loads={record.climate.peak_loads} unitSystem={unitSystem} />
          <ClimateRecordView record={record} unitSystem={unitSystem} />
        </>
      ) : null}
    </div>
  );
}

function PeakLoads({
  loads,
  unitSystem,
}: {
  loads: {
    heat_load_1: ClimatePeakLoad;
    heat_load_2: ClimatePeakLoad;
    cooling_load_1: ClimatePeakLoad;
    cooling_load_2: ClimatePeakLoad;
  };
  unitSystem: UnitSystem;
}) {
  return (
    <section>
      <p className="climate-subhead">Peak loads · design temperatures</p>
      <div className="climate-metric-grid">
        <Metric label="Heating 1" value={tempText(loads.heat_load_1.temp_c, unitSystem)} />
        <Metric label="Heating 2" value={tempText(loads.heat_load_2.temp_c, unitSystem)} />
        <Metric label="Cooling 1" value={tempText(loads.cooling_load_1.temp_c, unitSystem)} />
        <Metric label="Cooling 2" value={tempText(loads.cooling_load_2.temp_c, unitSystem)} />
      </div>
    </section>
  );
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
    </div>
  );
}

function FailPage({
  project,
  source,
  onChangeDataset,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  onChangeDataset?: () => void;
}) {
  const candidates = candidateRows(source.data?.nearest_candidates);
  return (
    <div className="climate-detail-page">
      <SourceHeader
        project={project}
        source={source}
        title="No qualifying Phius dataset"
        subItems={["rule: ≤ 50 mi AND ≤ 400 ft", climateSourceProximity(source)]}
        onChangeDataset={onChangeDataset}
      />
      <div className="climate-fail-hero">
        <ClimateStatusChip tone="fail" label="Certification blocker" />
        <h4>A custom Phius climate set is required.</h4>
        <p>
          {stringValue(source.data?.message) ??
            "The nearest Phius station is outside the 50 mi / 400 ft limit. Phius does not " +
              "interpolate, so a custom climate data set must be requested, or the basis changed."}
        </p>
        <div className="climate-fail-actions">
          <a className="primary-button" href="https://www.phius.org/climate-data">
            Request custom set · $75
          </a>
          {onChangeDataset ? (
            <button type="button" className="secondary-button" onClick={onChangeDataset}>
              Browse datasets to override
            </button>
          ) : null}
        </div>
      </div>
      {candidates.length > 0 ? (
        <table className="climate-table">
          <caption>Why — nearest candidates</caption>
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Distance</th>
              <th scope="col">Δ elevation</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.name}>
                <th scope="row">{candidate.name}</th>
                <td>{candidate.distance}</td>
                <td>{candidate.elevation}</td>
                <td>{candidate.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="climate-section-note">
        Prescriptive-path note: outside the limits, custom data is not allowed — performance path
        only.
      </p>
    </div>
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

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberText(value: unknown, fractionDigits = 1): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatSi(value, fractionDigits)
    : "—";
}

function tempText(value: unknown, unitSystem: UnitSystem): string {
  return typeof value === "number" && Number.isFinite(value)
    ? formatTemperatureFromC(value, { unitSystem })
    : "—";
}

function candidateRows(value: unknown): {
  name: string;
  distance: string;
  elevation: string;
  status: string;
}[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const record = recordValue(item);
        const name = stringValue(record?.name) ?? stringValue(record?.label);
        if (!record || !name) return [];
        return [
          {
            name,
            distance: numberText(record.distance_mi, 1),
            elevation: numberText(record.elevation_delta_ft, 0),
            status: stringValue(record.status) ?? "check",
          },
        ];
      })
    : [];
}
