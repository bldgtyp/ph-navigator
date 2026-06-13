export type ExtractionStatus = "pending" | "success" | "failed";

export type HbjsonFile = {
  id: string;
  project_id: string;
  asset_id: string;
  display_name: string;
  notes: string | null;
  uploaded_by: string;
  uploaded_by_display_name: string;
  uploaded_at: string;
  size_bytes: number;
  original_filename: string;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
};

export type HbjsonFileListResponse = {
  items: HbjsonFile[];
};

export type HbjsonFileCreatePayload = {
  asset_id: string;
  display_name?: string;
  notes?: string;
};

export type HbjsonFileUpdatePayload = {
  display_name?: string;
  notes?: string | null;
};

/** Result of the full upload orchestration (hash → intent → PUT → link). */
export type HbjsonUploadOutcome =
  | { kind: "created"; file: HbjsonFile }
  | { kind: "duplicate"; existingFileId: string; existingDisplayName: string };

export type ViewerLoadPhase = "idle" | "downloading" | "building" | "ready" | "error";
export type ModelViewerErrorKind = "permanent" | "transient";
export type ModelViewerLens = "building";

export type Mesh3D = {
  vertices: [number, number, number][];
  faces: number[][];
};

export type Plane3D = {
  n: [number, number, number];
  o: [number, number, number];
  x: [number, number, number];
};

export type Face3D = {
  boundary: [number, number, number][];
  plane: Plane3D;
  mesh: Mesh3D | null;
  area: number | null;
};

export type BoundaryCondition = {
  type: string;
};

export type OpaqueConstruction = {
  identifier: string;
  type: string;
  u_factor: number | null;
  u_value: number | null;
  r_factor: number | null;
  r_value: number | null;
};

export type WindowConstruction = {
  identifier: string;
  type: string;
  u_factor: number | null;
  u_value: number | null;
  r_factor: number | null;
  r_value: number | null;
};

export type FaceModelData = {
  type: string;
  identifier: string;
  face_type: string;
  display_name: string;
  geometry: Face3D;
  boundary_condition: BoundaryCondition;
  apertures: ApertureModelData[];
  properties: {
    energy: {
      construction: OpaqueConstruction | null;
    };
  };
};

export type ApertureModelData = {
  identifier: string;
  display_name: string;
  geometry: Face3D;
  face_type: string;
  boundary_condition: BoundaryCondition;
  properties: {
    energy: {
      construction: WindowConstruction | null;
    };
  };
};

export type LoadSummary = {
  air_boundaries_skipped: number;
  faces_extracted: number;
  spaces_extracted: number;
  shade_groups_extracted: number;
  extraction_warnings: string[];
};

export type CombinedModelData = {
  faces: FaceModelData[];
  spaces: unknown[];
  sun_path: unknown | null;
  hot_water_systems: unknown[];
  ventilation_systems: unknown[];
  shading_elements: unknown[];
  load_summary: LoadSummary;
};

export type ModelObjectType = "faceMesh" | "apertureMeshFace";
export type ModelObjectCounts = Record<ModelObjectType, number>;

export type ModelObjectMeta = {
  id: string;
  type: ModelObjectType;
  identifier: string;
  display_name: string;
  face_type: string;
  boundary_condition: BoundaryCondition;
  area: number | null;
  properties: FaceModelData["properties"] | ApertureModelData["properties"];
  vertices: [number, number, number][];
};

export type ModelViewerDebugState = {
  loadPhase: ViewerLoadPhase;
  errorKind: ModelViewerErrorKind | null;
  activeFileId: string | null;
  objectCounts: ModelObjectCounts;
  objectIds: string[];
  lens: ModelViewerLens;
  selectionId: string | null;
  hoverId: string | null;
  selectObject: (objectId: string | null) => void;
  clearSelection: () => void;
};
