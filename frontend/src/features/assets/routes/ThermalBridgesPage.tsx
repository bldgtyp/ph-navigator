import "../attachments.css";
import type { ProjectDetail } from "../../projects/types";
import { AttachmentTablePanel } from "../components/AttachmentTablePanel";

const DATASHEET_CONFIG = {
  assetKind: "datasheet" as const,
  allowedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  maxCount: 5,
  maxFileSizeMb: 25,
};

const SIM_FILE_CONFIG = {
  assetKind: "simulation_file" as const,
  allowedTypes: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/json",
    "application/octet-stream",
  ],
  maxCount: 5,
  maxFileSizeMb: 25,
};

export function ThermalBridgesPage({ project }: { project: ProjectDetail }) {
  return (
    <section className="tab-panel attachment-workbench" aria-label="Thermal Bridges">
      <AttachmentTablePanel
        projectId={project.id}
        versionId={project.active_version_id}
        accessMode={project.access_mode}
        versionLocked={project.active_version?.locked ?? false}
        tableName="thermal_bridges"
        title="Thermal Bridge Datasheets"
        fieldKey="datasheet_asset_ids"
        fieldLabel="Datasheet"
        config={DATASHEET_CONFIG}
      />
      <AttachmentTablePanel
        projectId={project.id}
        versionId={project.active_version_id}
        accessMode={project.access_mode}
        versionLocked={project.active_version?.locked ?? false}
        tableName="thermal_bridges"
        title="Thermal Bridge Simulation Files"
        fieldKey="simulation_file_asset_ids"
        fieldLabel="Simulation File"
        config={SIM_FILE_CONFIG}
      />
    </section>
  );
}
