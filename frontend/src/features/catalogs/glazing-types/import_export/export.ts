// Client-side catalog export — builds a versioned JSON envelope and
// triggers a browser download. No backend round-trip: rows come from
// the TanStack-Query cache; the file is serialized in-page and saved
// via a transient anchor.

import type { CatalogGlazingType } from "../../types";
import { CURRENT_SCHEMA_VERSION, FILE_KIND, type CatalogFile, type CatalogFileRow } from "./types";

export type SerializeOptions = {
  exportedBy: string | null;
  appVersion: string | null;
  now?: Date;
};

// Stable canonical key order — `id` first so the file's identity
// column lines up at every row in a diff.
const ROW_KEY_ORDER: (keyof CatalogFileRow)[] = [
  "id",
  "name",
  "manufacturer",
  "brand",
  "suffix",
  "u_value_w_m2k",
  "g_value",
  "color",
  "source",
  "datasheet_url",
  "comments",
];

function projectRow(row: CatalogGlazingType): CatalogFileRow {
  const projected = {} as CatalogFileRow;
  for (const key of ROW_KEY_ORDER) {
    (projected as Record<string, unknown>)[key] = row[key] as unknown;
  }
  return projected;
}

export function serializeCatalog(
  rows: readonly CatalogGlazingType[],
  options: SerializeOptions,
): CatalogFile {
  const exportedAt = (options.now ?? new Date()).toISOString();
  return {
    kind: FILE_KIND,
    schema_version: CURRENT_SCHEMA_VERSION,
    exported_at: exportedAt,
    exported_by: options.exportedBy,
    app_version: options.appVersion,
    rows: rows.map(projectRow),
  };
}

export function exportFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `glazing-types-catalog_${yyyy}${mm}${dd}.json`;
}

export function formatCatalogJson(file: CatalogFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function triggerCatalogDownload(file: CatalogFile, filename: string): void {
  const json = formatCatalogJson(file);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
