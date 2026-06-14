import "../climate.css";
import { useUnitPreference } from "../../../lib/units";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail } from "../../projects/types";
import { ClimateDatasetBrowser } from "../components/ClimateDatasetBrowser";
import { ClimateLocationCard } from "../components/ClimateLocationCard";

// The Climate tab: the project's location record plus the app-wide
// reference-dataset browser (Phius today, PHI next). Source attach/select
// and visualization (graphs + sun path) arrive in Phase 3b/3c.
export function ClimateTab({ project }: { project: ProjectDetail }) {
  const { unitSystem } = useUnitPreference();
  const locationQuery = useProjectLocationQuery(project.id);
  const location = locationQuery.data;
  const projectCoords =
    location?.is_set && location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;

  return (
    <section className="tab-panel climate-tab" aria-labelledby="climate-title">
      <h2 id="climate-title">Climate</h2>

      <section className="climate-section" aria-labelledby="climate-location-title">
        <h3 id="climate-location-title">Project location</h3>
        <ClimateLocationCard projectId={project.id} unitSystem={unitSystem} />
      </section>

      <section className="climate-section" aria-labelledby="climate-datasets-title">
        <h3 id="climate-datasets-title">Reference climate datasets</h3>
        <p className="climate-section-note">
          App-wide Passive House reference datasets. Browse by country/region or find the nearest
          station to this project.
        </p>
        <ClimateDatasetBrowser unitSystem={unitSystem} projectCoords={projectCoords} />
      </section>
    </section>
  );
}
