import { DoubleSide, LineBasicMaterial, MeshBasicMaterial, MeshStandardMaterial } from "three";
import type { ModelObjectType } from "../types";
import { mixHexColor } from "./colorMath";
import {
  VIEWER_GHOST_EDGE_COLOR,
  VIEWER_HIGHLIGHT_FALLBACK,
  VIEWER_SHADE_COLOR,
  VIEWER_SHADE_EDGE_COLOR,
} from "./colorTokens";
export {
  VIEWER_DUCT_EXHAUST_COLOR,
  VIEWER_DUCT_SUPPLY_COLOR,
  VIEWER_FACE_EDGE_COLOR,
  VIEWER_FILTER_DIM_LINE_COLOR,
  VIEWER_FILTER_WIREFRAME_COLOR,
  VIEWER_GHOST_EDGE_COLOR,
  VIEWER_HIGHLIGHT_FALLBACK,
  VIEWER_LINE_HOVER_COLOR,
  VIEWER_PIPE_DISTRIBUTION_COLOR,
  VIEWER_PIPE_RECIRC_COLOR,
  VIEWER_SHADE_COLOR,
  VIEWER_SHADE_EDGE_COLOR,
  VIEWER_SITE_COMPASS_COLOR,
  VIEWER_SUN_PATH_COLOR,
} from "./colorTokens";

export type ViewerTokens = {
  highlight: string;
  highlightSoft: string;
};

export type MaterialState = "base" | "hovered" | "selected";

/**
 * Crease angle (degrees) above which an edge line is drawn. Shared by the merged
 * lens edges (`LensBatch`) and the merged ghost outline (`buildBuildingModel`)
 * so the two edge looks stay identical.
 */
export const EDGE_THRESHOLD_DEGREES = 12;

export function resolveViewerTokens(root: HTMLElement = document.documentElement): ViewerTokens {
  const styles = getComputedStyle(root);
  const highlight = cssVar(styles, "--highlight") || VIEWER_HIGHLIGHT_FALLBACK;
  return {
    highlight,
    highlightSoft: cssVar(styles, "--highlight-light") || mixHexColor(highlight, "#ffffff", 0.58),
  };
}

/** Fill + edge materials for the merged ghost; an atomic pair, created together. */
export type GhostMaterials = { fill: MeshStandardMaterial; edge: LineBasicMaterial };

export function createGhostMaterials(): GhostMaterials {
  return {
    fill: new MeshStandardMaterial({
      color: "#d4d7d2",
      roughness: 0.82,
      transparent: true,
      opacity: 0.03,
      depthWrite: false,
    }),
    edge: new LineBasicMaterial({ color: VIEWER_GHOST_EDGE_COLOR }),
  };
}

/** Fill + edge materials for the merged site-sun shade groups; an atomic pair. */
export type ShadeMaterials = { fill: MeshBasicMaterial; edge: LineBasicMaterial };

export function createShadeMaterials(): ShadeMaterials {
  return {
    fill: new MeshBasicMaterial({
      color: VIEWER_SHADE_COLOR,
      side: DoubleSide,
      transparent: true,
      opacity: 0.48,
    }),
    edge: new LineBasicMaterial({ color: VIEWER_SHADE_EDGE_COLOR }),
  };
}

/** Flat, unlit highlight materials for the hover/selection overlay (drawn on top
 *  of the lit batch so the highlight reads as a crisp flat colour regardless of
 *  lighting). Selected takes the full highlight token, hover the soft one — the
 *  single highlight-colour contract. Polygon-offset draws them just in front of
 *  the coplanar face; an atomic pair, created + disposed together. */
export type HighlightMaterials = { selected: MeshBasicMaterial; hovered: MeshBasicMaterial };

export function createHighlightMaterials(tokens: ViewerTokens): HighlightMaterials {
  const make = (color: string) =>
    new MeshBasicMaterial({
      color,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  return { selected: make(tokens.highlight), hovered: make(tokens.highlightSoft) };
}

/**
 * Batch materials for the BatchedMesh lens substrate (Phase 03). Each batch
 * uses one neutral-white material; per-object hue (shaded base, color-by theme,
 * or highlight) is driven entirely by the BatchedMesh per-instance color buffer
 * (`setColorAt`), so the whole lens is one or two draw calls. The partition is
 * opaque vs transparent (not glass-specific): the building lens's transparent
 * batch is apertures (0.68); Phase 04 lenses set their own transparent opacity.
 */
export type BatchMaterials = { opaque: MeshStandardMaterial; transparent: MeshStandardMaterial };

export function createBatchMaterials(
  transparentOpacity = baseOpacity("apertureMeshFace"),
): BatchMaterials {
  return {
    opaque: new MeshStandardMaterial({ color: "#ffffff", ...SHADED_SURFACE }),
    transparent: new MeshStandardMaterial({
      color: "#ffffff",
      ...SHADED_SURFACE,
      transparent: true,
      opacity: transparentOpacity,
      depthWrite: false,
    }),
  };
}

/** Per-type "shaded" base color — the default per-instance color of a batch. */
export function viewerBaseColor(type: ModelObjectType): string {
  return baseColor(type);
}

/** Per-type shaded opacity — the opacity a lens's transparent batch should use. */
export function viewerBaseOpacity(type: ModelObjectType): number {
  return baseOpacity(type);
}

/** A type is rendered in the transparent batch when its shaded opacity is < 1. */
export function isTransparentType(type: ModelObjectType): boolean {
  return baseOpacity(type) < 1;
}

// Shared shaded-surface PBR params for the batch materials (one knob for the
// whole lit look). Opaque batch writes depth (early-Z); the transparent batch
// blends without writing depth — see `createBatchMaterials`.
const SHADED_SURFACE = { roughness: 0.78, metalness: 0 } as const;

function baseOpacity(type: ModelObjectType): number {
  switch (type) {
    case "apertureMeshFace":
      return 0.85;
    case "spaceGroup":
      return 0.32;
    case "faceMesh":
    case "spaceFloorSegmentMeshFace":
    case "ductSegmentLine":
    case "pipeSegmentLine":
      return 1;
  }
}

function baseColor(type: ModelObjectType): string {
  switch (type) {
    case "apertureMeshFace":
      return "#6b7883";
    case "spaceGroup":
      return "#7aa58d";
    case "spaceFloorSegmentMeshFace":
      return "#c7a74c";
    case "faceMesh":
      // Near-white study-model surface (rendering-style refactor) — a neutral
      // light grey (no warm bias) so it reads as clean cool-white under the soft
      // dome, like Spacio. Ducts/pipes keep the warm line color below.
      return "#ececec";
    case "ductSegmentLine":
    case "pipeSegmentLine":
      return "#d8d1c6";
  }
}

function cssVar(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}
