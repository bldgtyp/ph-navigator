export const CATALOGS = [
  { slug: "materials", label: "Materials" },
  { slug: "window-frame-elements", label: "Window-Frame Elements" },
  { slug: "window-glazing", label: "Window-Glazing" },
] as const;

export type CatalogSlug = (typeof CATALOGS)[number]["slug"];

export function catalogPath(slug: CatalogSlug): string {
  return `/catalog/${slug}`;
}

export function catalogBySlug(slug: string | undefined) {
  return CATALOGS.find((catalog) => catalog.slug === slug) ?? null;
}
