import { Copy, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { AssetUrls } from "../../assets/types";
import { directionsForSection } from "../directions/content";
import type { DocumentationFieldChange } from "../hooks";
import {
  EVIDENCE_STATUS_OPTIONS,
  SPEC_STATUS_LABELS,
  documentationEvidenceStatusValue,
} from "../lib";
import type { DocumentationRecord, DocumentationSection } from "../types";
import {
  AxisStatusCell,
  DocumentationEvidenceAttachmentControl,
  SpecCell,
} from "./DocumentationRecordViews";

export function DirectionsModal({
  section,
  onClose,
}: {
  section: DocumentationSection;
  onClose: () => void;
}) {
  const directions = directionsForSection(section);
  return (
    <ModalDialog
      title={`How to photograph - ${section.title}`}
      titleId="documentation-directions-title"
      onClose={onClose}
    >
      <div className="documentation-modal-body documentation-directions">
        {directions.map((direction) => (
          <section key={direction.key} className="documentation-direction-card">
            <div>
              <h3>{direction.title}</h3>
              <p>{direction.overview}</p>
            </div>
            {direction.exampleImageUrl ? (
              <img src={direction.exampleImageUrl} alt="" />
            ) : (
              <div className="documentation-direction-placeholder" aria-hidden="true">
                Example photo pending
              </div>
            )}
            <ul>
              {direction.shots.map((shot) => (
                <li key={shot}>{shot}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ModalDialog>
  );
}

export function RecordDetailModal({
  projectId,
  record,
  assetUrlById,
  canEdit,
  writing,
  onDatasheetChange,
  onPhotoChange,
  onFieldChange,
  onClose,
}: {
  projectId: string;
  record: DocumentationRecord;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  writing: boolean;
  onDatasheetChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onPhotoChange: (record: DocumentationRecord, nextAssetIds: string[]) => Promise<void>;
  onFieldChange: (change: DocumentationFieldChange) => Promise<void>;
  onClose: () => void;
}) {
  const specNa = record.spec_status === "na";
  const rows = [
    ["Display Name", record.display_name],
    ["Description", record.sub_label],
    ["Source table", record.table_key],
    ["Record ID", record.record_id],
    ["Material ID", record.material_id],
    ["Segments", record.segment_ids.length ? record.segment_ids.length.toString() : null],
    ["Specification Status", SPEC_STATUS_LABELS[record.spec_status]],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const copyRecordId = async () => {
    await navigator.clipboard?.writeText(record.record_id);
  };
  return (
    <ModalDialog
      title={record.display_name}
      titleId="documentation-record-detail-title"
      onClose={onClose}
      headerAccessory={
        <Link className="secondary-button documentation-modal-owner-link" to={record.table_path}>
          <ExternalLink size={14} aria-hidden="true" />
          Open owner
        </Link>
      }
    >
      <div className="documentation-modal-body documentation-record-detail">
        <dl className="documentation-record-attributes">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {canEdit ? (
          <section aria-label="Record specification status">
            <SpecCell
              record={record}
              canEdit
              disabled={writing}
              onChange={(value) => onFieldChange({ record, field: "spec_status", value })}
            />
          </section>
        ) : null}
        <section aria-label="Record photos">
          <h3>Photos</h3>
          <AxisStatusCell
            label="Photos"
            value={documentationEvidenceStatusValue(record, "photo")}
            options={EVIDENCE_STATUS_OPTIONS}
            canEdit={canEdit && !specNa}
            disabled={writing}
            onChange={(value) => onFieldChange({ record, field: "photo_status", value })}
          />
          <DocumentationEvidenceAttachmentControl
            projectId={projectId}
            record={record}
            axis="photo"
            assetUrlById={assetUrlById}
            canEdit={canEdit}
            writing={writing}
            variant="card"
            onDatasheetChange={onDatasheetChange}
            onPhotoChange={onPhotoChange}
          />
        </section>
        <section aria-label="Record datasheets">
          <h3>Datasheets</h3>
          <AxisStatusCell
            label="Datasheet"
            value={documentationEvidenceStatusValue(record, "datasheet")}
            options={EVIDENCE_STATUS_OPTIONS}
            canEdit={canEdit && !specNa}
            disabled={writing}
            onChange={(value) => onFieldChange({ record, field: "datasheet_status", value })}
          />
          <DocumentationEvidenceAttachmentControl
            projectId={projectId}
            record={record}
            axis="datasheet"
            assetUrlById={assetUrlById}
            canEdit={canEdit}
            writing={writing}
            variant="card"
            onDatasheetChange={onDatasheetChange}
            onPhotoChange={onPhotoChange}
          />
        </section>
        <button
          type="button"
          className="secondary-button documentation-copy-id"
          onClick={() => void copyRecordId()}
        >
          <Copy size={14} aria-hidden="true" />
          {record.record_id}
        </button>
      </div>
    </ModalDialog>
  );
}
