export function aperturesBuilderPath(projectId: string): string {
  return `/projects/${projectId}/apertures/builder`;
}

export function aperturesGlazingsPath(projectId: string): string {
  return `/projects/${projectId}/apertures/glazings`;
}

export function aperturesFramesPath(projectId: string): string {
  return `/projects/${projectId}/apertures/frames`;
}

export function isApertureSubroute(
  subpath: string,
  route: "builder" | "glazings" | "frames",
): boolean {
  return subpath === `/${route}` || subpath.startsWith(`/${route}/`);
}

export function apertureSubpath(pathname: string, projectId: string): string {
  return pathname.replace(`/projects/${projectId}/apertures`, "");
}
