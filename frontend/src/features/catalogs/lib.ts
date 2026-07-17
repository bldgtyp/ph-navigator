import type { AuthSession } from "../auth/types";
import type { WriteResult } from "../../shared/ui/data-table";

// The catalog backends assign their own row ids, so every row-creating
// WriteOp (insert, duplicate) reports the library-tmp-id → server-id
// mapping back to the DataTable via `WriteResult.insertedRowIds`.
export function toInsertedRowIds(
  rows: readonly { rowId: string }[],
  created: readonly { id: string }[],
): WriteResult {
  return {
    insertedRowIds: Object.fromEntries(rows.map((row, index) => [row.rowId, created[index]!.id])),
  };
}

// Feature-scoped ID prefixes for `generatedId`. Centralized so future
// catalog editors can't pick colliding short prefixes when minting
// local IDs for in-progress drafts.
export const MATERIAL_ID_PREFIX = "mat";
export const FRAME_TYPE_ID_PREFIX = "frm";
export const GLAZING_TYPE_ID_PREFIX = "glz";

// Must match CATALOG_EDIT in backend/features/access/capabilities.py.
export const CATALOG_EDIT = "catalog.edit";

export const CATALOGS = [
  { slug: "materials", label: "Materials" },
  { slug: "frame-types", label: "Window-Frame Elements" },
  { slug: "glazing-types", label: "Window-Glazing" },
] as const;

export type CatalogSlug = (typeof CATALOGS)[number]["slug"];

export function catalogPath(slug: CatalogSlug): string {
  return `/catalog/${slug}`;
}

export function catalogBySlug(slug: string | undefined) {
  return CATALOGS.find((catalog) => catalog.slug === slug) ?? null;
}

export function canEditCatalogs(session: AuthSession): boolean {
  return (session.capabilities ?? []).includes(CATALOG_EDIT);
}
