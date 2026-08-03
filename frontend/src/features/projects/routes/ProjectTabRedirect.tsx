import { Navigate, useParams } from "react-router-dom";
import { projectOverviewPath } from "../lib";

export function ProjectTabRedirect() {
  const { projectId } = useParams();
  return <Navigate to={projectOverviewPath(projectId ?? "")} replace />;
}
