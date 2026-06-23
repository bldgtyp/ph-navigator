import { Box3, BufferGeometry, Vector3 } from "three";
import { expandBoundsByPoints } from "./bounds";
import { geometryFromFace3D } from "./geometry";
import { mergeEdges, mergeRenderableGeometries } from "./merge";
import { EDGE_THRESHOLD_DEGREES } from "../lib/colors";
import { MODEL_VIEWER_LENS_IDS } from "../lib/lenses";
import type {
  ApertureModelData,
  CombinedModelData,
  DuctElementModelData,
  FaceModelData,
  HotWaterSystemModelData,
  LineSegment3D,
  ModelObjectCounts,
  ModelObjectMeta,
  ModelViewerLens,
  PipeElementModelData,
  ShadeGroupModelData,
  SpaceModelData,
} from "../types";

export type BuildingRenderable = {
  id: string;
  lens: ModelViewerLens;
  kind: "mesh";
  geometries: BufferGeometry[];
  meta: ModelObjectMeta;
};

export type LineRenderable = {
  id: string;
  lens: ModelViewerLens;
  kind: "line";
  points: [[number, number, number], [number, number, number]];
  meta: ModelObjectMeta;
  lineStyle: "duct-supply" | "duct-exhaust" | "pipe-distribution" | "pipe-recirc";
};

/**
 * One shade group merged into a single mesh + edge line (D-7/F9). Shades sharing
 * a `display_name` collapse to one renderable, matching V1 + PRD §7, so a façade
 * of louvres draws in two calls instead of two per blade. Non-selectable.
 */
export type ShadeRenderable = {
  id: string;
  displayName: string;
  geometry: BufferGeometry;
  edges: BufferGeometry;
};

export type ModelRenderable = BuildingRenderable | LineRenderable;

export type LensAvailability = Record<ModelViewerLens, boolean>;

/**
 * The whole building merged into one mesh + one edge line (F5). Built once at
 * model load and rendered as the faint "ghost" context on every non-building
 * lens, so the ghost costs two draw calls instead of ~2 × the face count.
 */
export type GhostGeometry = { geometry: BufferGeometry; edges: BufferGeometry };

export type BuildingModel = {
  objects: ModelRenderable[];
  buildingObjects: BuildingRenderable[];
  ghost: GhostGeometry;
  shadeObjects: ShadeRenderable[];
  metaById: Map<string, ModelObjectMeta>;
  bounds: Box3;
  objectCounts: ModelObjectCounts;
  lensAvailability: LensAvailability;
};

export function buildBuildingModel(data: CombinedModelData): BuildingModel {
  const objects: ModelRenderable[] = [];
  const bounds = new Box3();

  for (const face of data.faces) {
    const renderable = renderableFromFace(face);
    if (renderable) objects.push(renderable);

    for (const aperture of face.apertures) {
      const apertureRenderable = renderableFromAperture(aperture);
      if (apertureRenderable) objects.push(apertureRenderable);
    }
  }

  objects.push(...spaceRenderables(data.spaces));
  objects.push(...floorSegmentRenderables(data.spaces));
  objects.push(...ductRenderables(data.ventilation_systems));
  objects.push(...pipeRenderables(data.hot_water_systems));
  const shadeObjects = shadeRenderables(data.shading_elements);

  for (const object of objects) {
    if (object.kind === "mesh") {
      expandBoundsByGeometries(bounds, object.geometries);
    } else {
      expandBoundsByPoints(bounds, object.points);
    }
  }
  for (const shade of shadeObjects) {
    expandBoundsByGeometries(bounds, [shade.geometry]);
  }

  const metaById = new Map(objects.map((object) => [object.id, object.meta]));
  const buildingObjects = objects.filter(
    (object): object is BuildingRenderable =>
      object.kind === "mesh" &&
      (object.meta.type === "faceMesh" || object.meta.type === "apertureMeshFace"),
  );
  return {
    objects,
    buildingObjects,
    ghost: buildGhostGeometry(buildingObjects),
    shadeObjects,
    metaById,
    bounds: bounds.isEmpty() ? fallbackBounds(objects) : bounds,
    objectCounts: countObjects(objects),
    lensAvailability: lensAvailability(objects),
  };
}

function buildGhostGeometry(objects: BuildingRenderable[]): GhostGeometry {
  return {
    geometry: mergeRenderableGeometries(objects).geometry,
    edges: mergeEdges(objects, EDGE_THRESHOLD_DEGREES),
  };
}

function renderableFromFace(face: FaceModelData): BuildingRenderable | null {
  const built = geometryFromFace3D(face.geometry);
  if (!built) return null;
  const id = `face:${face.identifier}`;
  return {
    id,
    lens: "building",
    kind: "mesh",
    geometries: [built.geometry],
    meta: {
      id,
      type: "faceMesh",
      identifier: face.identifier,
      display_name: face.display_name,
      face_type: face.face_type,
      boundary_condition: face.boundary_condition,
      area: face.geometry.area,
      properties: face.properties,
      vertices: built.vertices,
    },
  };
}

