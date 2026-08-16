import type { CatalogOrigin } from "../project_document/catalog-origin";
import type { BaseTableSlice } from "../project_document/table-slice";
import type {
  SpecificationStatus,
  WireSpecificationStatusRecord,
} from "../project_document/specification-status";

export type { CatalogOrigin, CatalogTableName } from "../project_document/catalog-origin";
export type { SpecificationStatus } from "../project_document/specification-status";

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

export type ProjectFrame = FrameRef & {
  id: string;
  specification_status: SpecificationStatus;
  datasheet_asset_ids: string[];
  datasheet_not_required?: boolean;
  photo_asset_ids: string[];
  photo_not_required?: boolean;
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
  datasheet_not_required?: boolean;
  photo_asset_ids: string[];
  photo_not_required?: boolean;
};

export type WireProjectFrame = WireSpecificationStatusRecord<ProjectFrame>;

export type WireProjectGlazing = WireSpecificationStatusRecord<ProjectGlazing>;

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
export type ApertureElementKind = "glazed" | "void";

export type ApertureOperation = {
  type: ApertureOperationType;
  directions: ApertureOperationDirection[];
};

export type ApertureSide = "top" | "right" | "bottom" | "left";
export const APERTURE_SIDES = [
  "top",
  "right",
  "bottom",
  "left",
] as const satisfies readonly ApertureSide[];

export type ApertureElementFrames = {
  top: FrameRef | null;
  right: FrameRef | null;
  bottom: FrameRef | null;
  left: FrameRef | null;
};

// Per-side install-type assignment slots; `null` inherits the project
// Default install type (`apit_default`). Raw wire ids on both wire and
// hydrated elements — effective-Ψ resolution is a backend concern
// surfaced via the U-Values panel and route 3.
export type ApertureElementInstalls = {
  top: string | null;
  right: string | null;
  bottom: string | null;
  left: string | null;
};

export type ApertureElement = {
  id: string;
  name: string;
  kind: ApertureElementKind;
  row_span: [number, number];
  column_span: [number, number];
  frames: ApertureElementFrames;
  installs: ApertureElementInstalls;
  glazing: GlazingRef | null;
  operation: ApertureOperation | null;
};

export type WireApertureElementFrames = {
  top: string | null;
  right: string | null;
  bottom: string | null;
  left: string | null;
};

export type ApertureAssignmentSnapshot = {
  operation: ApertureOperation | null;
  glazing_id: string | null;
  frames: WireApertureElementFrames;
  installs: ApertureElementInstalls;
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

// Install-type library row projected for the builder UI (mirror of the
// backend `ApertureInstallTypeSummary`). `source` is the option id of the
// row's Source single-select.
export type ApertureInstallTypeSummary = {
  id: string;
  name: string | null;
  psi_w_mk: number | null;
  source: string | null;
  has_pdf: boolean;
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
  aperture_install_types: ApertureInstallTypeSummary[];
  manufacturer_filters: ManufacturerFilters | null;
};

export type ApertureReadSource = "draft" | "version";

export type ApertureSpecReportResponse = BaseTableSlice & {
  project_glazings: ProjectGlazingRead[];
  project_frames: ProjectFrameRead[];
};

export type WireApertureSpecReportResponse = Omit<
  ApertureSpecReportResponse,
  "project_glazings" | "project_frames"
> & {
  project_glazings: Array<WireSpecificationStatusRecord<ProjectGlazingRead>>;
  project_frames: Array<WireSpecificationStatusRecord<ProjectFrameRead>>;
};

export type ApertureAttachmentChangeArgs = {
  tableKey: "project_glazings" | "project_frames";
  rowId: string;
  fieldKey: "datasheet_asset_ids" | "photo_asset_ids";
  currentAssetIds: string[];
  nextAssetIds: string[];
};

export type ApertureProductCommand =
  | {
      kind: "update_project_glazing";
      project_glazing_id: string;
      specification_status?: SpecificationStatus | null;
      datasheet_not_required?: boolean | null;
      photo_not_required?: boolean | null;
    }
  | {
      kind: "update_project_frame";
      project_frame_id: string;
      specification_status?: SpecificationStatus | null;
      datasheet_not_required?: boolean | null;
      photo_not_required?: boolean | null;
    }
  | { kind: "remove_project_glazing"; project_glazing_id: string }
  | { kind: "remove_project_frame"; project_frame_id: string };

export type WireAperturesSlice = Omit<
  AperturesSlice,
  "apertures" | "project_glazings" | "project_frames"
> & {
  apertures: WireApertureTypeEntry[];
  project_glazings: WireProjectGlazing[];
  project_frames: WireProjectFrame[];
};

// Discriminated union mirroring the backend `ApertureCommand`. Every
// kind is wired server-side; the install-assignment kinds
// (setElementInstall / applyInstallToApertures / copyElementInstalls)
// are consumed by the Installs modal (aperture-psi-install phase 05).
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
      kind: "setElementKind";
      aperture_type_id: string;
      element_ids: string[];
      element_kind: ApertureElementKind;
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
      restore_assignment?: ApertureAssignmentSnapshot;
    }
  | { kind: "flipLeftRight"; aperture_type_id: string }
  | {
      // aperture-psi-install: assign (or clear, with null) one perimeter
      // edge's install-type slot. Interior (mulled) edges are rejected.
      kind: "setElementInstall";
      aperture_type_id: string;
      element_id: string;
      side: ApertureSide;
      install_type_id: string | null;
    }
  | {
      // aperture-psi-install: bulk-assign one install type to every
      // perimeter edge of the listed apertures (null clears to inherit).
      kind: "applyInstallToApertures";
      aperture_ids: string[];
      install_type_id: string | null;
    }
  | {
      // aperture-psi-install: copy per-edge install assignments onto
      // apertures with an identical grid signature.
      kind: "copyElementInstalls";
      source_aperture_id: string;
      target_aperture_ids: string[];
    }
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
