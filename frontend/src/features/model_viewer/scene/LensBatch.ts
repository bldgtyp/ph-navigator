import { BatchedMesh, Color, LineBasicMaterial, LineSegments } from "three";
import type { Material, MeshStandardMaterial } from "three";
import {
  createBatchMaterials,
  EDGE_THRESHOLD_DEGREES,
  isTransparentType,
  VIEWER_FACE_EDGE_COLOR,
  viewerBaseColor,
  viewerBaseOpacity,
} from "../lib/colors";
import { colorForThemedObject } from "../lib/themes";
import type { BuildingRenderable } from "../loaders/building";
import { mergeEdges } from "../loaders/merge";
import type { ModelObjectMeta, ModelObjectType, ModelViewerLens, ModelViewerTheme } from "../types";

/**
 * The batched substrate for one lens (Phase 03, D-1). A lens's ~thousands of
 * per-object meshes collapse into at most two `THREE.BatchedMesh` draw calls —
 * one opaque batch (faces) and one transparent batch (apertures/glass) — plus
 * one merged edge `LineSegments`. Per-object color, selection highlight, and
 * picking are first-class per-instance operations on `BatchedMesh`
 * (`setColorAt`, raycast → `batchId`), so the interactions V2 does most stay
 * O(objects) buffer writes with zero per-frame cost.
 *
 * Geometries are already in world space (see `loaders/geometry.ts`), so each
 * instance keeps the identity matrix `addInstance` assigns by default.
 */

/** Locates a single object's instance within its batch (for color/highlight). */
export type BatchLocation = { mesh: BatchedMesh; instanceId: number };

/**
 * The per-instance resting color one object shows, as a hex string for
 * `setColorAt`: its color-by-theme color, falling back to the shaded base.
 * Hover/selection highlight is drawn on top by the flat `HighlightOverlay`, so
 * the batch only ever paints resting color. Pure — object meta + lens/theme.
 */
export function resolveInstanceColor(
  meta: ModelObjectMeta,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): string {
  if (theme !== "shaded") {
    const themed = colorForThemedObject(meta, lens, theme);
    if (themed) return themed.color;
  }
  return viewerBaseColor(meta.type);
}

export type LensBatch = {
  /** Opaque objects (faces); null when the lens has none. */
  opaqueMesh: BatchedMesh | null;
  /** Transparent objects (apertures here; spaces in Phase 04), kept in their own
   *  batch so opaque early-Z is preserved; null when the lens has none. */
  transparentMesh: BatchedMesh | null;
  /** All non-null batches, for raycasting and iteration. */
  meshes: BatchedMesh[];
  /** One merged edge line for the whole lens. */
  edges: LineSegments;
  /** batch instance → object id (picking: raycast `batchId` → object). */
  idForBatch: Map<BatchedMesh, Map<number, string>>;
  /** object id → its batch instances (theming/highlight: object → `setColorAt`).
   *  An array because one object can own several geometries (e.g. a space's
   *  volumes), all of which recolor together. */
  batchForId: Map<string, BatchLocation[]>;
  /** Scale every material to `progress`×its base opacity for the lens fade-in
   *  (D-8). `progress < 1` forces blending (`transparent`, no depth write);
   *  `progress >= 1` restores each material's captured base state (opaque early-Z).
   *  The batch owns this because it owns the materials. */
  setOpacity(progress: number): void;
  dispose(): void;
};

