import type { UnitSystem } from "../../../lib/units";
import { assetDownloadPath } from "../../assets/api";
import type { ProjectDetail } from "../../projects/types";
import { useClimateLocationQuery } from "../hooks";
import {
  climateSourceCachedMetrics,
  climateSourceKindLabel,
  climateSourceProximity,
  climateSourceProximityStatus,
  climateSourceSubtitle,
  formatSi,
  isClimateRecord,
} from "../lib";
import type { ProjectClimateSource } from "../types";
import { ClimateRecordCharts } from "./ClimateRecordCharts";
import { ClimateRecordTable } from "./ClimateRecordTable";

export function ClimateSourceDetailPage({
  project,
  source,
  unitSystem,
}: {
  project: ProjectDetail;
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  if (source.kind === "phius" && climateSourceProximityStatus(source) === "fail") {
    return <FailPage source={source} />;
  }
  if (source.kind === "phius" || source.kind === "phi") {
    return <PassiveHouseSourcePage source={source} unitSystem={unitSystem} />;
  }
  if (source.kind === "ashrae") {
    return <AshraeSourcePage source={source} />;
  }
  if (source.kind === "epw") {
    return <EpwSourcePage projectId={project.id} source={source} />;
  }
  return <CustomSourcePage source={source} unitSystem={unitSystem} />;
}

function SourceHeader({ source }: { source: ProjectClimateSource }) {
  const proximity = climateSourceProximity(source);
  const metrics = climateSourceCachedMetrics(source);
  return (
    <header className="climate-detail-header">
      <span className="climate-source-kind">{climateSourceKindLabel(source.kind)}</span>
      <h3>{climateSourceSubtitle(source)}</h3>
      {source.is_default ? (
        <span className="climate-status-chip climate-status-pass">Default</span>
      ) : null}
      {proximity ? <p>{proximity}</p> : null}
      {metrics ? <p>{metrics}</p> : null}
    </header>
  );
}

function PassiveHouseSourcePage({
  source,
  unitSystem,
}: {
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const datasetId = stringValue(source.data?.dataset_id);
  const locationId = source.ref ?? stringValue(source.data?.location_id) ?? undefined;
  const query = useClimateLocationQuery(datasetId ?? undefined, locationId);
  return (
    <div className="climate-detail-page">
      <SourceHeader source={source} />
      {query.isLoading ? <p className="form-note">Loading climate record…</p> : null}
      {query.error ? <p className="form-error">Could not load climate record.</p> : null}
      {query.data ? (
        <>
          <ClimateRecordCharts record={query.data.record} unitSystem={unitSystem} />
          <ClimateRecordTable record={query.data.record} unitSystem={unitSystem} />
        </>
      ) : null}
    </div>
  );
}

function AshraeSourcePage({ source }: { source: ProjectClimateSource }) {
  const design = recordValue(source.data?.design_conditions);
  const url = stringValue(source.data?.url) ?? stringValue(source.data?.source_url);
  return (
    <div className="climate-detail-page">
      <SourceHeader source={source} />
      <div className="climate-metric-grid">
        <Metric label="Htg 99.6% DB" value={tempValue(design?.heating_996_db_c)} />
        <Metric label="Htg 99% DB" value={tempValue(design?.heating_990_db_c)} />
        <Metric label="Clg 1% DB" value={tempValue(design?.cooling_010_db_c)} />
        <Metric label="Clg 1% MCWB" value={tempValue(design?.cooling_010_mcwb_c)} />
        <Metric label="Dehum 1% DP" value={tempValue(design?.dehumidification_010_dp_c)} />
        <Metric label="Dehum 1% MCDB" value={tempValue(design?.dehumidification_010_mcdb_c)} />
      </div>
      <p className="climate-section-note">{stringValue(design?.basis) ?? "Basis not recorded"}</p>
      {url ? <a href={url}>Open ASHRAE source</a> : null}
    </div>
  );
}

function EpwSourcePage({ projectId, source }: { projectId: string; source: ProjectClimateSource }) {
  const metrics = recordValue(source.data?.stat_metrics);
  const sourceUrl = stringValue(source.data?.source_url);
  return (
    <div className="climate-detail-page">
      <SourceHeader source={source} />
      <div className="climate-metric-grid">
        <Metric label="HDD65" value={numberText(metrics?.hdd65_f_days, 0)} />
        <Metric label="CDD50" value={numberText(metrics?.cdd50_f_days, 0)} />
        <Metric label="Record low" value={tempValue(metrics?.record_low_c)} />
        <Metric label="Record high" value={tempValue(metrics?.record_high_c)} />
      </div>
      <div className="climate-link-row">
        {sourceUrl ? <a href={sourceUrl}>Open OneBuilding source</a> : null}
        {source.ref ? (
          <a href={assetDownloadPath(projectId, source.ref)}>Download stored EPW</a>
        ) : null}
      </div>
    </div>
  );
}

function FailPage({ source }: { source: ProjectClimateSource }) {
  const candidates = candidateRows(source.data?.nearest_candidates);
  return (
    <div className="climate-detail-page climate-fail-page">
      <SourceHeader source={source} />
      <h3>Certification blocker</h3>
      <p>{stringValue(source.data?.message) ?? "Custom climate set required."}</p>
      {candidates.length > 0 ? (
        <table className="climate-table">
          <caption>Why — nearest candidates</caption>
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Distance</th>
              <th scope="col">Elev delta</th>
              <th scope="col">Status</th>
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
      <div className="climate-link-row">
        <a href="https://www.phius.org/climate-data">Request custom set · $75</a>
        <a href="#climate-add-source">Browse to override</a>
      </div>
    </div>
  );
}

function CustomSourcePage({
  source,
  unitSystem,
}: {
  source: ProjectClimateSource;
  unitSystem: UnitSystem;
}) {
  const record = isClimateRecord(source.data) ? source.data : null;
  return (
    <div className="climate-detail-page">
      <SourceHeader source={source} />
      {record ? (
        <ClimateRecordTable record={record} unitSystem={unitSystem} />
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

function tempValue(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)} °C` : "—";
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
