import type { ModelViewerSection } from "./lib/section";

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
export type ModelViewerLens =
  | "building"
  | "spaces"
  | "floor-areas"
  | "site-sun"
  | "ventilation"
  | "hot-water";
export type ModelViewerTheme =
  | "shaded"
  | "surface-type"
  | "boundary"
  | "construction"
  | "window-construction"
  | "ventilation-airflow"
  | "weighting-factor";

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

export type SpacePhProperties = {
  id_num: number | null;
  type: string | null;
  _v_eta: number | null;
  _v_sup: number | null;
  _v_tran: number | null;
};

export type SpaceFloorSegmentModelData = {
  identifier: string;
  display_name: string;
  geometry: Face3D | null;
  weighting_factor: number;
  floor_area: number | null;
  weighted_floor_area: number | null;
};

export type SpaceVolumeModelData = {
  identifier: string;
  display_name: string;
  avg_ceiling_height: number;
  floor: {
    identifier: string;
    display_name: string;
    floor_segments: SpaceFloorSegmentModelData[];
    geometry: Face3D;
  };
  geometry: Face3D[];
};

export type SpaceModelData = {
  identifier: string;
  quantity: number;
  name: string;
  number: string;
  wufi_type: number;
  volumes: SpaceVolumeModelData[];
  properties: {
    ph: SpacePhProperties | null;
  };
  net_volume: number;
  floor_area: number;
  weighted_floor_area: number;
  avg_clear_height: number;
  average_floor_weighting_factor: number;
};

export type LineSegment3D = {
  p: [number, number, number];
  v: [number, number, number];
};

export type DuctSegmentModelData = {
  identifier: string;
  display_name: string;
  geometry: LineSegment3D;
  diameter: number;
  height: number | null;
  width: number | null;
  insulation_thickness: number;
  insulation_conductivity: number;
  insulation_reflective: boolean;
  length: number;
};

export type DuctElementModelData = {
  identifier: string;
  display_name: string;
  duct_type: 1 | 2 | number;
  segments: Record<string, DuctSegmentModelData>;
  length: number;
};

export type VentilationSystemModelData = {
  identifier: string;
  display_name: string;
  sys_type: number;
  supply_ducting: DuctElementModelData[];
  exhaust_ducting: DuctElementModelData[];
};

export type PipeSegmentModelData = {
  geometry: LineSegment3D;
  diameter_mm: number;
  insulation_thickness_mm: number;
  insulation_conductivity: number;
  insulation_reflective: boolean;
  insulation_quality: unknown;
  daily_period: number;
  water_temp_c: number;
  material_value: string;
  length: number;
};

export type PipeElementModelData = {
  identifier: string;
  display_name: string;
  segments: Record<string, PipeSegmentModelData>;
  length: number;
  water_temp: number;
  daily_period: number;
  material_name: string;
  diameter: number;
};

export type PipeBranchModelData = {
  identifier: string;
  display_name: string;
  pipe_element: PipeElementModelData;
  fixtures: Record<string, PipeElementModelData>;
};

export type PipeTrunkModelData = {
  identifier: string;
  display_name: string;
  pipe_element: PipeElementModelData;
  branches: Record<string, PipeBranchModelData>;
  multiplier: number;
};

export type HotWaterSystemModelData = {
  identifier: string;
  display_name: string;
  distribution_piping: Record<string, PipeTrunkModelData>;
  recirc_piping: Record<string, PipeElementModelData>;
};

export type ShadeModelData = {
  type: string;
  identifier: string;
  user_data: Record<string, unknown> | null;
  display_name: string;
  is_detached: boolean;
  geometry: Face3D;
};

export type ShadeGroupModelData = {
  shades: ShadeModelData[];
};

export type Polyline3DModelData = {
  vertices: [number, number, number][];
};

export type Arc3DModelData = {
  plane: Plane3D;
  radius: number;
  a1: number;
  a2: number;
};

export type Arc2DModelData = {
  c: [number, number];
  r: number;
  a1: number;
  a2: number;
};

export type LineSegment2DModelData = {
  p: [number, number];
  v: [number, number];
};

/** Backend-computed hourly solar positions (sun study). Unit vectors live in
 *  the same unit-radius, true-north-baked frame as the dome geometry; hours
 *  are local standard time (no DST) on a 365-day year. The frontend only
 *  interpolates between adjacent vectors for display smoothness (PRD D-1). */
export type SunPositionGridModelData = {
  true_north_deg: number;
  hours: number[];
  days: number[];
  unit_vectors: [number, number, number][];
  sunrise_sunset: [number | null, number | null][];
};

export type SunPathAndCompassModelData = {
  sunpath: {
    hourly_analemma_polyline3d: Polyline3DModelData[];
    monthly_day_arc3d: Arc3DModelData[];
  };
  compass: {
    all_boundary_circles: Arc2DModelData[];
    major_azimuth_ticks: LineSegment2DModelData[];
    minor_azimuth_ticks: LineSegment2DModelData[];
  };
  sun_positions: SunPositionGridModelData;
};

export type CombinedModelData = {
  faces: FaceModelData[];
  spaces: SpaceModelData[];
  hot_water_systems: HotWaterSystemModelData[];
  ventilation_systems: VentilationSystemModelData[];
  shading_elements: ShadeGroupModelData[];
  load_summary: LoadSummary;
};

export type ModelObjectType =
  | "faceMesh"
  | "apertureMeshFace"
  | "spaceGroup"
  | "spaceFloorSegmentMeshFace"
  | "ductSegmentLine"
  | "pipeSegmentLine";
