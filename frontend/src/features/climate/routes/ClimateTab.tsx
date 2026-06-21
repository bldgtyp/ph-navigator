import { useEffect, useState } from "react";
import "../climate.css";
import "../climate-workspace.css";
import { useUnitPreference, type UnitSystem } from "../../../lib/units";
import { formatReadOnlyCoordinate } from "../../projects/location-form";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail, ProjectLocation } from "../../projects/types";
import { ClimateDatasetBrowser } from "../components/ClimateDatasetBrowser";
import { LocationPrivacyTag } from "../components/ClimateAtoms";
import { ClimateLocationSection } from "../components/ClimateLocationSection";
import { ClimateSourceDetailPage } from "../components/ClimateSourceDetailPage";
import { ClimateSourceSidebar, type ClimateSelection } from "../components/ClimateSourceSidebar";
import { ClimateSourcesSection } from "../components/ClimateSourcesSection";
import { SunPathDiagram } from "../components/SunPathDiagram";
import { useClimateSourcesQuery, useCreateClimateSourceMutation } from "../hooks";
import { formatLatLong, formatLocationElevationLabel } from "../lib";
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
          unitSystem={unitSystem}
          onSelect={setSelected}
        />
        <main className="climate-main">
          {sourcesQuery.error ? (
            <p className="form-error">Could not load climate sources.</p>
          ) : null}
          {selected === "location" ? (
            <LocationPage
              project={project}
              location={location}
              canEdit={canEdit}
              unitSystem={unitSystem}
            />
          ) : null}
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

// The location page is read-first: derived facts, the decorative site map, and
// the sun-path. Editors reveal the full location editor inline via "Edit".
function LocationPage({
  project,
  location,
  canEdit,
  unitSystem,
}: {
  project: ProjectDetail;
  location: ProjectLocation | undefined;
  canEdit: boolean;
  unitSystem: UnitSystem;
}) {
  const [editing, setEditing] = useState(false);
  const isSet = location?.is_set ?? false;
  const countyState = [location?.county, location?.state].filter(Boolean).join(" · ");
  const elevation = formatLocationElevationLabel(location?.elevation_m, unitSystem) ?? "—";

  return (
    <section className="climate-detail-page" aria-labelledby="climate-location-title">
      <header className="climate-page-head">
        <div>
          <h3 id="climate-location-title" className="climate-page-title">
            Project location
          </h3>
          <div className="climate-page-sub">
            {canEdit && location?.site_address ? <span>{location.site_address}</span> : null}
            {isSet ? <LocationPrivacyTag /> : null}
          </div>
        </div>
        {canEdit ? (
          <div className="climate-page-head-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditing((value) => !value)}
              aria-expanded={editing}
            >
              {editing ? "Done editing" : "Edit ▸"}
            </button>
          </div>
        ) : null}
      </header>

      <div className="climate-map-surface climate-big-map" aria-hidden="true">
        <span className="climate-map-pin" style={{ left: "48%", top: "46%" }} />
      </div>

      <dl className="climate-facts">
        <div className="climate-fact">
          <dt>Coordinates</dt>
          <dd>{formatLatLong(location?.latitude ?? null, location?.longitude ?? null)}</dd>
        </div>
        <div className="climate-fact">
          <dt>County · State</dt>
          <dd>{countyState || "—"}</dd>
        </div>
        <div className="climate-fact">
          <dt>Elevation</dt>
          <dd>{elevation}</dd>
        </div>
        <div className="climate-fact">
          <dt>IECC climate zone</dt>
          <dd>{location?.climate_zone ?? "—"}</dd>
        </div>
      </dl>

      {canEdit && editing ? <ClimateLocationSection project={project} /> : null}

      <div className="climate-sunpath-panel">
        <h3>Sun path</h3>
        <div className="climate-sun-wrap">
          <SunPathDiagram projectId={project.id} />
          <div className="climate-sun-meta">
            <div className="row">
              <span className="k">Latitude</span>
              <span>{formatReadOnlyCoordinate(location?.latitude ?? null)}</span>
            </div>
            <div className="row">
              <span className="k">True-north offset</span>
              <span>{formatReadOnlyCoordinate(location?.true_north_deg ?? null)}</span>
            </div>
          </div>
        </div>
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
