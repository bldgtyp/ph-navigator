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
  for (const type of ["faceMesh", "apertureMeshFace"] as const) {
    for (const state of states) {
      palette.set(materialKey(type, state), materialFor(type, state, tokens));
    }
  }
  return palette;
}

function materialFor(
  type: ModelObjectType,
  state: MaterialState,
  tokens: ViewerTokens,
): MeshStandardMaterial {
  const base = type === "apertureMeshFace" ? "#b9c8d5" : "#d8d1c6";
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
    opacity: type === "apertureMeshFace" ? 0.68 : 0.94,
    emissive,
    emissiveIntensity: state === "base" ? 0 : state === "hovered" ? 0.12 : 0.18,
  });
}

function cssVar(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

function mixColor(from: string, to: string, fraction: number): string {
  const source = new Color(from);
  source.lerp(new Color(to), fraction);
  return `#${source.getHexString()}`;
}
