import { MEMBRANE_BAND_HEIGHT_MM } from "./canvas-constants";
import { layerWidthMm, orderedAssemblyLayers, orderedLayerSegments } from "./lib";
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
  // membranes it is the reserved band instead. Read `layer.thickness_mm` —
  // never this — when showing the user a dimension.
  heightMm: number;
  isMembrane: boolean;
  // This membrane *is* the assembly's air barrier, so its own rule carries the
  // designation and no separate face rule is drawn. Only ever true for a
  // membrane layer — see `airBarrierGeometry`.
  isAirBarrier: boolean;
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
  isAirBarrier: boolean;
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
 * given a fixed reserved band so a 0.15 mm WRB is visible — and clickable — at
 * any zoom. Because the substitution happens here, the y-stacking, the SVG,
 * and the overlay hit targets all agree without any of them knowing about
 * membranes. The layer's real `thickness_mm` is untouched on the model and
 * remains what the dimension column and Total Thickness report.
 */
export function buildAssemblyCanvasGeometry(
  assembly: Assembly,
  materialsById: ReadonlyMap<string, ProjectMaterial>,
): AssemblyCanvasGeometry {
  // One record per layer rather than two index-aligned arrays: both facts are
  // needed for every layer before the width is known, and keeping them together
  // removes the chance of the two drifting out of step.
  const orderedLayers = orderedAssemblyLayers(assembly);
  const layerFacts = orderedLayers.map((layer) => ({
    isMembrane: isMembraneLayer(layer, materialsById),
    widthMm: layerWidthMm(layer),
  }));
  const widthMm = assemblyWidthMm(layerFacts);

  const layers: AssemblyCanvasLayerGeometry[] = [];
  const segments: AssemblyCanvasSegmentGeometry[] = [];
  let yMm = 0;

  orderedLayers.forEach((layer, layerIndex) => {
    const facts = layerFacts[layerIndex] ?? { isMembrane: false, widthMm: 0 };
    const isMembrane = facts.isMembrane;
    const heightMm = isMembrane ? MEMBRANE_BAND_HEIGHT_MM : layer.thickness_mm;
    const isAirBarrier = isMembrane && assembly.air_barrier?.layer_id === layer.id;
    layers.push({ layer, yMm, heightMm, isMembrane, isAirBarrier });

    // A membrane spans whatever it is applied to, so it is stretched to the
    // assembly width rather than drawn at its stored segment width. Scaling
    // (rather than forcing a single full-width segment) also lays out a legacy
    // multi-segment membrane sensibly — documents predating the single-segment
    // rule still exist, and the thermal engine flags them separately.
    const scale = isMembrane && facts.widthMm > 0 ? widthMm / facts.widthMm : 1;

    let xMm = 0;
    orderedLayerSegments(layer).forEach((segment) => {
      const segmentWidthMm = segment.width_mm * scale;
      segments.push({
        layer,
        layerIndex,
        segment,
        xMm,
        yMm,
        widthMm: segmentWidthMm,
        heightMm,
        isMembrane,
        isAirBarrier,
      });
      xMm += segmentWidthMm;
    });

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
 * How wide the section is, in drawing millimetres.
 *
 * Only layers with a real width get a vote. A membrane is a continuous sheet
 * that takes the width of what it covers, so letting its stored segment width
 * count would strand the whole drawing at the old size the moment a real layer
 * is narrowed: the membrane rule, the air-barrier rule and the surface-film
 * lines all measure off this number, and the stage centres on it too.
 *
 * An assembly of nothing but membranes has no width of its own, so it falls
 * back to what those membranes carry rather than collapsing to nothing.
 *
 * This stays in the frontend, unlike `total_thickness_mm`, which moved to the
 * backend under the "calculations live in the backend" rule. The difference is
 * what the number *is*: total thickness is a fact about the building, reported
 * in the header and written into the PHPP export, and it moved precisely
 * because those two consumers had drifted apart. This is a viewBox dimension —
 * it feeds px/mm scaling, zoom-to-fit and hit-target sizing, is never shown as
 * a dimension, and is never sent back. Computing it server-side would put
 * SVG layout choices in the API response.
 */
function assemblyWidthMm(layerFacts: { isMembrane: boolean; widthMm: number }[]): number {
  const contentWidths = layerFacts
    .filter((facts) => !facts.isMembrane)
    .map((facts) => facts.widthMm);
  const candidates = contentWidths.some((width) => width > 0)
    ? contentWidths
    : layerFacts.map((facts) => facts.widthMm);
  return Math.max(1, ...candidates);
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
 *
 * A designated *membrane* gets no rule here: it is already drawn as a rule, so
 * a second one beside it would show one physical thing twice, a few pixels
 * apart, as if the sheet and its air barrier were different objects. The
 * membrane's own rule turns red instead (`isAirBarrier` on the geometry). The
 * face is genuinely meaningless at 0.15 mm — a sheet has no interior side
 * distinct from its exterior one — so nothing is lost by collapsing them.
 */
function airBarrierGeometry(
  assembly: Assembly,
  layers: AssemblyCanvasLayerGeometry[],
  widthMm: number,
): AssemblyCanvasAirBarrierGeometry | null {
  const designation = assembly.air_barrier;
  if (!designation) return null;
  const target = layers.find((entry) => entry.layer.id === designation.layer_id);
  if (!target || target.isMembrane) return null;

  const exteriorIsBelow = assembly.orientation === "last_layer_outside";
  const atLayerBottom = designation.face === (exteriorIsBelow ? "exterior" : "interior");
  return {
    layerId: designation.layer_id,
    face: designation.face,
    yMm: atLayerBottom ? target.yMm + target.heightMm : target.yMm,
    widthMm,
  };
}
