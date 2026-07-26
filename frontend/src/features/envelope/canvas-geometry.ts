import { MEMBRANE_DISPLAY_THICKNESS_MM } from "./canvas-constants";
import { isMembraneLayer } from "./membranes";
import type {
  Assembly,
  AssemblyFace,
  AssemblyLayer,
  AssemblySegment,
  ProjectMaterial,
} from "./types";

export type AssemblyCanvasLayerGeometry = {
  layer: AssemblyLayer;
  yMm: number;
  // Drawn height. Equals `layer.thickness_mm` for ordinary layers; for
  // membranes it is the fixed nominal hairline instead. Read
  // `layer.thickness_mm` — never this — when showing the user a dimension.
  heightMm: number;
  isMembrane: boolean;
  // How far the clickable box may reach beyond the drawn band, above and
  // below, before it would collide with an adjacent membrane's box. Ordinary
  // neighbours are thick enough to donate freely; two adjacent membranes each
  // take at most half of the other's band, so they meet and never overlap.
  hitRoomAboveMm: number;
  hitRoomBelowMm: number;
};

export type AssemblyCanvasSegmentGeometry = {
  layer: AssemblyLayer;
  layerIndex: number;
  segment: AssemblySegment;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  isMembrane: boolean;
  hitRoomAboveMm: number;
  hitRoomBelowMm: number;
};

export type AssemblyCanvasAirBarrierGeometry = {
  layerId: string;
  face: AssemblyFace;
  // Y of the designated face itself, in drawing millimetres — the top edge of
  // the layer for its interior face, the bottom edge for its exterior one.
  yMm: number;
  widthMm: number;
};

export type AssemblyCanvasGeometry = {
  widthMm: number;
  heightMm: number;
  layers: AssemblyCanvasLayerGeometry[];
  segments: AssemblyCanvasSegmentGeometry[];
  // Null when the assembly designates no air barrier.
  airBarrier: AssemblyCanvasAirBarrierGeometry | null;
};

/**
 * Lay the section out in millimetres, top to bottom.
 *
 * Heights are *drawing* millimetres, not physical ones: a membrane layer is
 * given a fixed nominal thickness so a 0.15 mm WRB is visible at any zoom.
 * Because the substitution happens here, the y-stacking, the SVG rects, and
 * the overlay hit targets all agree without any of them knowing about
 * membranes. The layer's real `thickness_mm` is untouched on the model and
 * remains what the dimension column and Total Thickness report.
 */
export function buildAssemblyCanvasGeometry(
  assembly: Assembly,
  materialsById: ReadonlyMap<string, ProjectMaterial>,
): AssemblyCanvasGeometry {
  const layers: AssemblyCanvasLayerGeometry[] = [];
  const segments: AssemblyCanvasSegmentGeometry[] = [];
  const membraneFlags = assembly.layers.map((layer) => isMembraneLayer(layer, materialsById));
  let yMm = 0;
  let widthMm = 1;

  assembly.layers.forEach((layer, layerIndex) => {
    const isMembrane = membraneFlags[layerIndex] ?? false;
    const heightMm = isMembrane ? MEMBRANE_DISPLAY_THICKNESS_MM : layer.thickness_mm;
    const hitRoomAboveMm = hitRoomToward(membraneFlags[layerIndex - 1]);
    const hitRoomBelowMm = hitRoomToward(membraneFlags[layerIndex + 1]);
    layers.push({ layer, yMm, heightMm, isMembrane, hitRoomAboveMm, hitRoomBelowMm });

    let xMm = 0;
    layer.segments.forEach((segment) => {
      segments.push({
        layer,
        layerIndex,
        segment,
        xMm,
        yMm,
        widthMm: segment.width_mm,
        heightMm,
        isMembrane,
        hitRoomAboveMm,
        hitRoomBelowMm,
      });
      xMm += segment.width_mm;
    });

    widthMm = Math.max(widthMm, xMm);
    yMm += heightMm;
  });

  return {
    widthMm,
    heightMm: Math.max(1, yMm),
    layers,
    segments,
    airBarrier: airBarrierGeometry(assembly, layers, widthMm),
  };
}

/**
 * Place the air-barrier rule on the designated face.
 *
 * "Interior" and "exterior" are orientation-relative, not top/bottom: the
 * section draws layers in stored order, and `last_layer_outside` means the
 * bottom of the drawing faces outdoors. So the exterior face of a layer is its
 * *bottom* edge in that orientation and its *top* edge in the other. Getting
 * this backwards would draw the line on the wrong side of the layer — a
 * silently wrong drawing, which is worse than no drawing.
 */
function airBarrierGeometry(
  assembly: Assembly,
  layers: AssemblyCanvasLayerGeometry[],
  widthMm: number,
): AssemblyCanvasAirBarrierGeometry | null {
  const designation = assembly.air_barrier;
  if (!designation) return null;
  const target = layers.find((entry) => entry.layer.id === designation.layer_id);
  if (!target) return null;

  const exteriorIsBelow = assembly.orientation === "last_layer_outside";
  const atLayerBottom = designation.face === (exteriorIsBelow ? "exterior" : "interior");
  return {
    layerId: designation.layer_id,
    face: designation.face,
    yMm: atLayerBottom ? target.yMm + target.heightMm : target.yMm,
    widthMm,
  };
}

/**
 * How far a membrane's clickable box may reach toward one neighbour.
 *
 * A membrane neighbour is itself a hairline that needs every pixel of its own
 * band, so neither may cross the edge they share — otherwise the two boxes
 * overlap, tie on `z-index`, and paint order alone decides which one a click
 * selects. An ordinary layer (or the edge of the section) has room to spare.
 *
 * Three membranes in a row is the degenerate case: the middle one is boxed in
 * on both sides and gets only its own band. That is the honest answer — the
 * space is genuinely not there — and zooming in grows every band, so the user
 * has a way through.
 */
function hitRoomToward(neighbourIsMembrane: boolean | undefined): number {
  return neighbourIsMembrane === true ? 0 : Number.POSITIVE_INFINITY;
}
