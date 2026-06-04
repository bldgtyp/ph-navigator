// Client-side catalog export — builds a versioned JSON envelope and
// triggers a browser download. No backend round-trip: rows come from
// the TanStack-Query cache; the file is serialized in-page and saved
// via a transient anchor.

import type { CatalogMaterial } from "../../types";
import { CURRENT_SCHEMA_VERSION, FILE_KIND, type CatalogFile, type CatalogFileRow } from "./types";

export type SerializeOptions = {
  exportedBy: string | null;
  appVersion: string | null;
  // Override for tests; defaults to the call moment.
  now?: Date;
};

// Stable canonical key order — `id` first so the file's identity
// column lines up at every row in a diff, then the nine catalog
// fields in the same order they live on the wire.
const ROW_KEY_ORDER: (keyof CatalogFileRow)[] = [
  "id",
  "name",
  "category",
  "density_kg_m3",
  "specific_heat_j_kgk",
  "conductivity_w_mk",
  "emissivity",
  "color",
  "source",
  "url",
  "comments",
];

function projectRow(row: CatalogMaterial): CatalogFileRow {
  const projected = {} as CatalogFileRow;
  for (const key of ROW_KEY_ORDER) {
    // Cast through unknown — the source/target row schemas overlap
    // on every field name in ROW_KEY_ORDER, but TS narrows the
    // assignment per-key and fights us otherwise.
    (projected as Record<string, unknown>)[key] = row[key] as unknown;
  }
  return projected;
}

export function serializeCatalog(
  rows: readonly CatalogMaterial[],
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
  return `materials-catalog_${yyyy}${mm}${dd}.json`;
}

// Pretty-print so the file is diff-friendly. JSON.stringify(_, _, 2)
// preserves insertion order of object keys, which serializeCatalog
// already controlled via ROW_KEY_ORDER + the envelope literal.
export function formatCatalogJson(file: CatalogFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

// Browser side-effect: build a Blob, attach to a transient anchor,
// click it. Isolated so unit tests can exercise `serializeCatalog` +
// `formatCatalogJson` without a DOM.
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
    // Free the blob URL on the next tick — Safari needs the click to
    // resolve before the URL is revoked.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
