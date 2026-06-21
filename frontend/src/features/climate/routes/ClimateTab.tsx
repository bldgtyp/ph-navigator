import { useEffect, useState } from "react";
import "../climate.css";
import "../climate-workspace.css";
import { useUnitPreference } from "../../../lib/units";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail } from "../../projects/types";
import { ClimateDatasetBrowser } from "../components/ClimateDatasetBrowser";
import { ClimateLocationSection } from "../components/ClimateLocationSection";
import { ClimateSourceDetailPage } from "../components/ClimateSourceDetailPage";
import { ClimateSourceSidebar, type ClimateSelection } from "../components/ClimateSourceSidebar";
import { ClimateSourcesSection } from "../components/ClimateSourcesSection";
import { SunPathDiagram } from "../components/SunPathDiagram";
import { useClimateSourcesQuery, useCreateClimateSourceMutation } from "../hooks";
import type { CreateClimateSourceRequest } from "../types";

// The Climate tab is a master-detail source browser: site location plus one
// page per attached climate source.
export function ClimateTab({ project }: { project: ProjectDetail }) {
  const { unitSystem } = useUnitPreference();
  const canEdit = project.access_mode === "editor";
  const [selected, setSelected] = useState<ClimateSelection>("location");
  const locationQuery = useProjectLocationQuery(project.id);
  const location = locationQuery.data;
  const sourcesQuery = useClimateSourcesQuery(project.id);
  const sources = sourcesQuery.data ?? [];
  const projectCoords =
    location?.is_set && location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;

  // One create mutation funnels every attach affordance (the dataset
  // browser for Phius/PHI, the ASHRAE/EPW forms in the sources section); its
  // error surfaces once, in the sources section, via `attachError`.
  const createSource = useCreateClimateSourceMutation(project.id);
  const attachSource = (body: CreateClimateSourceRequest) => createSource.mutate(body);
  const selectedSource = sources.find((source) => source.id === selected) ?? null;

  useEffect(() => {
    if (selected !== "location" && selected !== "add" && !selectedSource) {
      setSelected("location");
    }
  }, [selected, selectedSource]);

  return (
    <section className="tab-panel climate-tab" aria-labelledby="climate-title">
      <h2 id="climate-title">Climate</h2>
      <div className="climate-workspace">
        <ClimateSourceSidebar
          location={location}
          sources={sources}
          selected={selected}
          canEdit={canEdit}
          onSelect={setSelected}
        />
        <main className="climate-main">
          {sourcesQuery.error ? (
            <p className="form-error">Could not load climate sources.</p>
          ) : null}
          {selected === "location" ? <LocationPage project={project} /> : null}
          {selectedSource ? (
            <ClimateSourceDetailPage
              project={project}
              source={selectedSource}
              unitSystem={unitSystem}
            />
          ) : null}
          {selected === "add" ? (
            <AddSourcePage
              project={project}
              location={location}
              unitSystem={unitSystem}
              projectCoords={projectCoords}
              canEdit={canEdit}
              onAttach={attachSource}
              isAttaching={createSource.isPending}
              attachError={createSource.error}
            />
          ) : null}
        </main>
      </div>
    </section>
  );
}

function LocationPage({ project }: { project: ProjectDetail }) {
  return (
    <section className="climate-section" aria-labelledby="climate-location-title">
      <h3 id="climate-location-title">Project location</h3>
      <ClimateLocationSection project={project} />
      <div className="climate-sunpath-panel">
        <h3>Sun path</h3>
        <SunPathDiagram projectId={project.id} />
      </div>
    </section>
  );
}

function AddSourcePage({
  project,
  location,
  unitSystem,
  projectCoords,
  canEdit,
  onAttach,
  isAttaching,
  attachError,
}: {
  project: ProjectDetail;
  location: ReturnType<typeof useProjectLocationQuery>["data"];
  unitSystem: ReturnType<typeof useUnitPreference>["unitSystem"];
  projectCoords: { latitude: number; longitude: number } | null;
  canEdit: boolean;
  onAttach: (body: CreateClimateSourceRequest) => void;
  isAttaching: boolean;
  attachError: Error | null;
}) {
  return (
    <section
      id="climate-add-source"
      className="climate-section"
      aria-labelledby="climate-add-title"
    >
      <h3 id="climate-add-title">Add source · re-populate</h3>
      <ClimateSourcesSection
        project={project}
        location={location}
        onAttach={onAttach}
        isAttaching={isAttaching}
        attachError={attachError}
      />
      <ClimateDatasetBrowser
        unitSystem={unitSystem}
        projectCoords={projectCoords}
        onAttach={canEdit ? onAttach : undefined}
        attachPending={isAttaching}
      />
    </section>
  );
}
