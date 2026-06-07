// Catalog-row → ``FrameRef`` / ``GlazingRef`` builders.
//
// These run in the picker and the region-click open-picker flow before
// dispatching ``pickFrame`` / ``pickGlazing``. The backend re-stamps
// ``catalog_origin.synced_at`` to its own clock, so the value we set
// here is essentially a placeholder; we mark ``catalog_schema_version
// = 1`` so the rest of the origin payload is well-formed even before
// the round-trip.

import type { CatalogFrameType, CatalogGlazingType } from "../catalogs/types";
import type { FrameRef, GlazingRef } from "./types";

const PLACEHOLDER_SYNCED_AT = "2026-01-01T00:00:00Z";

export function catalogRowToFrameRef(row: CatalogFrameType): FrameRef {
  return {
    name: row.name,
    manufacturer: row.manufacturer,
    brand: row.brand,
    use: row.use,
    operation: row.operation,
    location: row.location,
    mull_type: row.mull_type,
    prefix: row.prefix,
    suffix: row.suffix,
    material: row.material,
    width_mm: row.width_mm,
    u_value_w_m2k: row.u_value_w_m2k,
    psi_g_w_mk: row.psi_g_w_mk,
    psi_install_w_mk: row.psi_install_w_mk,
    color: row.color,
    source: row.source,
    comments: row.comments,
    catalog_origin: {
      catalog_table: "frame_types",
      catalog_record_id: row.id,
      catalog_version_id: null,
      catalog_schema_version: 1,
      synced_at: PLACEHOLDER_SYNCED_AT,
      local_overrides: [],
    },
  };
}

export function catalogRowToGlazingRef(row: CatalogGlazingType): GlazingRef {
  return {
    name: row.name,
    manufacturer: row.manufacturer,
    brand: row.brand,
    suffix: row.suffix,
    u_value_w_m2k: row.u_value_w_m2k,
    g_value: row.g_value,
    color: row.color,
    source: row.source,
    comments: row.comments,
    catalog_origin: {
      catalog_table: "glazing_types",
      catalog_record_id: row.id,
      catalog_version_id: null,
      catalog_schema_version: 1,
      synced_at: PLACEHOLDER_SYNCED_AT,
      local_overrides: [],
    },
  };
}
