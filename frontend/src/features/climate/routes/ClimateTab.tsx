import { useEffect, useState } from "react";
import "../climate.css";
import "../climate-workspace.css";
import { useUnitPreference, type UnitSystem } from "../../../lib/units";
import { useProjectLocationQuery } from "../../projects/hooks";
import type { ProjectDetail, ProjectLocation } from "../../projects/types";
import { ClimateMap } from "../components/ClimateMap";
import { ClimateDatasetPickerModal } from "../components/ClimateDatasetPickerModal";
import { WeatherStationPickerModal } from "../components/WeatherStationPickerModal";
import { ClimateUploadModal } from "../components/ClimateUploadModal";
import { ClimateSourceDetailPage, MissingSourcePage } from "../components/ClimateSourceDetailPage";
import { ClimateSourceSidebar, type ClimateSelection } from "../components/ClimateSourceSidebar";
import { SetLocationModal } from "../components/SetLocationModal";
import { useClimateSourcesQuery } from "../hooks";
import { formatLatLong, formatLocationElevationLabel } from "../lib";
import type { ClimateSourceKind, PhClimateKind } from "../types";

// The Climate tab is a master-detail source browser: site location plus one
// page per climate type — each type's page (attached or empty) owns its own
// "set from nearest" action.
export function ClimateTab({ project }: { project: ProjectDetail }) {
  const { unitSystem } = useUnitPreference();
  const canEdit = project.access_mode === "editor";
  const [selected, setSelected] = useState<ClimateSelection>("location");
  // The PH dataset picker (phius/phi) is a modal hoisted here so the sidebar,
  // the source detail header, and the empty-state page can all open it.
  const [pickerKind, setPickerKind] = useState<PhClimateKind | null>(null);
  const openPicker = canEdit ? (kind: PhClimateKind) => setPickerKind(kind) : undefined;
  // The hourly climate data picker is hoisted here too, mirroring the PH picker,
  // so the Weather File page and its empty state can both open it.
  const [weatherPickerOpen, setWeatherPickerOpen] = useState(false);
  const openWeatherPicker = canEdit ? () => setWeatherPickerOpen(true) : undefined;
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const openUploadModal = canEdit ? () => setUploadModalOpen(true) : undefined;
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const openLocationModal = canEdit ? () => setLocationModalOpen(true) : undefined;
  const closeLocationModal = () => {
    setLocationModalOpen(false);
    setSelected("location");
  };
  const locationQuery = useProjectLocationQuery(project.id);
  const location = locationQuery.data;
  const sourcesQuery = useClimateSourcesQuery(project.id);
  const sources = sourcesQuery.data ?? [];

  const selectedSource = sources.find((source) => source.id === selected) ?? null;
  // A `slot:<kind>` selection is the empty-state page for an unattached
  // canonical type; once that type gains a source we hand off to its detail page.
  const slotKind = selected.startsWith("slot:") ? (selected.slice(5) as ClimateSourceKind) : null;
  const slotSource = slotKind ? (sources.find((source) => source.kind === slotKind) ?? null) : null;

  useEffect(() => {
    if (slotSource) {
      setSelected(slotSource.id);
      return;
    }
    if (selected !== "location" && slotKind === null && !selectedSource) {
      setSelected("location");
    }
  }, [selected, slotKind, slotSource, selectedSource]);

  return (
    <section className="tab-panel climate-tab" aria-label="Climate">
      <div className="climate-body">
        <div className="climate-workspace">
          <ClimateSourceSidebar
            projectId={project.id}
            location={location}
            sources={sources}
            selected={selected}
            canEdit={canEdit}
            onSelect={setSelected}
            onOpenSetLocation={openLocationModal}
            onOpenPicker={openPicker}
            onOpenWeatherPicker={openWeatherPicker}
          />
          <main className="climate-main">
            {sourcesQuery.error ? (
              <p className="form-error">Could not load climate sources.</p>
            ) : null}
            {selected === "location" ? (
              <LocationPage location={location} unitSystem={unitSystem} />
            ) : null}
            {selectedSource ? (
              <ClimateSourceDetailPage
                project={project}
                source={selectedSource}
                unitSystem={unitSystem}
              />
            ) : null}
            {slotSource ? (
              <ClimateSourceDetailPage
                project={project}
                source={slotSource}
                unitSystem={unitSystem}
              />
            ) : null}
            {slotKind && !slotSource ? (
              <MissingSourcePage project={project} kind={slotKind} />
            ) : null}
          </main>
        </div>
      </div>
      {pickerKind ? (
        <ClimateDatasetPickerModal
          key={pickerKind}
          project={project}
          kind={pickerKind}
          onClose={() => setPickerKind(null)}
          onRequestSetLocation={() => setSelected("location")}
          onAttached={(source) => setSelected(source.id)}
        />
      ) : null}
      {weatherPickerOpen ? (
        <WeatherStationPickerModal
          projectId={project.id}
          onClose={() => setWeatherPickerOpen(false)}
          onRequestSetLocation={() => setSelected("location")}
          onOpenUploadModal={openUploadModal}
          onAttached={(source) => setSelected(source.id)}
        />
      ) : null}
      {uploadModalOpen ? (
        <ClimateUploadModal
          projectId={project.id}
          onClose={() => setUploadModalOpen(false)}
          onAttached={(source) => setSelected(source.id)}
        />
      ) : null}
      {locationModalOpen ? (
        <SetLocationModal projectId={project.id} onClose={closeLocationModal} />
      ) : null}
    </section>
  );
}

// The location page is read-first: derived facts and the decorative site map.
function LocationPage({
  location,
  unitSystem,
}: {
  location: ProjectLocation | undefined;
  unitSystem: UnitSystem;
}) {
  const countyState = [location?.county, location?.state].filter(Boolean).join(" · ");
  const elevation = formatLocationElevationLabel(location?.elevation_m, unitSystem) ?? "—";
  const coords =
    location?.latitude != null && location?.longitude != null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;

  return (
    <section className="climate-detail-page climate-location-page">
      <div className="climate-location-map-stage">
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
      </div>
    </section>
  );
}
