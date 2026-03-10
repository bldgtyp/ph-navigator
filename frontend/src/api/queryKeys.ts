export const queryKeys = {
    projectStatus: (projectId: string) => ['projectStatus', projectId] as const,
    materials: () => ['materials'] as const,
    frameTypes: () => ['frameTypes'] as const,
    glazingTypes: () => ['glazingTypes'] as const,
    apertures: (projectId: string) => ['apertures', projectId] as const,
    assemblies: (projectId: string) => ['assemblies', projectId] as const,
    manufacturerFilters: (projectId: string) => ['manufacturerFilters', projectId] as const,
};
