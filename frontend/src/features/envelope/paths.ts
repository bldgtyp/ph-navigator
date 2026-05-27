export function envelopeAssembliesPath(projectId: string): string {
  return `/projects/${projectId}/envelope/assemblies`;
}

export function envelopeAssemblyPath(projectId: string, assemblyId: string): string {
  return `${envelopeAssembliesPath(projectId)}/${assemblyId}`;
}

export function envelopeSpecificationsPath(projectId: string): string {
  return `/projects/${projectId}/envelope/specifications`;
}

export function isEnvelopeSubroute(
  subpath: string,
  route: "assemblies" | "specifications",
): boolean {
  return subpath === `/${route}` || subpath.startsWith(`/${route}/`);
}

export function envelopeSubpath(pathname: string, projectId: string): string {
  return pathname.replace(`/projects/${projectId}/envelope`, "");
}

export function activeAssemblyIdFromSubpath(subpath: string): string | null {
  const match = subpath.match(/^\/assemblies\/([^/]+)(?:\/.*)?$/);
  return match?.[1] ?? null;
}
