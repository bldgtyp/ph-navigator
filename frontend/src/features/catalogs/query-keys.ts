export const catalogQueryKeys = {
  all: ["catalogs"] as const,
  // Materials
  materials: () => [...catalogQueryKeys.all, "materials"] as const,
  materialsList: () => [...catalogQueryKeys.materials(), "list"] as const,
  material: (id: string) => [...catalogQueryKeys.materials(), "detail", id] as const,
  // Frame types
  frameTypes: () => [...catalogQueryKeys.all, "frame-types"] as const,
  frameTypesList: () => [...catalogQueryKeys.frameTypes(), "list"] as const,
  frameType: (id: string) => [...catalogQueryKeys.frameTypes(), "detail", id] as const,
  frameTypeManufacturers: () => [...catalogQueryKeys.frameTypes(), "manufacturers"] as const,
  frameTypeOptions: () => [...catalogQueryKeys.frameTypes(), "options"] as const,
  optionJob: (jobId: string) => [...catalogQueryKeys.all, "option-job", jobId] as const,
  unresolvedOptionJob: (catalogTable: "frame_types" | "glazing_types") =>
    [...catalogQueryKeys.all, "option-job", "unresolved", catalogTable] as const,
  // Glazing types
  glazingTypes: () => [...catalogQueryKeys.all, "glazing-types"] as const,
  glazingTypesList: () => [...catalogQueryKeys.glazingTypes(), "list"] as const,
  glazingType: (id: string) => [...catalogQueryKeys.glazingTypes(), "detail", id] as const,
  glazingTypeManufacturers: () => [...catalogQueryKeys.glazingTypes(), "manufacturers"] as const,
  glazingTypeOptions: () => [...catalogQueryKeys.glazingTypes(), "options"] as const,
};
