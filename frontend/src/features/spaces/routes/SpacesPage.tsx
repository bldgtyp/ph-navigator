import { Navigate, useLocation, useParams } from "react-router-dom";
import { AppSubTabLink, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import { RoomsPage } from "../../equipment/routes/RoomsPage";
import type { ProjectDetail } from "../../projects/types";
import { spaceTypesPath, spacesRoomsPath } from "../paths";
import { SpaceTypesPage } from "./SpaceTypesPage";

export function SpacesPage({ project }: { project: ProjectDetail }) {
  const location = useLocation();
  const params = useParams();
  const activeTab = params["*"] ?? "";

  if (activeTab === "" || activeTab === "/") {
    return (
      <Navigate
        to={{
          pathname: spacesRoomsPath(project.id),
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
          pathname: spacesRoomsPath(project.id),
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
            pathname: spacesRoomsPath(project.id),
            search: location.search,
          }}
        >
          Spaces
        </AppSubTabLink>
        <AppSubTabLink
          to={{
            pathname: spaceTypesPath(project.id),
            search: location.search,
          }}
        >
          Space-Types
        </AppSubTabLink>
      </AppSubTabs>
      {activeTab === "rooms" ? (
        <RoomsPage project={project} />
      ) : (
        <SpaceTypesPage project={project} />
      )}
    </>
  );
}
