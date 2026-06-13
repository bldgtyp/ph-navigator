import { Box3, BufferGeometry, Vector3 } from "three";
import { geometryFromFace3D } from "./geometry";
import type {
  ApertureModelData,
  CombinedModelData,
  FaceModelData,
  ModelObjectCounts,
  ModelObjectMeta,
} from "../types";

export type BuildingRenderable = {
  id: string;
  geometry: BufferGeometry;
  meta: ModelObjectMeta;
};

export type BuildingModel = {
  objects: BuildingRenderable[];
  metaById: Map<string, ModelObjectMeta>;
  bounds: Box3;
  objectCounts: ModelObjectCounts;
};

export function buildBuildingModel(data: CombinedModelData): BuildingModel {
  const objects: BuildingRenderable[] = [];
  const bounds = new Box3();

  for (const face of data.faces) {
    const renderable = renderableFromFace(face);
    if (renderable) {
      objects.push(renderable);
      expandBoundsByGeometry(bounds, renderable.geometry);
    }

    for (const aperture of face.apertures) {
      const apertureRenderable = renderableFromAperture(aperture);
      if (apertureRenderable) {
        objects.push(apertureRenderable);
        expandBoundsByGeometry(bounds, apertureRenderable.geometry);
      }
    }
  }

  const metaById = new Map(objects.map((object) => [object.id, object.meta]));
  return {
    objects,
    metaById,
    bounds: bounds.isEmpty() ? fallbackBounds(objects) : bounds,
    objectCounts: countObjects(objects),
  };
}

function renderableFromFace(face: FaceModelData): BuildingRenderable | null {
  const built = geometryFromFace3D(face.geometry);
  if (!built) return null;
  const id = `face:${face.identifier}`;
  return {
    id,
    geometry: built.geometry,
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
    geometry: built.geometry,
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

export function disposeBuildingModel(model: BuildingModel): void {
  for (const object of model.objects) {
    object.geometry.dispose();
  }
}

function countObjects(objects: BuildingRenderable[]): ModelObjectCounts {
  return objects.reduce<ModelObjectCounts>(
    (counts, object) => {
      counts[object.meta.type] = (counts[object.meta.type] ?? 0) + 1;
      return counts;
    },
    { faceMesh: 0, apertureMeshFace: 0 },
  );
}

function fallbackBounds(objects: BuildingRenderable[]): Box3 {
  const bounds = new Box3();
  for (const object of objects) {
    const position = object.geometry.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      bounds.expandByPoint(
        new Vector3(position.getX(index), position.getY(index), position.getZ(index)),
      );
    }
  }
  return bounds;
}

function expandBoundsByGeometry(bounds: Box3, geometry: BufferGeometry): void {
  geometry.computeBoundingBox();
  if (geometry.boundingBox) {
    bounds.union(geometry.boundingBox);
  }
}
