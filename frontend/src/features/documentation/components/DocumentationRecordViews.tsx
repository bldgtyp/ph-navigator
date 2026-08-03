import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusSelect } from "../../../shared/ui";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, SITE_PHOTO_ATTACHMENT_CONFIG } from "../../assets/lib";
import type { AssetUrls } from "../../assets/types";
import type { DocumentationFieldChange } from "../hooks";
import {
  EVIDENCE_STATUS_OPTIONS,
  SPEC_STATUS_OPTIONS,
  documentationEvidenceStatusValue,
  documentationSpecStatusValue,
  type DocumentationStatusOption,
} from "../lib";
import type { DocumentationEvidenceStatus, DocumentationRecord } from "../types";
import { StatusAxisHeader } from "../../project_document/StatusVocabulary";
import {
  STATUS_AXIS_LABELS,
  STATUS_AXIS_TOOLTIPS,
  type DocumentationStatusAxis,
} from "../../project_document/specification-status";

export function DocumentationRecordRow({
  projectId,
  record,
  assetUrlById,
  assetUrlsPending,
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
  assetUrlsPending: boolean;
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
          axis="spec"
          value={documentationSpecStatusValue(record)}
          options={SPEC_STATUS_OPTIONS}
          canEdit={canEdit}
          disabled={writing}
          onChange={(value) => onFieldChange({ record, field: "spec_status", value })}
        />
        <AxisStatusCell
          axis="datasheet"
          value={documentationEvidenceStatusValue(record, "datasheet")}
          options={EVIDENCE_STATUS_OPTIONS}
          canEdit={canEdit && !specNa}
          disabled={writing}
          onChange={(value) => onFieldChange({ record, field: "datasheet_status", value })}
        />
        <AxisStatusCell
          axis="photo"
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
              assetUrlsPending={assetUrlsPending}
              canEdit={canEdit}
              writing={writing}
              variant="cell"
              onDatasheetChange={onDatasheetChange}
              onPhotoChange={onPhotoChange}
            />
          </EvidenceCell>
          <EvidenceCell
            label="Site Photos"
            status={documentationEvidenceStatusValue(record, "photo")}
            assetIds={record.photo_asset_ids}
          >
            <DocumentationEvidenceAttachmentControl
              projectId={projectId}
              record={record}
              axis="photo"
              assetUrlById={assetUrlById}
              assetUrlsPending={assetUrlsPending}
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

function DocumentationEvidenceAttachmentControl({
  projectId,
  record,
  axis,
  assetUrlById,
  assetUrlsPending,
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
  assetUrlsPending: boolean;
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
        assetUrlsPending={assetUrlsPending}
        showInlineEmptyButton
        variant={variant}
      />
    );
  }
  return (
    <AttachmentCell
      projectId={projectId}
      value={assetIds}
      config={config}
      readOnly
      onChange={() => undefined}
      assetUrlById={assetUrlById}
      assetUrlsPending={assetUrlsPending}
      variant={variant}
    />
  );
}

function AxisStatusCell<TValue extends string>({
  axis,
  value,
  options,
  canEdit,
  disabled,
  onChange,
}: {
  axis: DocumentationStatusAxis;
  value: TValue;
  options: Array<DocumentationStatusOption<TValue>>;
  canEdit: boolean;
  disabled: boolean;
  onChange: (value: TValue) => Promise<void>;
}) {
  const label = STATUS_AXIS_LABELS[axis].column;
  // A <div> (not <label>) wrapper: clicking the cell's non-select area should
  // toggle the row's expansion, not get forwarded into the select.
  return (
    <div className="documentation-cell documentation-spec-cell">
      <span className="documentation-cell-label">
        <StatusAxisHeader axis={axis} />
      </span>
      <StatusSelect
        value={value}
        options={options}
        ariaLabel={label}
        title={STATUS_AXIS_TOOLTIPS[axis]}
        disabled={disabled}
        readOnly={!canEdit}
        onChange={(next) => void onChange(next)}
      />
    </div>
  );
}
