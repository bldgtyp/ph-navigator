import { useState } from "react";
import { Trash2 } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import type { ProjectLocation } from "../../projects/types";
import { useClimateSourcesQuery, useDeleteClimateSourceMutation } from "../hooks";
import {
  climateSourceCachedMetrics,
  climateSourceKindLabel,
  climateSourceProximity,
  climateSourceProximityStatus,
  climateSourceSubtitle,
  isClimateRecord,
} from "../lib";
import type { CreateClimateSourceRequest, ProjectClimateSource } from "../types";

// The project's attached climate sources (D-CL-4): a roster plus the
// non-dataset attach affordances (ASHRAE pointer, the project EPW). Phius/PHI
// sources are attached from the reference-dataset browser, which calls the
// same `onAttach`.
export function ClimateSourcesSection({
  project,
  location,
  onAttach,
  isAttaching,
  attachError,
}: {
  project: ProjectDetail;
  location: ProjectLocation | undefined;
  onAttach: (body: CreateClimateSourceRequest) => void;
  isAttaching: boolean;
  attachError: Error | null;
}) {
  const canEdit = project.access_mode === "editor";
  const sourcesQuery = useClimateSourcesQuery(project.id);
  const deleteMutation = useDeleteClimateSourceMutation(project.id);

  if (sourcesQuery.isLoading) {
    return <p className="form-note">Loading climate sources…</p>;
  }
  if (sourcesQuery.error) {
    return (
      <p className="form-error">
        {errorMessage(sourcesQuery.error, "Could not load climate sources.")}
      </p>
    );
  }

  const sources = sourcesQuery.data ?? [];
  const rosterError = deleteMutation.error ?? attachError;

  return (
    <div className="climate-sources">
      {sources.length === 0 ? (
        <p className="form-note">No climate sources attached yet.</p>
      ) : (
        <ul className="climate-source-list">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              canEdit={canEdit}
              busy={deleteMutation.isPending}
              onRemove={() => deleteMutation.mutate(source.id)}
            />
          ))}
        </ul>
      )}

      {rosterError ? (
        <p className="form-error" role="alert">
          {errorMessage(rosterError, "Could not update climate sources.")}
        </p>
      ) : null}

      {canEdit ? (
        <div className="climate-source-attach">
          <AshraeAttachForm onAttach={onAttach} isAttaching={isAttaching} />
          <EpwAttachButton location={location} onAttach={onAttach} isAttaching={isAttaching} />
          <CustomRecordAttachForm onAttach={onAttach} isAttaching={isAttaching} />
        </div>
      ) : null}
    </div>
  );
}

function CustomRecordAttachForm({
  onAttach,
  isAttaching,
}: {
  onAttach: (body: CreateClimateSourceRequest) => void;
  isAttaching: boolean;
}) {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const attach = () => {
    setError(null);
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!isClimateRecord(parsed)) {
        setError("Paste a standardized ClimateRecord JSON object.");
        return;
      }
      onAttach({
        kind: "custom",
        label: parsed.display_name,
        data: parsed as unknown as Record<string, unknown>,
      });
      setJson("");
    } catch {
      setError("ClimateRecord JSON is not valid.");
    }
  };

  return (
    <div className="climate-source-form climate-source-form-wide">
      <span className="climate-source-form-title">Attach custom ClimateRecord</span>
      <textarea
        value={json}
        onChange={(event) => setJson(event.target.value)}
        placeholder='{"display_name":"Custom climate set", ...}'
        aria-label="Custom ClimateRecord JSON"
        rows={5}
      />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="secondary-button"
        onClick={attach}
        disabled={!json.trim() || isAttaching}
      >
        Attach custom record
      </button>
    </div>
  );
}

function SourceRow({
  source,
  canEdit,
  busy,
  onRemove,
}: {
  source: ProjectClimateSource;
  canEdit: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const kindLabel = climateSourceKindLabel(source.kind);
  const proximity = climateSourceProximity(source);
  const proximityStatus = climateSourceProximityStatus(source);
  const cachedMetrics = climateSourceCachedMetrics(source);
  return (
    <li className="climate-source-row">
      <span className="climate-source-kind">{kindLabel}</span>
      <span className="climate-source-label">
        <span>{climateSourceSubtitle(source)}</span>
        {proximity ? (
          <span
            className={`climate-source-proximity climate-source-proximity-${proximityStatus ?? "neutral"}`}
          >
            {proximity}
          </span>
        ) : null}
        {cachedMetrics ? <span className="climate-source-proximity">{cachedMetrics}</span> : null}
      </span>
      {canEdit ? (
        <button
          type="button"
          className="text-button climate-source-remove"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${kindLabel} source`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

function AshraeAttachForm({
  onAttach,
  isAttaching,
}: {
  onAttach: (body: CreateClimateSourceRequest) => void;
  isAttaching: boolean;
}) {
  const [station, setStation] = useState("");
  const [url, setUrl] = useState("");
  const trimmedStation = station.trim();

  const attach = () => {
    if (!trimmedStation) return;
    onAttach({
      kind: "ashrae",
      ref: trimmedStation,
      label: trimmedStation,
      data: url.trim() ? { url: url.trim() } : null,
    });
    setStation("");
    setUrl("");
  };

  return (
    <div className="climate-source-form">
      <span className="climate-source-form-title">Attach ASHRAE station</span>
      <div className="climate-source-form-row">
        <input
          value={station}
          onChange={(event) => setStation(event.target.value)}
          placeholder="Station id (e.g. 725060)"
          aria-label="ASHRAE station id"
        />
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="ashrae-meteo.info URL (optional)"
          aria-label="ASHRAE URL"
        />
        <button
          type="button"
          className="secondary-button"
          onClick={attach}
          disabled={!trimmedStation || isAttaching}
        >
          Attach
        </button>
      </div>
    </div>
  );
}

function EpwAttachButton({
  location,
  onAttach,
  isAttaching,
}: {
  location: ProjectLocation | undefined;
  onAttach: (body: CreateClimateSourceRequest) => void;
  isAttaching: boolean;
}) {
  const epwAssetId = location?.epw_asset_id ?? null;
  const epwName = location?.epw?.filename ?? null;

  return (
    <div className="climate-source-form">
      <span className="climate-source-form-title">Attach project EPW</span>
      {epwAssetId ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            onAttach({ kind: "epw", ref: epwAssetId, label: epwName ?? "Project EPW" })
          }
          disabled={isAttaching}
        >
          Attach {epwName ?? "EPW"}
        </button>
      ) : (
        <p className="form-note">Upload or link an EPW from the EPW page, then attach it here.</p>
      )}
    </div>
  );
}
