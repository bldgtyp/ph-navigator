import { generatedId } from "../../shared/lib/ids";
import type { CatalogFrameType, CatalogGlazingType } from "../catalogs/types";
import type {
  CatalogOrigin,
  FrameRef,
  FrameSide,
  GlazingRef,
  PickableRef,
  WindowElement,
  WindowTypeEntry,
} from "./types";

export const FRAME_SIDES: readonly FrameSide[] = ["top", "right", "bottom", "left"];

export const OVERRIDE_TRACKER_FIELD: keyof FrameRef & keyof GlazingRef = "u_value_w_m2k";

export function naturalSortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export const DEFAULT_WINDOW_TYPE_NAME = "Unnamed Window Type";

export function uniqueWindowTypeName(base: string, existing: WindowTypeEntry[]): string {
  const taken = new Set(existing.map((entry) => entry.name.trim().toLocaleLowerCase()));
  const trimmed = base.trim() || DEFAULT_WINDOW_TYPE_NAME;
  if (!taken.has(trimmed.toLocaleLowerCase())) return trimmed;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${trimmed} (${i})`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${trimmed} (${Date.now()})`;
}

export function newWindowType(
  existing: WindowTypeEntry[],
  baseName = DEFAULT_WINDOW_TYPE_NAME,
): WindowTypeEntry {
  return {
    id: generatedId("win"),
    name: uniqueWindowTypeName(baseName, existing),
    row_heights_mm: [1000],
    column_widths_mm: [1000],
    elements: [newWindowElement()],
  };
}

export function newWindowElement(): WindowElement {
  return {
    id: generatedId("winel"),
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: null,
  };
}

export function frameRefFromCatalog(row: CatalogFrameType): FrameRef {
  return {
    name: row.name,
    manufacturer: row.manufacturer,
    brand: row.brand,
    width_mm: row.width_mm,
    u_value_w_m2k: row.u_value_w_m2k,
    psi_g_w_mk: row.psi_g_w_mk,
    psi_install_w_mk: row.psi_install_w_mk,
    argb_color: row.argb_color,
    notes: row.notes,
    source_provenance: row.source_provenance,
    catalog_origin: stampCatalogOrigin({
      catalog_table: "frame_types",
      catalog_record_id: row.id,
      catalog_version_id: row.current_version_id,
      catalog_schema_version: row.catalog_schema_version,
    }),
  };
}

export function glazingRefFromCatalog(row: CatalogGlazingType): GlazingRef {
  return {
    name: row.name,
    manufacturer: row.manufacturer,
    brand: row.brand,
    u_value_w_m2k: row.u_value_w_m2k,
    g_value: row.g_value,
    argb_color: row.argb_color,
    notes: row.notes,
    source_provenance: row.source_provenance,
    catalog_origin: stampCatalogOrigin({
      catalog_table: "glazing_types",
      catalog_record_id: row.id,
      catalog_version_id: row.current_version_id,
      catalog_schema_version: row.catalog_schema_version,
    }),
  };
}

function stampCatalogOrigin(input: {
  catalog_table: CatalogOrigin["catalog_table"];
  catalog_record_id: string;
  catalog_version_id: string;
  catalog_schema_version: number;
}): CatalogOrigin {
  return {
    ...input,
    synced_at: new Date().toISOString(),
    local_overrides: [],
  };
}

/** Add a field key to `local_overrides` if not already present. Returns a new
 * catalog_origin; pass through unchanged when there is no origin (hand-entered). */
export function trackLocalOverride<T extends { catalog_origin: CatalogOrigin | null }>(
  ref: T,
  fieldKey: string,
): T {
  const origin = ref.catalog_origin;
  if (!origin) return ref;
  if (origin.local_overrides.includes(fieldKey)) return ref;
  return {
    ...ref,
    catalog_origin: { ...origin, local_overrides: [...origin.local_overrides, fieldKey] },
  };
}

/** Apply a U-value edit to a frame/glazing ref and stamp the override tracker. */
export function applyUValueOverride<T extends PickableRef>(ref: T, nextValue: number | null): T {
  return trackLocalOverride({ ...ref, u_value_w_m2k: nextValue }, OVERRIDE_TRACKER_FIELD);
}

export function replaceWindowTypeInList(
  list: WindowTypeEntry[],
  next: WindowTypeEntry,
): WindowTypeEntry[] {
  const idx = list.findIndex((entry) => entry.id === next.id);
  if (idx === -1) return [...list, next];
  const copy = list.slice();
  copy[idx] = next;
  return copy;
}

export function updateElementInWindowType(
  windowType: WindowTypeEntry,
  elementId: string,
  updater: (element: WindowElement) => WindowElement,
): WindowTypeEntry {
  return {
    ...windowType,
    elements: windowType.elements.map((element) =>
      element.id === elementId ? updater(element) : element,
    ),
  };
}