export type ModelObjectCounts = Record<ModelObjectType, number>;

type BaseModelObjectMeta<TType extends ModelObjectType> = {
  id: string;
  type: TType;
  identifier: string;
  display_name: string;
  face_type: string;
  boundary_condition: BoundaryCondition | null;
  area: number | null;
  vertices: [number, number, number][];
};

export type FaceMeshMeta = BaseModelObjectMeta<"faceMesh"> & {
  properties: FaceModelData["properties"];
};

export type ApertureMeshFaceMeta = BaseModelObjectMeta<"apertureMeshFace"> & {
  properties: ApertureModelData["properties"];
};

export type SpaceGroupMeta = BaseModelObjectMeta<"spaceGroup"> & {
  properties: SpaceModelData["properties"];
  number?: string;
  quantity?: number;
  wufi_type?: number;
  net_volume?: number;
  floor_area?: number | null;
  weighted_floor_area?: number | null;
  avg_clear_height?: number;
  average_floor_weighting_factor?: number;
  airflow?: SpacePhProperties | null;
};

export type SpaceFloorSegmentMeshFaceMeta = BaseModelObjectMeta<"spaceFloorSegmentMeshFace"> & {
  properties: SpaceModelData["properties"];
  number?: string;
  floor_area?: number | null;
  weighted_floor_area?: number | null;
  weighting_factor?: number;
  airflow?: SpacePhProperties | null;
};

export type DuctSegmentLineMeta = BaseModelObjectMeta<"ductSegmentLine"> & {
  properties: Record<string, never>;
  duct_type?: 1 | 2 | number;
  diameter_m?: number;
  length?: number;
  insulation_thickness_m?: number;
  insulation_conductivity?: number;
  insulation_reflective?: boolean;
};

export type PipeSegmentLineMeta = BaseModelObjectMeta<"pipeSegmentLine"> & {
  properties: Record<string, never>;
  diameter_mm?: number;
  insulation_thickness_mm?: number;
  insulation_conductivity?: number;
  insulation_reflective?: boolean;
  insulation_quality?: unknown;
  water_temp_c?: number;
  daily_period?: number;
  length?: number;
  material_value?: string;
  pipe_kind?: "distribution" | "recirc";
};

export type ModelObjectMeta =
  | FaceMeshMeta
  | ApertureMeshFaceMeta
  | SpaceGroupMeta
  | SpaceFloorSegmentMeshFaceMeta
  | DuctSegmentLineMeta
  | PipeSegmentLineMeta;

export type ModelViewerLegendRow = {
  id: string;
  label: string;
  color: string;
  count: number;
};

export type ModelViewerLegend = {
  title: string;
  rows: ModelViewerLegendRow[];
  kind: "theme" | "mini-key";
} | null;

/** An active legend filter (NEW-VIEW-2): the matched bucket keys, stamped with
 *  the theme they belong to so a filter left over from another theme is ignored
 *  rather than wrongly applied. A single-element set is a single-select filter. */
export type LegendFilter = {
  theme: ModelViewerTheme;
  keys: Set<string>;
};

export type ModelViewerMeasurePoint = {
  id: string;
  sourceObjectId: string;
  position: [number, number, number];
};

export type ModelViewerMeasureLine = {
  id: string;
  start: ModelViewerMeasurePoint;
  end: ModelViewerMeasurePoint;
  distanceM: number;
};

export type ModelViewerDebugState = {
  loadPhase: ViewerLoadPhase;
  errorKind: ModelViewerErrorKind | null;
  activeFileId: string | null;
  objectCounts: ModelObjectCounts;
  shadeCount: number;
  sunPathReady: boolean;
  objectIds: string[];
  elementIds: string[];
  visibleObjectIds: string[];
  section: ModelViewerSection | null;
  sectionClippedObjectIds: () => string[];
  lens: ModelViewerLens;
  theme: ModelViewerTheme;
  legend: ModelViewerLegend;
  /** The active legend filter, keys as an array for `page.evaluate` round-trips. */
  legendFilter: { theme: ModelViewerTheme; keys: string[] } | null;
  selectionId: string | null;
  hoverId: string | null;
  focusedSegmentId: string | null;
  measureActive: boolean;
  measureSnap: ModelViewerMeasurePoint | null;
  measureLines: ModelViewerMeasureLine[];
  /** Sun-study scrub state + derived altitude (null until first engaged). */
  sunStudy: { engaged: boolean; day: number; minutes: number; altitudeDeg: number | null } | null;
  engageSunStudy: () => void;
  disengageSunStudy: () => void;
  setSunStudyDay: (day: number) => void;
  setSunStudyMinutes: (minutes: number) => void;
  setLens: (lens: ModelViewerLens) => void;
  setTheme: (theme: ModelViewerTheme) => void;
  themeColorForObject: (objectId: string) => string | null;
  lineHighlightTierForObject: (objectId: string) => string;
  segmentIdsForElement: (elementId: string) => string[];
  selectObject: (objectId: string | null) => void;
  setHoverId: (objectId: string | null) => void;
  toggleFocusedSegment: (segmentId: string) => void;
  selectAnyModelObject: (type?: ModelObjectType) => string | null;
  clearSelection: () => void;
  setSection: (section: ModelViewerSection) => void;
  clearSection: () => void;
  setMeasureActive: (active: boolean) => void;
  measureBetweenVertices: (
    sourceObjectId: string,
    startIndex?: number,
    endIndex?: number,
  ) => ModelViewerMeasureLine | null;
};
