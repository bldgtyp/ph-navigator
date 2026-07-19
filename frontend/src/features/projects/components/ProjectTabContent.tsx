import { lazy, Suspense, type ComponentType } from "react";
import { TAB_LABELS, type ProjectTab } from "../lib";
import type { ProjectDetail } from "../types";

const StatusTab = lazy(() =>
  import("../../project_status/routes/StatusTab").then((module) => ({ default: module.StatusTab })),
);
const AperturesTab = lazy(() =>
  import("../../apertures/routes/AperturesTab").then((module) => ({
    default: module.AperturesTab,
  })),
);
const SpacesPage = lazy(() =>
  import("../../spaces/routes/SpacesPage").then((module) => ({ default: module.SpacesPage })),
);
const EquipmentPage = lazy(() =>
  import("../../equipment/routes/EquipmentPage").then((module) => ({
    default: module.EquipmentPage,
  })),
);
const ThermalBridgesPage = lazy(() =>
  import("../../assets/routes/ThermalBridgesPage").then((module) => ({
    default: module.ThermalBridgesPage,
  })),
);
const EnvelopePage = lazy(() =>
  import("../../envelope/routes/EnvelopePage").then((module) => ({
    default: module.EnvelopePage,
  })),
);
const ModelTab = lazy(() =>
  import("../../model_viewer/routes/ModelTab").then((module) => ({ default: module.ModelTab })),
);
const DocumentationPage = lazy(() =>
  import("../../documentation/routes/DocumentationPage").then((module) => ({
    default: module.DocumentationPage,
  })),
);

// Lazy-loaded so recharts (monthly graphs) stays out of the initial bundle,
// matching the ModelTab/three.js split.
const ClimateTab = lazy(() =>
  import("../../climate/routes/ClimateTab").then((module) => ({ default: module.ClimateTab })),
);

type ProjectTabModule = ComponentType<{ project: ProjectDetail }>;

const PROJECT_TAB_MODULES: Record<
  ProjectTab,
  { Component: ProjectTabModule; className?: string; loadingLabel: string }
> = {
  status: { Component: StatusTab, className: "status-panel", loadingLabel: TAB_LABELS.status },
  climate: { Component: ClimateTab, className: "climate-tab", loadingLabel: TAB_LABELS.climate },
  apertures: {
    Component: AperturesTab,
    className: "apertures-panel",
    loadingLabel: TAB_LABELS.apertures,
  },
  envelope: {
    Component: EnvelopePage,
    className: "envelope-panel",
    loadingLabel: TAB_LABELS.envelope,
  },
  spaces: { Component: SpacesPage, className: "spaces-panel", loadingLabel: TAB_LABELS.spaces },
  equipment: {
    Component: EquipmentPage,
    className: "equipment-panel",
    loadingLabel: TAB_LABELS.equipment,
  },
  "thermal-bridges": {
    Component: ThermalBridgesPage,
    className: "equipment-panel",
    loadingLabel: TAB_LABELS["thermal-bridges"],
  },
  model: { Component: ModelTab, className: "model-tab", loadingLabel: "model viewer" },
  documentation: {
    Component: DocumentationPage,
    className: "documentation-page",
    loadingLabel: TAB_LABELS.documentation,
  },
};

export function ProjectTabContent({ tab, project }: { tab: ProjectTab; project: ProjectDetail }) {
  const { Component, className, loadingLabel } = PROJECT_TAB_MODULES[tab];

  return (
    <Suspense fallback={<TabLoadingPanel className={className} label={loadingLabel} />}>
      <Component project={project} />
    </Suspense>
  );
}

function TabLoadingPanel({ className, label }: { className?: string; label: string }) {
  return (
    <section className={["tab-panel", className].filter(Boolean).join(" ")}>
      <p>Loading {label}...</p>
    </section>
  );
}
