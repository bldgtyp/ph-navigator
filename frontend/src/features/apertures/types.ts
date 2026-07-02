import type { CatalogOrigin } from "../project_document/catalog-origin";
import type { BaseTableSlice } from "../project_document/table-slice";

export type { CatalogOrigin, CatalogTableName } from "../project_document/catalog-origin";

export const APERTURES_TABLE_NAME = "apertures";

export type FrameRef = {
  name: string;
  manufacturer: string | null;
  brand: string | null;
  use: string | null;
  operation: string | null;
  location: string | null;
  mull_type: string | null;
  prefix: string | null;
  suffix: string | null;
  material: string | null;
  width_mm: number | null;
  u_value_w_m2k: number | null;
  psi_g_w_mk: number | null;
  psi_install_w_mk: number | null;
  color: string | null;
  source: string | null;
  comments: string | null;
  catalog_origin: CatalogOrigin | null;
};

export type SpecificationStatus = "complete" | "missing" | "question" | "na";

export type ProjectFrame = FrameRef & {
  id: string;
  specification_status: SpecificationStatus;
  datasheet_asset_ids: string[];
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

export type ProjectGlazing = GlazingRef & {
  id: string;
  specification_status: SpecificationStatus;
  datasheet_asset_ids: string[];
};

export type ProjectGlazingUseSite = {
  aperture_type_id: string;
  aperture_type_name: string;
  element_id: string;
  element_name: string;
};

export type ProjectFrameUseSite = ProjectGlazingUseSite & {
  side: ApertureSide;
};

export type ProjectGlazingRead = ProjectGlazing & {
  use_sites: ProjectGlazingUseSite[];
};

export type ProjectFrameRead = ProjectFrame & {
  use_sites: ProjectFrameUseSite[];
};

export type ApertureOperationType = "swing" | "slide";
export type ApertureOperationDirection = "left" | "right" | "up" | "down";

export type ApertureOperation = {
  type: ApertureOperationType;
  directions: ApertureOperationDirection[];
};

export type ApertureSide = "top" | "right" | "bottom" | "left";

export type ApertureElementFrames = {
  top: FrameRef | null;
  right: FrameRef | null;
  bottom: FrameRef | null;
  left: FrameRef | null;
};

export type ApertureElement = {
  id: string;
  name: string;
  row_span: [number, number];
  column_span: [number, number];
  frames: ApertureElementFrames;
  glazing: GlazingRef | null;
  operation: ApertureOperation | null;
};

export type WireApertureElementFrames = {
  top: string | null;
  right: string | null;
  bottom: string | null;
  left: string | null;
};

export type WireApertureElement = Omit<ApertureElement, "frames" | "glazing"> & {
  frames: WireApertureElementFrames;
  glazing_id: string | null;
};

export type WireApertureTypeEntry = Omit<ApertureTypeEntry, "elements"> & {
  elements: WireApertureElement[];
};

export type ApertureTypeEntry = {
  id: string;
  name: string;
  row_heights_mm: number[];
  column_widths_mm: number[];
  elements: ApertureElement[];
};

export type ManufacturerFilters = {
  frame_manufacturers_enabled: string[] | null;
  glazing_manufacturers_enabled: string[] | null;
};

export type AperturesSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  apertures: ApertureTypeEntry[];
  project_glazings: ProjectGlazing[];
  project_frames: ProjectFrame[];
  manufacturer_filters: ManufacturerFilters | null;
};

export type ApertureReadSource = "draft" | "version";

export type ApertureSpecReportResponse = BaseTableSlice & {
  project_glazings: ProjectGlazingRead[];
  project_frames: ProjectFrameRead[];
};

export type ApertureAttachmentChangeArgs = {
  tableKey: "project_glazings" | "project_frames";
  rowId: string;
  fieldKey: "datasheet_asset_ids";
  currentAssetIds: string[];
  nextAssetIds: string[];
};

export type ApertureProductCommand =
  | {
      kind: "update_project_glazing";
      project_glazing_id: string;
      specification_status?: SpecificationStatus | null;
    }
  | {
      kind: "update_project_frame";
      project_frame_id: string;
      specification_status?: SpecificationStatus | null;
    }
  | { kind: "remove_project_glazing"; project_glazing_id: string }
  | { kind: "remove_project_frame"; project_frame_id: string };

export type WireAperturesSlice = Omit<AperturesSlice, "apertures"> & {
  apertures: WireApertureTypeEntry[];
};

// Discriminated union mirroring the backend `ApertureCommand`. Five
// kinds (editDimension, addRow, addColumn, deleteRow, deleteColumn)
// were stubbed in Phase 01 and are wired in Phase 05; the remaining
// stubs (merge, split, pickFrame, pickGlazing, pasteAssignment) still
// raise `aperture_command_not_implemented` server-side.
export type ApertureCommand =
  | { kind: "createApertureType"; proposed_name?: string | null }
  | { kind: "renameApertureType"; aperture_type_id: string; new_name: string }
  | { kind: "duplicateApertureType"; aperture_type_id: string; new_name?: string | null }
  | { kind: "deleteApertureType"; aperture_type_id: string }
  | { kind: "setElementName"; aperture_type_id: string; element_id: string; new_name: string }
  | {
      kind: "setElementOperation";
      aperture_type_id: string;
      element_id: string;
      operation: ApertureOperation | null;
    }
  | {
      kind: "editDimension";
      aperture_type_id: string;
      axis: "row" | "column";
      index: number;
      new_value_mm: number;
    }
  | { kind: "addRow"; aperture_type_id: string; at_index: number; height_mm: number }
  | { kind: "addColumn"; aperture_type_id: string; at_index: number; width_mm: number }
  | { kind: "deleteRow"; aperture_type_id: string; index: number }
  | { kind: "deleteColumn"; aperture_type_id: string; index: number }
  | {
      kind: "pickFrame";
      aperture_type_id: string;
      element_id: string;
      side: ApertureSide;
      frame: FrameRef;
    }
  | {
      kind: "pickGlazing";
      aperture_type_id: string;
      element_id: string;
      glazing: GlazingRef;
    }
  | {
      // Phase 08 element-level structural edits + assignment paste.
      kind: "mergeElements";
      aperture_type_id: string;
      element_ids: string[];
    }
  | { kind: "splitElement"; aperture_type_id: string; element_id: string }
  | {
      kind: "pasteAssignment";
      aperture_type_id: string;
      source_element_id: string;
      target_element_ids: string[];
    }
  | { kind: "flipLeftRight"; aperture_type_id: string }
  | {
      // Phase 11: replace the project-document manufacturer-filter
      // enabled lists. ``null`` for either field = "all enabled".
      kind: "setManufacturerFilters";
      frame_manufacturers_enabled: string[] | null;
      glazing_manufacturers_enabled: string[] | null;
    }
  | {
      // Phase 12: write the user's per-field choices from the refresh
      // dialog onto a catalog-sourced ref. Each value is validated
      // server-side; ``catalog_origin.local_overrides`` is preserved.
      kind: "refreshRefFromCatalog";
      aperture_type_id: string;
      element_id: string;
      target: "frame.top" | "frame.right" | "frame.bottom" | "frame.left" | "glazing";
      chosen_values: Record<string, string | number | null>;
    };
