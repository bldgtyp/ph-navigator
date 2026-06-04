import type { Assembly, AssemblyLayer, AssemblySegment } from "./types";

export type AssemblyCanvasLayerGeometry = {
  layer: AssemblyLayer;
  yMm: number;
  heightMm: number;
};

export type AssemblyCanvasSegmentGeometry = {
  layer: AssemblyLayer;
  layerIndex: number;
  segment: AssemblySegment;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type AssemblyCanvasGeometry = {
  widthMm: number;
  heightMm: number;
  layers: AssemblyCanvasLayerGeometry[];
  segments: AssemblyCanvasSegmentGeometry[];
};

export function buildAssemblyCanvasGeometry(assembly: Assembly): AssemblyCanvasGeometry {
  const layers: AssemblyCanvasLayerGeometry[] = [];
  const segments: AssemblyCanvasSegmentGeometry[] = [];
  let yMm = 0;
  let widthMm = 1;

  assembly.layers.forEach((layer, layerIndex) => {
    layers.push({ layer, yMm, heightMm: layer.thickness_mm });

    let xMm = 0;
    layer.segments.forEach((segment) => {
      segments.push({
        layer,
        layerIndex,
        segment,
        xMm,
        yMm,
        widthMm: segment.width_mm,
        heightMm: layer.thickness_mm,
      });
      xMm += segment.width_mm;
    });

    widthMm = Math.max(widthMm, xMm);
    yMm += layer.thickness_mm;
  });

  return {
    widthMm,
    heightMm: Math.max(1, yMm),
    layers,
    segments,
  };
}
