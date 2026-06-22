import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import "../climate.css";
import "../climate-workspace.css";
import { useUnitPreference, type UnitSystem } from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail, ProjectLocation } from "../../projects/types";
import { useProjectLocationForm } from "../../projects/useProjectLocationForm";
import { LocationPrivacyTag } from "../components/ClimateAtoms";
import { ClimateMap } from "../components/ClimateMap";
import { ClimateDatasetPickerModal } from "../components/ClimateDatasetPickerModal";
import {
  ClimateSourceDetailPage,
  ProjectEpwToolsPage,
} from "../components/ClimateSourceDetailPage";
import { ClimateSourceSidebar, type ClimateSelection } from "../components/ClimateSourceSidebar";
import { ClimateSourcesSection } from "../components/ClimateSourcesSection";
import { SetLocationModal } from "../components/SetLocationModal";
import { useClimateSourcesQuery, useCreateClimateSourceMutation } from "../hooks";
import { formatLatLong, formatLocationElevationLabel } from "../lib";
import type { CreateClimateSourceRequest, PhClimateKind } from "../types";

// The Climate tab is a master-detail source browser: site location plus one
// page per attached climate source.
export function ClimateTab({ project }: { project: ProjectDetail }) {
  const { unitSystem } = useUnitPreference();
  const canEdit = project.access_mode === "editor";
  const [selected, setSelected] = useState<ClimateSelection>("location");
  // The PH dataset picker (phius/phi) is a modal hoisted here so the sidebar,
  // the source detail header, and the fail page can all open it.
  const [pickerKind, setPickerKind] = useState<PhClimateKind | null>(null);
  const openPicker = canEdit ? (kind: PhClimateKind) => setPickerKind(kind) : undefined;
  const locationQuery = useProjectLocationQuery(project.id);
  const location = locationQuery.data;
  const sourcesQuery = useClimateSourcesQuery(project.id);
  const sources = sourcesQuery.data ?? [];

  // One create mutation funnels the ASHRAE/EPW/custom attach forms in the
  // sources section; its error surfaces there via `attachError`. (PH datasets
  // attach through the picker modal's own mutation.)
  const createSource = useCreateClimateSourceMutation(project.id);
  const attachSource = (body: CreateClimateSourceRequest) => createSource.mutate(body);
  const selectedSource = sources.find((source) => source.id === selected) ?? null;

  useEffect(() => {
    if (
      selected !== "location" &&
      selected !== "add" &&
      selected !== "epw-tools" &&
      !selectedSource
    ) {
      setSelected("location");
    }
  }, [selected, selectedSource]);

  return (
    <section className="tab-panel climate-tab" aria-label="Climate">
      <div className="climate-workspace">
        <ClimateSourceSidebar
          location={location}
          sources={sources}
          selected={selected}
          canEdit={canEdit}
          unitSystem={unitSystem}
          onSelect={setSelected}
          onOpenPicker={openPicker}
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
              onOpenPicker={openPicker}
            />
          ) : null}
          {selected === "epw-tools" ? <ProjectEpwToolsPage project={project} /> : null}
          {selected === "add" ? (
            <AddSourcePage
              project={project}
              location={location}
              onAttach={attachSource}
              isAttaching={createSource.isPending}
              attachError={createSource.error}
            />
          ) : null}
        </main>
      </div>
      {pickerKind ? (
        <ClimateDatasetPickerModal
          key={pickerKind}
          projectId={project.id}
          kind={pickerKind}
          onClose={() => setPickerKind(null)}
          onRequestSetLocation={() => setSelected("location")}
        />
      ) : null}
    </section>
  );
}

// The location page is read-first: derived facts and the decorative site map.
// Editors reveal the full location editor inline via "Set Location".
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
  const [isModalOpen, setModalOpen] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const deriveForm = useProjectLocationForm(project.id);
  const isSet = location?.is_set ?? false;
  const countyState = [location?.county, location?.state].filter(Boolean).join(" · ");
  const cityState = [location?.city, location?.state].filter(Boolean).join(", ");
  const elevation = formatLocationElevationLabel(location?.elevation_m, unitSystem) ?? "—";
  const coords =
    location?.latitude != null && location?.longitude != null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;
  const canLocateClimateData = canEdit && coords !== null;

  const locateClimateData = async () => {
    setDeriveError(null);
    try {
      await deriveForm.deriveLocation();
    } catch (error) {
      setDeriveError(errorMessage(error, "Could not locate climate data."));
    }
  };

  return (
    <section className="climate-detail-page" aria-labelledby="climate-location-title">
      <header className="climate-page-head climate-location-head">
        {canEdit ? (
          <div className="climate-page-head-actions">
            <button
              type="button"
              className="primary-button climate-location-set-button"
              onClick={() => setModalOpen(true)}
            >
              <MapPin size={16} aria-hidden="true" />
              Set Location
            </button>
          </div>
        ) : null}
        <div className="climate-location-head-copy">
          <h3 id="climate-location-title" className="climate-page-title">
            Project location
          </h3>
          <p className="climate-location-public">{cityState || "Location not set"}</p>
          {canEdit && location?.site_address ? (
            <p className="climate-location-private">
              <span>{location.site_address}</span>
              {isSet ? <LocationPrivacyTag /> : null}
            </p>
          ) : null}
        </div>
      </header>

      <ClimateMap className="climate-big-map" ariaLabel="Project location map" project={coords} />

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

      {canEdit ? (
        <div className="climate-location-derive">
          <div>
            <p className="climate-subhead">Climate data</p>
            <p className="form-note">
              Populate county, elevation, climate zone, and nearest climate sources from the saved
              project coordinates.
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => void locateClimateData()}
            disabled={!canLocateClimateData || deriveForm.isDeriving}
          >
            <MapPin size={16} aria-hidden="true" />
            {deriveForm.isDeriving ? "Locating…" : "Locate Climate Data"}
          </button>
        </div>
      ) : null}
      {deriveError ? (
        <p className="form-error" role="alert">
          {deriveError}
        </p>
      ) : null}
      {deriveForm.warnings.length > 0 ? (
        <div className="draft-banner" role="status">
          {deriveForm.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}

      {canEdit && isModalOpen ? (
        <SetLocationModal projectId={project.id} onClose={() => setModalOpen(false)} />
      ) : null}
    </section>
  );
}

// The "+ Add source" page covers the kinds the PH dataset picker does not:
// ASHRAE, EPW, and custom records (D-DP-4). Phius/PHI attach through the picker.
function AddSourcePage({
  project,
  location,
  onAttach,
  isAttaching,
  attachError,
}: {
  project: ProjectDetail;
  location: ReturnType<typeof useProjectLocationQuery>["data"];
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
    </section>
  );
}
