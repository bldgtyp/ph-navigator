import { lazy, Suspense } from "react";
import { AperturesTab } from "../../apertures/routes/AperturesTab";
import { ThermalBridgesPage } from "../../assets/routes/ThermalBridgesPage";
import { EquipmentPage } from "../../equipment/routes/EquipmentPage";
import { EnvelopePage } from "../../envelope/routes/EnvelopePage";
import { StatusTab } from "../../project_status/routes/StatusTab";
import { SpacesPage } from "../../spaces/routes/SpacesPage";
import { TAB_COPY, TAB_LABELS, type ProjectTab } from "../lib";
import type { ProjectDetail } from "../types";

const ModelTab = lazy(() =>
  import("../../model_viewer/routes/ModelTab").then((module) => ({ default: module.ModelTab })),
);

// Lazy-loaded so recharts (monthly graphs) stays out of the initial bundle,
// matching the ModelTab/three.js split.
const ClimateTab = lazy(() =>
  import("../../climate/routes/ClimateTab").then((module) => ({ default: module.ClimateTab })),
);

export function ProjectTabContent({ tab, project }: { tab: ProjectTab; project: ProjectDetail }) {
  if (tab === "status") {
    return <StatusTab project={project} />;
  }

  if (tab === "climate") {
    return (
      <Suspense fallback={<section className="tab-panel climate-tab">Loading climate…</section>}>
        <ClimateTab project={project} />
      </Suspense>
    );
  }

  if (tab === "apertures") {
    return <AperturesTab project={project} />;
  }

  if (tab === "spaces") {
    return <SpacesPage project={project} />;
  }

  if (tab === "equipment") {
    return <EquipmentPage project={project} />;
  }

  if (tab === "thermal-bridges") {
    return <ThermalBridgesPage project={project} />;
  }

  if (tab === "envelope") {
    return <EnvelopePage project={project} />;
  }

  if (tab === "model") {
    return (
      <Suspense
        fallback={<section className="tab-panel model-tab">Loading model viewer...</section>}
      >
        <ModelTab project={project} />
      </Suspense>
    );
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
