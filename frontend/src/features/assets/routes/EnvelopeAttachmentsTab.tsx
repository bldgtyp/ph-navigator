import "../attachments.css";
import type { ProjectDetail } from "../../projects/types";
import { AttachmentTablePanel } from "../components/AttachmentTablePanel";

const DATASHEET_CONFIG = {
  assetKind: "datasheet" as const,
  allowedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  maxCount: 5,
  maxFileSizeMb: 25,
};

const SITE_PHOTO_CONFIG = {
  assetKind: "site_photo" as const,
  allowedTypes: ["image/png", "image/jpeg", "image/webp"],
  maxCount: 10,
  maxFileSizeMb: 25,
};

export function EnvelopeAttachmentsTab({ project }: { project: ProjectDetail }) {
  return (
    <section className="tab-panel attachment-workbench" aria-label="Envelope attachments">
      <AttachmentTablePanel
        projectId={project.id}
        versionId={project.active_version_id}
        accessMode={project.access_mode}
        versionLocked={project.active_version?.locked ?? false}
        tableName="project_materials"
        title="Project Material Datasheets"
        fieldKey="datasheet_asset_ids"
        fieldLabel="Datasheet"
        config={DATASHEET_CONFIG}
      />
      <AttachmentTablePanel
        projectId={project.id}
        versionId={project.active_version_id}
        accessMode={project.access_mode}
        versionLocked={project.active_version?.locked ?? false}
        tableName="assembly_segments"
        title="Assembly Segment Site Photos"
        fieldKey="photo_asset_ids"
        fieldLabel="Photos"
        config={SITE_PHOTO_CONFIG}
      />
    </section>
  );
}
