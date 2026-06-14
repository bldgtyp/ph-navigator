import "../climate.css";
import { useUnitPreference } from "../../../lib/units";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail } from "../../projects/types";
import { ClimateDatasetBrowser } from "../components/ClimateDatasetBrowser";
import { ClimateLocationSection } from "../components/ClimateLocationSection";
import { ClimateSourcesSection } from "../components/ClimateSourcesSection";
import { SunPathDiagram } from "../components/SunPathDiagram";
import { useCreateClimateSourceMutation } from "../hooks";
import type { CreateClimateSourceRequest } from "../types";

// The Climate tab: the project's location record, its attached climate
// sources (Phase 3b), and the app-wide reference-dataset browser. Per-source
// visualization (graphs + sun path) arrives in Phase 3c.
export function ClimateTab({ project }: { project: ProjectDetail }) {
  const { unitSystem } = useUnitPreference();
  const canEdit = project.access_mode === "editor";
  const locationQuery = useProjectLocationQuery(project.id);
  const location = locationQuery.data;
  const projectCoords =
    location?.is_set && location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;

  // One create mutation funnels every attach affordance (the dataset
  // browser for Phius/PHI, the ASHRAE/EPW forms in the sources section); its
  // error surfaces once, in the sources section, via `attachError`.
  const createSource = useCreateClimateSourceMutation(project.id);
  const attachSource = (body: CreateClimateSourceRequest) => createSource.mutate(body);

  return (
    <section className="tab-panel climate-tab" aria-labelledby="climate-title">
      <h2 id="climate-title">Climate</h2>

      <section className="climate-section" aria-labelledby="climate-location-title">
        <h3 id="climate-location-title">Project location</h3>
        <ClimateLocationSection project={project} />
      </section>

      <section className="climate-section" aria-labelledby="climate-sources-title">
        <h3 id="climate-sources-title">Climate sources</h3>
        <p className="climate-section-note">
          The climate bases this project evaluates. Attach a Phius/PHI station from the browser
          below, an ASHRAE pointer, or the project EPW; mark one as the default.
        </p>
        <ClimateSourcesSection
          project={project}
          location={location}
          onAttach={attachSource}
          isAttaching={createSource.isPending}
          attachError={createSource.error}
        />
      </section>

      <section className="climate-section" aria-labelledby="climate-sun-path-title">
        <h3 id="climate-sun-path-title">Sun path</h3>
        <p className="climate-section-note">
          The sun-path diagram for this project&rsquo;s location: hourly analemmas and monthly day
          arcs over the compass.
        </p>
        <SunPathDiagram projectId={project.id} />
      </section>

      <section className="climate-section" aria-labelledby="climate-datasets-title">
        <h3 id="climate-datasets-title">Reference climate datasets</h3>
        <p className="climate-section-note">
          App-wide Passive House reference datasets. Browse by country/region or find the nearest
          station to this project.
        </p>
        <ClimateDatasetBrowser
          unitSystem={unitSystem}
          projectCoords={projectCoords}
          onAttach={canEdit ? attachSource : undefined}
          attachPending={createSource.isPending}
        />
      </section>
    </section>
  );
}
