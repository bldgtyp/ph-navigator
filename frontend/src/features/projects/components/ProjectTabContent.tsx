import { EquipmentTab } from "../../equipment/routes/EquipmentTab";
import { StatusTab } from "../../project_status/routes/StatusTab";
import { TAB_COPY, TAB_LABELS, type ProjectTab } from "../lib";
import type { ProjectDetail } from "../types";

export function ProjectTabContent({ tab, project }: { tab: ProjectTab; project: ProjectDetail }) {
  if (tab === "status") {
    return <StatusTab project={project} />;
  }

  if (tab === "equipment") {
    return <EquipmentTab project={project} />;
  }

  return (
    <section className="tab-panel" aria-labelledby={`${tab}-title`}>
      <h2 id={`${tab}-title`}>{TAB_LABELS[tab]}</h2>
      <p>{TAB_COPY[tab]}</p>
      <dl className="metadata-grid">
        <div>
          <dt>Active version</dt>
          <dd>{project.active_version?.name ?? "None"}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{project.access_mode === "editor" ? "Editor" : "Viewer"}</dd>
        </div>
      </dl>
    </section>
  );
}
