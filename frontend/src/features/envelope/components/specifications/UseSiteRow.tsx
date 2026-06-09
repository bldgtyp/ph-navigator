import { useEffect, useState } from "react";
import { AttachmentCell } from "../../../assets/components/AttachmentCell";
import { SITE_PHOTO_ATTACHMENT_CONFIG } from "../../../assets/lib";
import type { AssetUrls } from "../../../assets/types";
import type { ProjectMaterialUseSite } from "../../types";

export function UseSiteRow({
  siteKey,
  site,
  projectId,
  assetUrlById,
  canEdit,
  busy,
  isEditing,
  onToggleEdit,
  onSubmit,
  onPhotoChange,
}: {
  siteKey: string;
  site: ProjectMaterialUseSite;
  projectId: string;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  canEdit: boolean;
  busy: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSubmit: (notes: string | null) => void;
  onPhotoChange: (nextAssetIds: string[]) => Promise<void> | void;
}) {
  const [notes, setNotes] = useState(site.use_site_notes ?? "");
  useEffect(() => setNotes(site.use_site_notes ?? ""), [siteKey, site.use_site_notes]);
  const trimmedNotes = notes.trim() || null;
  const canSave = trimmedNotes !== site.use_site_notes && !busy;
  return (
    <li className="use-site">
      <header className="use-site__header">
        <span className="use-site__title">
          <span aria-hidden="true">📷</span>
          <strong>{site.assembly_name}</strong>
          <span className="use-site__where">
            · layer {site.layer_order + 1}, segment {site.segment_order + 1}
          </span>
        </span>
      </header>
      <div className="use-site__photos">
        <AttachmentCell
          projectId={projectId}
          value={site.photo_asset_ids}
          config={SITE_PHOTO_ATTACHMENT_CONFIG}
          readOnly={!canEdit || busy}
          assetUrlById={assetUrlById}
          showInlineEmptyButton={canEdit}
          onChange={onPhotoChange}
        />
      </div>
      {canEdit ? (
        <>
          {site.use_site_notes ? <em>{site.use_site_notes}</em> : null}
          <button type="button" className="secondary-button" onClick={onToggleEdit}>
            {isEditing ? "Close note" : "Edit note"}
          </button>
          {isEditing ? (
            <div className="use-site-note-editor">
              <textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} />
              <button
                type="button"
                className="secondary-button"
                disabled={!canSave}
                onClick={() => onSubmit(trimmedNotes)}
              >
                Save note
              </button>
            </div>
          ) : null}
        </>
      ) : site.use_site_notes ? (
        <em>{site.use_site_notes}</em>
      ) : null}
    </li>
  );
}
