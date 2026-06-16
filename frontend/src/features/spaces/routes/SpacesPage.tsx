import { Navigate, useLocation, useParams } from "react-router-dom";
import { AppSubTabLink, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import { RoomsPage } from "../../equipment/routes/RoomsPage";
import type { ProjectDetail } from "../../projects/types";
import { spaceTypesPath, spacesRoomsPath } from "../paths";

export function SpacesPage({ project }: { project: ProjectDetail }) {
  const location = useLocation();
  const params = useParams();
  const activeTab = params["*"] ?? "";

  if (activeTab === "" || activeTab === "/") {
    return (
      <Navigate
        to={{
          pathname: spaceTypesPath(project.id),
          search: location.search,
          hash: location.hash,
        }}
        replace
      />
    );
  }

  if (activeTab !== "space-types" && activeTab !== "rooms") {
    return (
      <Navigate
        to={{
          pathname: spaceTypesPath(project.id),
          search: location.search,
          hash: location.hash,
        }}
        replace
      />
    );
  }

  return (
    <>
      <AppSubTabs ariaLabel="Spaces tables">
        <AppSubTabLink
          to={{
            pathname: spaceTypesPath(project.id),
            search: location.search,
          }}
        >
          Space-Types
        </AppSubTabLink>
        <AppSubTabLink
          to={{
            pathname: spacesRoomsPath(project.id),
            search: location.search,
          }}
        >
          Rooms
        </AppSubTabLink>
      </AppSubTabs>
      {activeTab === "rooms" ? <RoomsPage project={project} /> : <SpaceTypesPlaceholder />}
    </>
  );
}

function SpaceTypesPlaceholder() {
  return (
    <section className="tab-panel spaces-panel" aria-label="Space-Types">
      <h2>Space-Types</h2>
      <p>No space types yet.</p>
    </section>
  );
}
