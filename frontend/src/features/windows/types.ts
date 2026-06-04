import type { CatalogOrigin } from "../project_document/catalog-origin";
export type { CatalogOrigin, CatalogTableName } from "../project_document/catalog-origin";

export const WINDOW_TYPES_TABLE_NAME = "window_types";

export type FrameRef = {
  name: string;
  manufacturer: string | null;
  brand: string | null;
  width_mm: number | null;
  u_value_w_m2k: number | null;
  psi_g_w_mk: number | null;
  psi_install_w_mk: number | null;
  color: string | null;
  notes: string | null;
  source_provenance: string | null;
  catalog_origin: CatalogOrigin | null;
};

export type GlazingRef = {
  name: string;
  manufacturer: string | null;
  brand: string | null;
  suffix: string | null;
  u_value_w_m2k: number | null;
  g_value: number | null;
  color: string | null;
  source: string | null;
  comments: string | null;
  catalog_origin: CatalogOrigin | null;
};

export type FrameSide = "top" | "right" | "bottom" | "left";

export type WindowElementFrames = {
  top: FrameRef | null;
  right: FrameRef | null;
  bottom: FrameRef | null;
  left: FrameRef | null;
};

export type WindowElement = {
  id: string;
  row_span: [number, number];
  column_span: [number, number];
  frames: WindowElementFrames;
  glazing: GlazingRef | null;
};

export type WindowTypeEntry = {
  id: string;
  name: string;
  row_heights_mm: number[];
  column_widths_mm: number[];
  elements: WindowElement[];
};

export type WindowTypesSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  window_types: WindowTypeEntry[];
};

export type WindowTypesReplacePayload = {
  window_types: WindowTypeEntry[];
};

/** Minimal shape the generic catalog picker slot needs from a catalog row. */
export type CatalogPickableRow = { id: string; name: string };

/** Minimal shape the generic catalog picker slot needs from a project-document ref. */
export type PickableRef = {
  u_value_w_m2k: number | null;
  catalog_origin: CatalogOrigin | null;
};