function renderableFromAperture(aperture: ApertureModelData): BuildingRenderable | null {
  const built = geometryFromFace3D(aperture.geometry);
  if (!built) return null;
  const id = `aperture:${aperture.identifier}`;
  return {
    id,
    lens: "building",
    kind: "mesh",
    geometries: [built.geometry],
    meta: {
      id,
      type: "apertureMeshFace",
      identifier: aperture.identifier,
      display_name: aperture.display_name,
      face_type: aperture.face_type,
      boundary_condition: aperture.boundary_condition,
      area: aperture.geometry.area,
      properties: aperture.properties,
      vertices: built.vertices,
    },
  };
}

function spaceRenderables(spaces: SpaceModelData[]): BuildingRenderable[] {
  return spaces.flatMap((space) => {
    const geometries = space.volumes
      .flatMap((volume) => volume.geometry)
      .map(geometryFromFace3D)
      .filter((built): built is NonNullable<typeof built> => built !== null);
    if (geometries.length === 0) return [];
    const id = `space:${space.identifier}`;
    return [
      {
        id,
        lens: "spaces",
        kind: "mesh",
        geometries: geometries.map((built) => built.geometry),
        meta: {
          id,
          type: "spaceGroup",
          identifier: space.identifier,
          display_name: space.name,
          face_type: "Space",
          boundary_condition: null,
          area: space.floor_area,
          properties: space.properties,
          vertices: geometries.flatMap((built) => built.vertices),
          number: space.number,
          quantity: space.quantity,
          wufi_type: space.wufi_type,
          net_volume: space.net_volume,
          floor_area: space.floor_area,
          weighted_floor_area: space.weighted_floor_area,
          avg_clear_height: space.avg_clear_height,
          average_floor_weighting_factor: space.average_floor_weighting_factor,
          airflow: space.properties.ph,
        },
      },
    ];
  });
}

function floorSegmentRenderables(spaces: SpaceModelData[]): BuildingRenderable[] {
  const renderables: BuildingRenderable[] = [];
  for (const space of spaces) {
    for (const volume of space.volumes) {
      for (const segment of volume.floor.floor_segments) {
        if (!segment.geometry) continue;
        const built = geometryFromFace3D(segment.geometry);
        if (!built) continue;
        const id = `floor:${segment.identifier}`;
        renderables.push({
          id,
          lens: "floor-areas",
          kind: "mesh",
          geometries: [built.geometry],
          meta: {
            id,
            type: "spaceFloorSegmentMeshFace",
            identifier: segment.identifier,
            display_name: space.name,
            face_type: "Floor Segment",
            boundary_condition: null,
            area: segment.floor_area,
            properties: space.properties,
            vertices: built.vertices,
            number: space.number,
            floor_area: segment.floor_area,
            weighted_floor_area: segment.weighted_floor_area,
            weighting_factor: segment.weighting_factor,
            airflow: space.properties.ph,
          },
        });
      }
    }
  }
  return renderables;
}

function ductRenderables(systems: CombinedModelData["ventilation_systems"]): LineRenderable[] {
  const renderables: LineRenderable[] = [];
  for (const system of systems) {
    addDuctElements(renderables, system.supply_ducting, "duct-supply");
    addDuctElements(renderables, system.exhaust_ducting, "duct-exhaust");
  }
  return renderables;
}

function addDuctElements(
  renderables: LineRenderable[],
  elements: DuctElementModelData[],
  lineStyle: "duct-supply" | "duct-exhaust",
): void {
  for (const element of elements) {
    for (const [segmentKey, segment] of Object.entries(element.segments)) {
      const id = `duct:${element.identifier}:${segmentKey}`;
      const points = pointsFromLineSegment(segment.geometry);
      renderables.push({
        id,
        lens: "ventilation",
        kind: "line",
        points,
        lineStyle,
        meta: {
          id,
          type: "ductSegmentLine",
          identifier: segment.identifier || segmentKey,
          display_name: element.display_name,
          face_type: "Duct",
          boundary_condition: null,
          area: null,
          properties: {},
          vertices: points,
          duct_type: element.duct_type,
          diameter_m: segment.diameter,
          insulation_thickness_m: segment.insulation_thickness,
          insulation_conductivity: segment.insulation_conductivity,
          insulation_reflective: segment.insulation_reflective,
        },
      });
    }
  }
}

function pipeRenderables(systems: HotWaterSystemModelData[]): LineRenderable[] {
  const renderables: LineRenderable[] = [];
  for (const system of systems) {
    for (const trunk of Object.values(system.distribution_piping)) {
      addPipeElement(renderables, trunk.pipe_element, "distribution");
      for (const branch of Object.values(trunk.branches)) {
        addPipeElement(renderables, branch.pipe_element, "distribution");
        for (const fixture of Object.values(branch.fixtures)) {
          addPipeElement(renderables, fixture, "distribution");
        }
      }
    }
    for (const recirc of Object.values(system.recirc_piping)) {
      addPipeElement(renderables, recirc, "recirc");
    }
  }
  return renderables;
}

