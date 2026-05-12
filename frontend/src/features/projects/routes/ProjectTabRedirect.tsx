import { Navigate, useParams } from "react-router-dom";
import { projectStatusPath } from "../lib";

export function ProjectTabRedirect() {
  const { projectId } = useParams();
  return <Navigate to={projectStatusPath(projectId ?? "")} replace />;
}
