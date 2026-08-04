export function aperturesBuilderPath(projectId: string): string {
  return `/projects/${projectId}/apertures/builder`;
}

export function aperturesGlazingsPath(projectId: string): string {
  return `/projects/${projectId}/apertures/glazings`;
}

export function aperturesFramesPath(projectId: string): string {
  return `/projects/${projectId}/apertures/frames`;
}

export function aperturesInstallsPath(projectId: string): string {
  return `/projects/${projectId}/apertures/installs`;
}

export function aperturesUValuesPath(projectId: string): string {
  return `/projects/${projectId}/apertures/u-values`;
}

/** Every Apertures sub-tab leaf, in nav order. The route-flag union and
 * the AperturesTab redirect guard both derive from this tuple so adding a
 * sub-tab is a one-entry change. */
export const APERTURE_SUBROUTES = [
  "builder",
  "glazings",
  "frames",
  "installs",
  "u-values",
] as const;
export type ApertureSubroute = (typeof APERTURE_SUBROUTES)[number];

export function isApertureSubroute(subpath: string, route: ApertureSubroute): boolean {
  return subpath === `/${route}` || subpath.startsWith(`/${route}/`);
}

export function apertureSubpath(pathname: string, projectId: string): string {
  return pathname.replace(`/projects/${projectId}/apertures`, "");
}
