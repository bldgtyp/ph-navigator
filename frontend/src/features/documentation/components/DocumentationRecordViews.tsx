import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusSelect } from "../../../shared/ui";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, SITE_PHOTO_ATTACHMENT_CONFIG } from "../../assets/lib";
import type { AssetUrls, AttachmentFieldConfig } from "../../assets/types";
import type { DocumentationFieldChange } from "../hooks";
import {
  EVIDENCE_STATUS_OPTIONS,
  SPEC_STATUS_OPTIONS,
  documentationEvidenceStatusValue,
  documentationSpecStatusValue,
  type DocumentationStatusOption,
} from "../lib";
import type { DocumentationEvidenceStatus, DocumentationRecord } from "../types";

export function DocumentationRecordRow({
  projectId,
  record,
  assetUrlById,
  canEdit,
  writing,
  expanded,
  onToggle,
  onDatasheetChange,
  onPhotoChange,
  onFieldChange,
}: {
  projectId: string;
  record: DocumentationRecord;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  writing: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDatasheetChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onFieldChange: (change: DocumentationFieldChange) => Promise<void>;
}) {
  const specNa = record.spec_status === "na";
  return (
    <article
      className="documentation-record"
      data-spec-status={record.spec_status}
      data-expanded={expanded}
      role="listitem"
    >
      <div
        className="documentation-record-summary"
        onClick={(event) => {
          // Row-wide expand toggle, except when the click lands on a status
          // select (which changes its own value), the name button (which
          // toggles itself — guarding it avoids a double toggle), or the
          // open-owner link (which navigates).
          if ((event.target as HTMLElement).closest(".status-select, button, a")) return;
          onToggle();
        }}
      >
        <div className="documentation-record-main">
          <div className="documentation-record-label">
            <div className="documentation-record-name-row">
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
              <Link
                className="documentation-record-open-owner"
                to={record.table_path}
                aria-label={`Open record - ${record.display_name}`}
                title="Open record"
              >
                <ExternalLink size={14} aria-hidden="true" />
              </Link>
            </div>
            {record.sub_label ? <p>{record.sub_label}</p> : null}
          </div>
        </div>
        <AxisStatusCell
          label="Spec"
          value={documentationSpecStatusValue(record)}
          options={SPEC_STATUS_OPTIONS}
          canEdit={canEdit}
          disabled={writing}
          onChange={(value) => onFieldChange({ record, field: "spec_status", value })}
        />
        <AxisStatusCell
          label="Datasheet"
          value={documentationEvidenceStatusValue(record, "datasheet")}
          options={EVIDENCE_STATUS_OPTIONS}
          canEdit={canEdit && !specNa}
          disabled={writing}
          onChange={(value) => onFieldChange({ record, field: "datasheet_status", value })}
        />
        <AxisStatusCell
          label="Photos"
          value={documentationEvidenceStatusValue(record, "photo")}
          options={EVIDENCE_STATUS_OPTIONS}
          canEdit={canEdit && !specNa}
          disabled={writing}
          onChange={(value) => onFieldChange({ record, field: "photo_status", value })}
        />
      </div>
      {expanded ? (
        <div className="documentation-record-panel">
          <EvidenceCell
            label="Datasheet"
            status={documentationEvidenceStatusValue(record, "datasheet")}
            assetIds={record.datasheet_asset_ids}
          >
            <DocumentationEvidenceAttachmentControl
              projectId={projectId}
              record={record}
              axis="datasheet"
              assetUrlById={assetUrlById}
              canEdit={canEdit}
              writing={writing}
              variant="cell"
              onDatasheetChange={onDatasheetChange}
              onPhotoChange={onPhotoChange}
            />
          </EvidenceCell>
          <EvidenceCell
            label="Photos"
            status={documentationEvidenceStatusValue(record, "photo")}
            assetIds={record.photo_asset_ids}
          >
            <DocumentationEvidenceAttachmentControl
              projectId={projectId}
              record={record}
              axis="photo"
              assetUrlById={assetUrlById}
              canEdit={canEdit}
              writing={writing}
              variant="cell"
              onDatasheetChange={onDatasheetChange}
              onPhotoChange={onPhotoChange}
            />
          </EvidenceCell>
        </div>
      ) : null}
    </article>
  );
}

function EvidenceCell({
  label,
  status,
  assetIds,
  children,
}: {
  label: string;
  status: DocumentationEvidenceStatus;
  assetIds: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <div
      className="documentation-cell documentation-evidence-cell"
      data-done={status === "complete" || status === "na" ? "true" : "false"}
    >
      <div className="documentation-cell-header">
        <span className="documentation-cell-label">{label}</span>
      </div>
      {assetIds.length > 0 || status !== "na" ? children : null}
    </div>
  );
}

export function DocumentationEvidenceAttachmentControl({
  projectId,
  record,
  axis,
  assetUrlById,
  canEdit,
  writing,
  variant,
  onDatasheetChange,
  onPhotoChange,
}: {
  projectId: string;
  record: DocumentationRecord;
  axis: "datasheet" | "photo";
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  writing: boolean;
  variant: "cell" | "card";
  onDatasheetChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
}) {
  const specNa = record.spec_status === "na";
  const assetIds = axis === "datasheet" ? record.datasheet_asset_ids : record.photo_asset_ids;
  const config = axis === "datasheet" ? DATASHEET_ATTACHMENT_CONFIG : SITE_PHOTO_ATTACHMENT_CONFIG;
  const status = documentationEvidenceStatusValue(record, axis);
  if (canEdit && !specNa) {
    return (
      <AttachmentCell
        projectId={projectId}
        value={assetIds}
        config={config}
        readOnly={writing || status === "na"}
        onChange={(nextAssetIds) =>
          axis === "datasheet"
            ? onDatasheetChange(record, nextAssetIds)
            : onPhotoChange(record, nextAssetIds)
        }
        assetUrlById={assetUrlById}
        showInlineEmptyButton
        variant={variant}
      />
    );
  }
  return (
    <ReadOnlyAttachmentStrip assetIds={assetIds} assetUrlById={assetUrlById} variant={variant} />
  );
}

export function AxisStatusCell<TValue extends string>({
  label,
  value,
  options,
  canEdit,
  disabled,
  onChange,
}: {
  label: string;
  value: TValue;
  options: Array<DocumentationStatusOption<TValue>>;
  canEdit: boolean;
  disabled: boolean;
  onChange: (value: TValue) => Promise<void>;
}) {
  // A <div> (not <label>) wrapper: clicking the cell's non-select area should
  // toggle the row's expansion, not get forwarded into the select.
  return (
    <div className="documentation-cell documentation-spec-cell">
      <span className="documentation-cell-label">{label}</span>
      <StatusSelect
        value={value}
        options={options}
        ariaLabel={label}
        disabled={disabled}
        readOnly={!canEdit}
        onChange={(next) => void onChange(next)}
      />
    </div>
  );
}

function ReadOnlyAttachmentStrip({
  assetIds,
  assetUrlById,
  variant,
}: {
  assetIds: readonly string[];
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  variant: "cell" | "card";
}) {
  return (
    <div
      className={`attachment-cell attachment-cell--${variant} documentation-readonly-attachments`}
    >
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
