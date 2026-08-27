// Fully-typed Glazings / Frames spec-report fixtures. Typed rather than cast so
// a field added to `ProjectGlazing` / `ProjectFrame` fails here instead of
// silently defaulting to undefined.
import type { ApertureSpecReportResponse, ProjectFrameRead, ProjectGlazingRead } from "../types";

export const PROJECT_ID = "0a4a8f7e-1c3d-4a9c-9c8e-3f6b2d1e5a70";
export const VERSION_ID = "6a5f0c1b-9d2e-4f3a-8b7c-1e2d3f4a5b6c";

export function glazingRow(
  id: string,
  overrides: Partial<ProjectGlazingRead> = {},
): ProjectGlazingRead {
  return {
    id,
    name: `Glazing ${id}`,
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: 0.6,
    g_value: 0.5,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
    specification_status: "needed",
    datasheet_asset_ids: [],
    photo_asset_ids: [],
    use_sites: [],
    ...overrides,
  };
}

export function frameRow(id: string, overrides: Partial<ProjectFrameRead> = {}): ProjectFrameRead {
  return {
    id,
    name: `Frame ${id}`,
    manufacturer: null,
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: 90,
    u_value_w_m2k: 0.9,
    psi_g_w_mk: 0.03,
    psi_install_w_mk: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
    specification_status: "needed",
    datasheet_asset_ids: [],
    photo_asset_ids: [],
    use_sites: [],
    ...overrides,
  };
}

export function specReportSlice(
  overrides: Partial<ApertureSpecReportResponse> = {},
): ApertureSpecReportResponse {
  return {
    project_id: PROJECT_ID,
    version_id: VERSION_ID,
    source: "draft",
    version_etag: "version-etag",
    draft_etag: "draft-etag-0",
    project_glazings: [glazingRow("pglz_a"), glazingRow("pglz_b")],
    project_frames: [frameRow("pfrm_a")],
    ...overrides,
  };
}
