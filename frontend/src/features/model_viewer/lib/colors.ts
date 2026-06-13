import { Color, MeshStandardMaterial } from "three";
import type { ModelObjectType } from "../types";

export type ViewerTokens = {
  highlight: string;
  highlightSoft: string;
};

export type MaterialState = "base" | "hovered" | "selected";

export const VIEWER_HIGHLIGHT_FALLBACK = "#E23489";
export const VIEWER_FACE_EDGE_COLOR = "#8b8177";
export const VIEWER_APERTURE_EDGE_COLOR = "#64717c";
export const VIEWER_GHOST_EDGE_COLOR = "#6d736f";
export const VIEWER_SPACE_EDGE_COLOR = "#6f7d72";
export const VIEWER_LINE_HOVER_COLOR = "#f0a8cb";
export const VIEWER_DUCT_SUPPLY_COLOR = "#2674d9";
export const VIEWER_DUCT_EXHAUST_COLOR = "#d94a3a";
export const VIEWER_PIPE_DISTRIBUTION_COLOR = "#9a4f1f";
export const VIEWER_PIPE_RECIRC_COLOR = "#d4952f";
export const VIEWER_SHADE_COLOR = "#a8aca7";
export const VIEWER_SHADE_EDGE_COLOR = "#7d837d";
export const VIEWER_SITE_COMPASS_COLOR = "#5f6760";
export const VIEWER_SUN_PATH_COLOR = "#d49b35";

export function resolveViewerTokens(root: HTMLElement = document.documentElement): ViewerTokens {
  const styles = getComputedStyle(root);
  const highlight = cssVar(styles, "--highlight") || VIEWER_HIGHLIGHT_FALLBACK;
  return {
    highlight,
    highlightSoft: cssVar(styles, "--highlight-light") || mixColor(highlight, "#ffffff", 0.58),
  };
}

export function materialKey(type: ModelObjectType, state: MaterialState): string {
  return `${type}:${state}`;
}

export function createBuildingMaterials(tokens: ViewerTokens): Map<string, MeshStandardMaterial> {
  const palette = new Map<string, MeshStandardMaterial>();
  const states: MaterialState[] = ["base", "hovered", "selected"];
  for (const type of [
    "faceMesh",
    "apertureMeshFace",
    "spaceGroup",
    "spaceFloorSegmentMeshFace",
  ] as const) {
    for (const state of states) {
      palette.set(materialKey(type, state), materialFor(type, state, tokens));
    }
  }
  return palette;
}

export function createGhostMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: "#d4d7d2",
    roughness: 0.82,
    transparent: true,
    opacity: 0.03,
    depthWrite: false,
  });
}

function materialFor(
  type: ModelObjectType,
  state: MaterialState,
  tokens: ViewerTokens,
): MeshStandardMaterial {
  const base = baseColor(type);
  const color =
    state === "base" ? base : state === "hovered" ? tokens.highlightSoft : tokens.highlight;
  const emissive =
    state === "selected"
      ? tokens.highlight
      : state === "hovered"
        ? tokens.highlightSoft
        : "#000000";
  return new MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0,
    transparent: true,
    opacity: baseOpacity(type),
    emissive,
    emissiveIntensity: state === "base" ? 0 : state === "hovered" ? 0.12 : 0.18,
  });
}

function baseOpacity(type: ModelObjectType): number {
  switch (type) {
    case "apertureMeshFace":
      return 0.68;
    case "spaceGroup":
      return 0.32;
    case "spaceFloorSegmentMeshFace":
      return 0.76;
    case "faceMesh":
    case "ductSegmentLine":
    case "pipeSegmentLine":
      return 0.94;
  }
}

function baseColor(type: ModelObjectType): string {
  switch (type) {
    case "apertureMeshFace":
      return "#b9c8d5";
    case "spaceGroup":
      return "#7aa58d";
    case "spaceFloorSegmentMeshFace":
      return "#c7a74c";
    case "faceMesh":
    case "ductSegmentLine":
    case "pipeSegmentLine":
      return "#d8d1c6";
  }
}

function cssVar(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

function mixColor(from: string, to: string, fraction: number): string {
  const source = new Color(from);
  source.lerp(new Color(to), fraction);
  return `#${source.getHexString()}`;
}
