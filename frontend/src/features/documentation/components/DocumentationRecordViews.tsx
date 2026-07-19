import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { SITE_PHOTO_ATTACHMENT_CONFIG } from "../../assets/lib";
import type { AssetUrls, AttachmentFieldConfig } from "../../assets/types";
import type { DocumentationFieldChange } from "../hooks";
import { axisDone, SPEC_STATUS_LABELS } from "../lib";
import type { DocumentationRecord, DocumentationSpecStatus } from "../types";

export function DocumentationRecordRow({
  projectId,
  sectionKey,
  record,
  assetUrlById,
  canEdit,
  writing,
  expanded,
  onToggle,
  onPhotoChange,
  onFieldChange,
  onOpenRecord,
}: {
  projectId: string;
  sectionKey: string;
  record: DocumentationRecord;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  writing: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onFieldChange: (change: DocumentationFieldChange) => Promise<void>;
  onOpenRecord: (record: DocumentationRecord) => void;
}) {
  const specNa = record.spec_status === "na";
  return (
    <article className="documentation-record" data-spec-status={record.spec_status} role="listitem">
      <div className="documentation-record-summary">
        <div className="documentation-record-main">
          {sectionKey === "envelope" ? (
            <MiniAssemblyStrip segmentCount={record.segment_ids.length} />
          ) : null}
          <div className="documentation-record-label">
            <button
              type="button"
              className="documentation-record-name"
              onClick={onToggle}
              aria-expanded={expanded}
            >
              <span aria-hidden="true">
                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </span>
              <span>{record.display_name}</span>
            </button>
            {record.sub_label ? <p>{record.sub_label}</p> : null}
          </div>
        </div>
        <SpecCell
          record={record}
          canEdit={canEdit}
          disabled={writing}
          onChange={(value) => onFieldChange({ record, field: "spec_status", value })}
        />
        <EvidenceSummaryCell
          label="Datasheet"
          done={axisDone(record, "datasheet")}
          notRequired={record.datasheet_not_required || specNa}
          assetIds={record.datasheet_asset_ids}
          emptyLabel="Missing"
        />
        <EvidenceSummaryCell
          label="Photos"
          done={axisDone(record, "photo")}
          notRequired={record.photo_not_required || specNa}
          assetIds={record.photo_asset_ids}
          emptyLabel="Photo needed"
        />
      </div>
      {expanded ? (
        <div className="documentation-record-panel">
          <div className="documentation-record-panel-actions">
            <Link className="documentation-owner-link" to={record.table_path}>
              <ExternalLink size={13} aria-hidden="true" />
              <span>Open owner</span>
            </Link>
            <button
              type="button"
              className="secondary-button documentation-record-details"
              onClick={() => onOpenRecord(record)}
            >
              Details
            </button>
          </div>
          <EvidenceCell
            label="Datasheet"
            done={axisDone(record, "datasheet")}
            notRequired={record.datasheet_not_required || specNa}
            waiverChecked={record.datasheet_not_required}
            canEdit={canEdit && !specNa}
            disabled={writing}
            onWaiverChange={(value) =>
              onFieldChange({ record, field: "datasheet_not_required", value })
            }
            assetIds={record.datasheet_asset_ids}
            emptyLabel="Missing"
          >
            <ReadOnlyAttachmentStrip
              assetIds={record.datasheet_asset_ids}
              assetUrlById={assetUrlById}
            />
          </EvidenceCell>
          <EvidenceCell
            label="Photos"
            done={axisDone(record, "photo")}
            notRequired={record.photo_not_required || specNa}
            waiverChecked={record.photo_not_required}
            canEdit={canEdit && !specNa}
            disabled={writing}
            onWaiverChange={(value) =>
              onFieldChange({ record, field: "photo_not_required", value })
            }
            assetIds={record.photo_asset_ids}
            emptyLabel="Photo needed"
          >
            {canEdit && !specNa ? (
              <AttachmentCell
                projectId={projectId}
                value={record.photo_asset_ids}
                config={SITE_PHOTO_ATTACHMENT_CONFIG}
                readOnly={writing || record.photo_not_required}
                onChange={(nextAssetIds) => onPhotoChange(record, nextAssetIds)}
                assetUrlById={assetUrlById}
                variant="cell"
              />
            ) : (
              <ReadOnlyAttachmentStrip
                assetIds={record.photo_asset_ids}
                assetUrlById={assetUrlById}
              />
            )}
          </EvidenceCell>
        </div>
      ) : null}
    </article>
  );
}

