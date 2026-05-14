export const catalogQueryKeys = {
  all: ["catalogs"] as const,
  materials: () => [...catalogQueryKeys.all, "materials"] as const,
  materialsList: (includeInactive: boolean) =>
    [...catalogQueryKeys.materials(), "list", { includeInactive }] as const,
  material: (id: string) => [...catalogQueryKeys.materials(), "detail", id] as const,
};
