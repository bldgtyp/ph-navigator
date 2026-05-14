export const catalogQueryKeys = {
  all: ["catalogs"] as const,
  // Materials
  materials: () => [...catalogQueryKeys.all, "materials"] as const,
  materialsList: (includeInactive: boolean) =>
    [...catalogQueryKeys.materials(), "list", { includeInactive }] as const,
  material: (id: string) => [...catalogQueryKeys.materials(), "detail", id] as const,
  // Frame types
  frameTypes: () => [...catalogQueryKeys.all, "frame-types"] as const,
  frameTypesList: (includeInactive: boolean) =>
    [...catalogQueryKeys.frameTypes(), "list", { includeInactive }] as const,
  frameType: (id: string) => [...catalogQueryKeys.frameTypes(), "detail", id] as const,
  // Glazing types
  glazingTypes: () => [...catalogQueryKeys.all, "glazing-types"] as const,
  glazingTypesList: (includeInactive: boolean) =>
    [...catalogQueryKeys.glazingTypes(), "list", { includeInactive }] as const,
  glazingType: (id: string) => [...catalogQueryKeys.glazingTypes(), "detail", id] as const,
};
