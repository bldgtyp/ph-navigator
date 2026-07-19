import { Copy, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, SITE_PHOTO_ATTACHMENT_CONFIG } from "../../assets/lib";
import type { AssetUrls } from "../../assets/types";
import { directionsForSection } from "../directions/content";
import type { DocumentationFieldChange } from "../hooks";
import { axisMissing, SPEC_STATUS_LABELS } from "../lib";
import type { DocumentationRecord, DocumentationSection } from "../types";
import { ReadOnlyAttachmentCell, SpecCell } from "./DocumentationRecordViews";

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
  onPhotoChange,
  onFieldChange,
  onClose,
}: {
  projectId: string;
  record: DocumentationRecord;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  writing: boolean;
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
          {axisMissing(record, "photo") ? (
            <p className="documentation-evidence-state documentation-evidence-state--missing">
              Photo needed
            </p>
          ) : null}
          {canEdit && !specNa ? (
            <>
              <label className="documentation-waiver-toggle">
                <input
                  type="checkbox"
                  aria-label="Photos not required"
                  checked={record.photo_not_required}
                  disabled={writing}
                  onChange={(event) =>
                    void onFieldChange({
                      record,
                      field: "photo_not_required",
                      value: event.target.checked,
                    })
                  }
                />
                <span>Not required</span>
              </label>
              <AttachmentCell
                projectId={projectId}
                value={record.photo_asset_ids}
                config={SITE_PHOTO_ATTACHMENT_CONFIG}
                readOnly={writing || record.photo_not_required}
                onChange={(nextAssetIds) => onPhotoChange(record, nextAssetIds)}
                assetUrlById={assetUrlById}
                variant="card"
              />
            </>
          ) : (
            <ReadOnlyAttachmentCell
              projectId={projectId}
              assetIds={record.photo_asset_ids}
              config={SITE_PHOTO_ATTACHMENT_CONFIG}
              assetUrlById={assetUrlById}
            />
          )}
        </section>
        <section aria-label="Record datasheets">
          <h3>Datasheets</h3>
          {axisMissing(record, "datasheet") ? (
            <p className="documentation-evidence-state documentation-evidence-state--missing">
              Missing
            </p>
          ) : null}
          {canEdit && !specNa ? (
            <label className="documentation-waiver-toggle">
              <input
                type="checkbox"
                aria-label="Datasheet not required"
                checked={record.datasheet_not_required}
                disabled={writing}
                onChange={(event) =>
                  void onFieldChange({
                    record,
                    field: "datasheet_not_required",
                    value: event.target.checked,
                  })
                }
              />
              <span>Not required</span>
            </label>
          ) : null}
          <ReadOnlyAttachmentCell
            projectId={projectId}
            assetIds={record.datasheet_asset_ids}
            config={DATASHEET_ATTACHMENT_CONFIG}
            assetUrlById={assetUrlById}
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
