import type { FrameRef, GlazingRef } from "../windows/types";

export type { FrameRef, GlazingRef } from "../windows/types";

export const APERTURES_TABLE_NAME = "apertures";

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

export type ApertureTypeEntry = {
  id: string;
  name: string;
  row_heights_mm: number[];
  column_widths_mm: number[];
  elements: ApertureElement[];
};

export type AperturesSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  apertures: ApertureTypeEntry[];
};

// Discriminated union mirroring the backend `ApertureCommand`. Stubbed
// command kinds (everything from `editDimension` onwards) are reserved
// in the wire shape but their server-side handlers raise
// `aperture_command_not_implemented` until the phase that owns the
// gesture ships.
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
    };
