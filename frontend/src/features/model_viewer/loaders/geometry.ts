import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import type { Face3D, Mesh3D } from "../types";

export type GeometryBuildResult = {
  geometry: BufferGeometry;
  vertices: [number, number, number][];
};

export function geometryFromFace3D(face: Face3D): GeometryBuildResult | null {
  const mesh = face.mesh ?? meshFromBoundary(face.boundary);
  if (!mesh) return null;

  const positions: number[] = [];
  for (const faceIndices of mesh.faces) {
    for (const triangle of triangulateFace(faceIndices)) {
      for (const index of triangle) {
        const vertex = mesh.vertices[index];
        if (!vertex) return null;
        positions.push(vertex[0], vertex[1], vertex[2]);
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return { geometry, vertices: uniqueVertices(mesh.vertices) };
}

function triangulateFace(indices: number[]): [number, number, number][] {
  const [a, b, c] = indices;
  if (a === undefined || b === undefined || c === undefined) {
    throw new Error("Model viewer mesh face must have at least three vertices.");
  }
  return indices.slice(1, -1).map((_, index) => [a, indices[index + 1]!, indices[index + 2]!]);
}

function meshFromBoundary(boundary: [number, number, number][]): Mesh3D | null {
  if (boundary.length < 3) return null;
  return {
    vertices: boundary,
    faces: boundary.slice(1, -1).map((_, index) => [0, index + 1, index + 2]),
  };
}

function uniqueVertices(vertices: [number, number, number][]): [number, number, number][] {
  const seen = new Set<string>();
  const unique: [number, number, number][] = [];
  for (const vertex of vertices) {
    const key = new Vector3(...vertex)
      .toArray()
      .map((value) => value.toFixed(7))
      .join(",");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(vertex);
    }
  }
  return unique;
}