function shadeRenderables(groups: ShadeGroupModelData[]): ShadeRenderable[] {
  // Collect every shade's geometry under its display_name (insertion order kept).
  // display_name IS the group identity here (PRD §7 / D-7), so shades that share
  // one merge into a single renderable — by design, not a collision bug.
  const byName = new Map<string, BufferGeometry[]>();
  for (const group of groups) {
    for (const shade of group.shades) {
      const built = geometryFromFace3D(shade.geometry);
      if (!built) continue;
      const geometries = byName.get(shade.display_name);
      if (geometries) geometries.push(built.geometry);
      else byName.set(shade.display_name, [built.geometry]);
    }
  }

  const renderables: ShadeRenderable[] = [];
  for (const [displayName, geometries] of byName) {
    const geometry = mergeRenderableGeometries([{ geometries }]).geometry;
    const edges = mergeEdges([{ geometries }], EDGE_THRESHOLD_DEGREES);
    // The per-shade geometries are scratch — their data is now in the merged
    // buffers, so free them (they never enter `model.objects`).
    for (const source of geometries) source.dispose();
    renderables.push({ id: `shade:${displayName}`, displayName, geometry, edges });
  }
  return renderables;
}

function addPipeElement(
  renderables: LineRenderable[],
  element: PipeElementModelData,
  pipeKind: "distribution" | "recirc",
): void {
  for (const [segmentKey, segment] of Object.entries(element.segments)) {
    const id = `pipe:${pipeKind}:${element.identifier}:${segmentKey}`;
    const points = pointsFromLineSegment(segment.geometry);
    renderables.push({
      id,
      lens: "hot-water",
      kind: "line",
      points,
      lineStyle: pipeKind === "distribution" ? "pipe-distribution" : "pipe-recirc",
      meta: {
        id,
        type: "pipeSegmentLine",
        identifier: element.identifier,
        display_name: element.display_name,
        face_type: "Pipe",
        boundary_condition: null,
        area: null,
        properties: {},
        vertices: points,
        diameter_mm: segment.diameter_mm,
        insulation_thickness_mm: segment.insulation_thickness_mm,
        insulation_conductivity: segment.insulation_conductivity,
        insulation_reflective: segment.insulation_reflective,
        insulation_quality: segment.insulation_quality,
        daily_period: segment.daily_period,
        water_temp_c: segment.water_temp_c,
        material_value: segment.material_value,
        length: segment.length,
        pipe_kind: pipeKind,
      },
    });
  }
}

function pointsFromLineSegment(
  segment: LineSegment3D,
): [[number, number, number], [number, number, number]] {
  const [px, py, pz] = segment.p;
  const [vx, vy, vz] = segment.v;
  return [
    [px, py, pz],
    [px + vx, py + vy, pz + vz],
  ];
}

export function disposeBuildingModel(model: BuildingModel): void {
  for (const object of model.objects) {
    if (object.kind === "mesh") {
      for (const geometry of object.geometries) {
        geometry.dispose();
      }
    }
  }
  for (const shade of model.shadeObjects) {
    shade.geometry.dispose();
    shade.edges.dispose();
  }
  model.ghost.geometry.dispose();
  model.ghost.edges.dispose();
}

function countObjects(objects: ModelRenderable[]): ModelObjectCounts {
  return objects.reduce((counts, object) => {
    counts[object.meta.type] = (counts[object.meta.type] ?? 0) + 1;
    return counts;
  }, emptyModelObjectCounts());
}

export function emptyModelObjectCounts(): ModelObjectCounts {
  return {
    faceMesh: 0,
    apertureMeshFace: 0,
    spaceGroup: 0,
    spaceFloorSegmentMeshFace: 0,
    ductSegmentLine: 0,
    pipeSegmentLine: 0,
  };
}

function lensAvailability(objects: ModelRenderable[]): LensAvailability {
  const hasBuilding = objects.some((object) => object.lens === "building");
  return Object.fromEntries(
    MODEL_VIEWER_LENS_IDS.map((lens) => [
      lens,
      lens === "site-sun" ? hasBuilding : objects.some((object) => object.lens === lens),
    ]),
  ) as LensAvailability;
}

function fallbackBounds(objects: ModelRenderable[]): Box3 {
  const bounds = new Box3();
  for (const object of objects) {
    if (object.kind === "line") {
      expandBoundsByPoints(bounds, object.points);
      continue;
    }
    for (const geometry of object.geometries) {
      const position = geometry.getAttribute("position");
      for (let index = 0; index < position.count; index += 1) {
        bounds.expandByPoint(
          new Vector3(position.getX(index), position.getY(index), position.getZ(index)),
        );
      }
    }
  }
  return bounds;
}

function expandBoundsByGeometries(bounds: Box3, geometries: BufferGeometry[]): void {
  for (const geometry of geometries) {
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      bounds.union(geometry.boundingBox);
    }
  }
}
