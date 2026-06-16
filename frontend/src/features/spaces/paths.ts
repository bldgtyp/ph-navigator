export function spacesPath(projectId: string): string {
  return `/projects/${projectId}/spaces`;
}

export function spaceTypesPath(projectId: string): string {
  return `${spacesPath(projectId)}/space-types`;
}

export function spacesRoomsPath(projectId: string): string {
  return `${spacesPath(projectId)}/rooms`;
}
