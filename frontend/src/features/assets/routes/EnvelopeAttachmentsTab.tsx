import type { ProjectDetail } from "../../projects/types";
import { AttachmentTablePanel } from "../components/AttachmentTablePanel";
import { DATASHEET_ATTACHMENT_CONFIG, SITE_PHOTO_ATTACHMENT_CONFIG } from "../lib";

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
        config={DATASHEET_ATTACHMENT_CONFIG}
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
        config={SITE_PHOTO_ATTACHMENT_CONFIG}
      />
    </section>
  );
}