export function SpecCell({
  record,
  canEdit,
  disabled,
  onChange,
}: {
  record: DocumentationRecord;
  canEdit: boolean;
  disabled: boolean;
  onChange: (value: DocumentationSpecStatus) => Promise<void>;
}) {
  if (canEdit) {
    return (
      <label className="documentation-cell documentation-spec-cell">
        <span className="documentation-cell-label">Spec</span>
        <select
          className="documentation-spec-select"
          value={record.spec_status === "unknown" ? "needed" : record.spec_status}
          disabled={disabled}
          onChange={(event) => void onChange(event.target.value as DocumentationSpecStatus)}
        >
          <option value="needed">Needed</option>
          <option value="question">Question</option>
          <option value="complete">Complete</option>
          <option value="na">N/A</option>
        </select>
      </label>
    );
  }
  return (
    <div className="documentation-cell documentation-spec-cell">
      <span className="documentation-cell-label">Spec</span>
      <span className={`record-status-chip record-status-chip--${record.spec_status}`}>
        {SPEC_STATUS_LABELS[record.spec_status]}
      </span>
    </div>
  );
}

function EvidenceCell({
  label,
  done,
  notRequired,
  waiverChecked,
  canEdit,
  disabled,
  onWaiverChange,
  assetIds,
  emptyLabel,
  children,
}: {
  label: string;
  done: boolean;
  notRequired: boolean;
  waiverChecked: boolean;
  canEdit: boolean;
  disabled: boolean;
  onWaiverChange: (value: boolean) => Promise<void>;
  assetIds: readonly string[];
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="documentation-cell documentation-evidence-cell"
      data-done={done ? "true" : "false"}
    >
      <div className="documentation-cell-header">
        <span className="documentation-cell-label">{label}</span>
        <EvidenceState notRequired={notRequired} assetIds={assetIds} emptyLabel={emptyLabel} />
      </div>
      {canEdit ? (
        <label className="documentation-waiver-toggle">
          <input
            type="checkbox"
            aria-label={`${label} not required`}
            checked={waiverChecked}
            disabled={disabled}
            onChange={(event) => void onWaiverChange(event.target.checked)}
          />
          <span>Not required</span>
        </label>
      ) : null}
      {assetIds.length > 0 || canEdit ? children : null}
    </div>
  );
}

function EvidenceSummaryCell({
  label,
  done,
  notRequired,
  assetIds,
  emptyLabel,
}: {
  label: string;
  done: boolean;
  notRequired: boolean;
  assetIds: readonly string[];
  emptyLabel: string;
}) {
  return (
    <div
      className="documentation-cell documentation-evidence-summary"
      data-done={done ? "true" : "false"}
    >
      <span className="documentation-cell-label">{label}</span>
      <EvidenceState notRequired={notRequired} assetIds={assetIds} emptyLabel={emptyLabel} />
    </div>
  );
}

function EvidenceState({
  notRequired,
  assetIds,
  emptyLabel,
}: {
  notRequired: boolean;
  assetIds: readonly string[];
  emptyLabel: string;
}) {
  if (notRequired) {
    return (
      <span className="documentation-evidence-state documentation-evidence-state--na">
        not required
      </span>
    );
  }
  if (assetIds.length === 0) {
    return (
      <span className="documentation-evidence-state documentation-evidence-state--missing">
        {emptyLabel}
      </span>
    );
  }
  return (
    <span className="documentation-evidence-state documentation-evidence-state--attached">
      {assetIds.length} attached
    </span>
  );
}

function MiniAssemblyStrip({ segmentCount }: { segmentCount: number }) {
  const bands = Math.max(1, Math.min(segmentCount, 5));
  return (
    <span className="documentation-assembly-strip" aria-label={`${segmentCount} assembly segments`}>
      {Array.from({ length: bands }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}

function ReadOnlyAttachmentStrip({
  assetIds,
  assetUrlById,
}: {
  assetIds: readonly string[];
  assetUrlById: ReadonlyMap<string, AssetUrls>;
}) {
  return (
    <div className="attachment-cell attachment-cell--card documentation-readonly-attachments">
      <div className="attachment-strip">
        {assetIds.map((assetId, index) => {
          const asset = assetUrlById.get(assetId);
          const glyph = fileGlyph(asset?.content_type);
          return (
            <span
              key={`${assetId}-${index}`}
              className="attachment-thumb documentation-readonly-thumb"
              title={asset ? `${asset.original_filename} · ${asset.content_type}` : assetId}
            >
              {asset?.thumbnail_url ? (
                <img src={asset.thumbnail_url} alt="" />
              ) : (
                <span className="attachment-doc-thumb" data-kind={glyph.toLowerCase()}>
                  <span>{glyph}</span>
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ReadOnlyAttachmentCell({
  projectId,
  assetIds,
  config,
  assetUrlById,
}: {
  projectId: string;
  assetIds: string[];
  config: AttachmentFieldConfig;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
}) {
  return (
    <AttachmentCell
      projectId={projectId}
      value={assetIds}
      config={config}
      readOnly
      onChange={() => undefined}
      assetUrlById={assetUrlById}
      variant="card"
    />
  );
}

function fileGlyph(contentType: string | undefined | null): string {
  if (contentType === "application/pdf") return "PDF";
  if (contentType?.includes("json")) return "JSON";
  return "FILE";
}
