import { useEffect, useMemo } from "react";
import type { MeshBasicMaterial, MeshStandardMaterial } from "three";

export type ViewerMeshMaterial = MeshStandardMaterial | MeshBasicMaterial;

export function useOpacityMaterial(
  material: ViewerMeshMaterial,
  opacity: number,
): ViewerMeshMaterial {
  const faded = useMemo(() => {
    const clone = material.clone();
    clone.transparent = true;
    return clone;
  }, [material]);

  useEffect(() => {
    faded.opacity = material.opacity * opacity;
    faded.depthWrite = opacity >= 0.98;
    faded.needsUpdate = true;
  }, [faded, material.opacity, opacity]);

  useEffect(() => {
    return () => {
      faded.dispose();
    };
  }, [faded]);

  return faded;
}