/** A material plus the base render-state to restore once the fade settles. */
type FadeMaterial = {
  material: Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

function captureFade(material: Material): FadeMaterial {
  return {
    material,
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
  };
}

// Opaque vs transparent batch, keyed on the shaded opacity of the object's type
// (Phase-01 semantics). Apertures here; spaces/floor reuse this in Phase 04.
function isTransparent(object: BuildingRenderable): boolean {
  return isTransparentType(object.meta.type);
}

/**
 * Build the batched substrate for a set of building renderables. Each object's
 * geometry is added once and seeded to its "shaded" base color; callers recolor
 * via `setColorAt` for themes/highlight. The batch owns its materials: the
 * transparent batch's opacity is the opacity of its (single) transparent type —
 * apertures 0.68, space volumes 0.32 — derived here, next to the opaque/
 * transparent split, and freed by `dispose()`.
 */
export function buildLensBatch(renderables: BuildingRenderable[]): LensBatch {
  const idForBatch = new Map<BatchedMesh, Map<number, string>>();
  const batchForId = new Map<string, BatchLocation[]>();

  const opaque = renderables.filter((object) => !isTransparent(object));
  const transparent = renderables.filter(isTransparent);
  const transparentType = transparent[0]?.meta.type;
  const materials = createBatchMaterials(
    transparentType ? viewerBaseOpacity(transparentType) : undefined,
  );

  const opaqueMesh = buildBatch(opaque, materials.opaque, idForBatch, batchForId);
  const transparentMesh = buildBatch(transparent, materials.transparent, idForBatch, batchForId);

  const edgeMaterial = new LineBasicMaterial({ color: VIEWER_FACE_EDGE_COLOR });
  const edges = new LineSegments(mergeEdges(renderables, EDGE_THRESHOLD_DEGREES), edgeMaterial);
  edges.raycast = () => null;

  const meshes = [opaqueMesh, transparentMesh].filter((mesh): mesh is BatchedMesh => mesh !== null);

  // Snapshot the rendered materials' base state for the lens fade-in (D-8).
  const fadeMaterials = [
    ...(opaqueMesh ? [materials.opaque] : []),
    ...(transparentMesh ? [materials.transparent] : []),
    edgeMaterial,
  ].map(captureFade);

  let disposed = false;
  return {
    opaqueMesh,
    transparentMesh,
    meshes,
    edges,
    idForBatch,
    batchForId,
    setOpacity(progress) {
      const settled = progress >= 1;
      for (const target of fadeMaterials) {
        target.material.opacity = settled ? target.opacity : target.opacity * progress;
        const transparent = settled ? target.transparent : true;
        if (target.material.transparent !== transparent) {
          target.material.transparent = transparent;
          target.material.needsUpdate = true; // toggling `transparent` recompiles
        }
        target.material.depthWrite = settled ? target.depthWrite : false;
      }
    },
    dispose() {
      if (disposed) return; // idempotent — React StrictMode double-invokes cleanup
      disposed = true;
      // Hide before freeing GPU buffers: the primitive is rendered from React
      // state that lags this dispose, so the object can stay in the scene for a
      // frame after its buffers are freed. An invisible object is skipped by the
      // renderer, so its now-null textures are never read (CR3).
      for (const mesh of meshes) {
        mesh.visible = false;
        mesh.geometry.dispose();
        mesh.dispose();
      }
      edges.visible = false;
      edges.geometry.dispose();
      edges.material.dispose();
      materials.opaque.dispose();
      materials.transparent.dispose();
    },
  };
}

function buildBatch(
  objects: BuildingRenderable[],
  material: MeshStandardMaterial,
  idForBatch: Map<BatchedMesh, Map<number, string>>,
  batchForId: Map<string, BatchLocation[]>,
): BatchedMesh | null {
  if (objects.length === 0) return null;

  let vertexCount = 0;
  let instanceCount = 0;
  for (const object of objects) {
    for (const geometry of object.geometries) {
      vertexCount += geometry.getAttribute("position").count;
      instanceCount += 1;
    }
  }

  // Non-indexed geometry → no index buffer (maxIndexCount 0).
  const mesh = new BatchedMesh(instanceCount, vertexCount, 0, material);
  // Sun-study shadows (PRD §5.2): the substrate casts and receives. Set at
  // build so engaging never churns materials — the flags cost nothing until a
  // shadow-casting light exists (phase-02 spike), which only sun study adds.
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const ids = new Map<number, string>();
  // Parse each type's shaded base color once; most objects share a few types.
  const colorByType = new Map<ModelObjectType, Color>();
  for (const object of objects) {
    let baseColor = colorByType.get(object.meta.type);
    if (!baseColor) {
      baseColor = new Color(viewerBaseColor(object.meta.type));
      colorByType.set(object.meta.type, baseColor);
    }
    // One object can own several geometries (a space's volumes); each becomes an
    // instance, and all of them share the object's id so they recolor together.
    const locations: BatchLocation[] = [];
    for (const geometry of object.geometries) {
      const geometryId = mesh.addGeometry(geometry);
      const instanceId = mesh.addInstance(geometryId);
      mesh.setColorAt(instanceId, baseColor);
      ids.set(instanceId, object.id);
      locations.push({ mesh, instanceId });
    }
    batchForId.set(object.id, locations);
  }
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  idForBatch.set(mesh, ids);
  return mesh;
}
