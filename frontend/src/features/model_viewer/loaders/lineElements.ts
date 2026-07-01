import { elementIdForSegmentId } from "../lib/selection";
import type {
  CombinedModelData,
  DuctElementModelData,
  HotWaterSystemModelData,
  LineSegment3D,
  PipeElementModelData,
} from "../types";
import type { LineRenderable } from "./building";

export type ElementSummary = {
  id: string;
  kind: "ductElement" | "pipeElement";
  identifier: string;
  display_name: string;
  length: number;
  segmentIds: string[];
  ductType?: 1 | 2 | number;
  pipeKind?: "distribution" | "recirc";
};

export type LineElementOutput = {
  lines: LineRenderable[];
  elements: ElementSummary[];
};

export function ductRenderables(
  systems: CombinedModelData["ventilation_systems"],
): LineElementOutput {
  const output: LineElementOutput = { lines: [], elements: [] };
  for (const system of systems) {
    addDuctElements(output, system.supply_ducting, "duct-supply");
    addDuctElements(output, system.exhaust_ducting, "duct-exhaust");
  }
  return output;
}

function addDuctElements(
  output: LineElementOutput,
  elements: DuctElementModelData[],
  lineStyle: "duct-supply" | "duct-exhaust",
): void {
  for (const element of elements) {
    const segmentIds: string[] = [];
    // Source dict order is stable display order only; it is not a reliable
    // start-to-end physical path order across exported HBJSON fixtures.
    for (const [segmentKey, segment] of Object.entries(element.segments)) {
      const id = `duct:${element.identifier}:${segmentKey}`;
      segmentIds.push(id);
      const points = pointsFromLineSegment(segment.geometry);
      output.lines.push({
        id,
        lens: "ventilation",
        kind: "line",
        points,
        lineStyle,
        meta: {
          id,
          type: "ductSegmentLine",
          identifier: segment.identifier || segmentKey,
          display_name: element.display_name,
          face_type: "Duct",
          boundary_condition: null,
          area: null,
          properties: {},
          vertices: points,
          duct_type: element.duct_type,
          diameter_m: segment.diameter,
          length: segment.length,
          insulation_thickness_m: segment.insulation_thickness,
          insulation_conductivity: segment.insulation_conductivity,
          insulation_reflective: segment.insulation_reflective,
        },
      });
    }
    const id = segmentIds[0] ? elementIdForSegmentId(segmentIds[0]) : null;
    if (id) {
      output.elements.push({
        id,
        kind: "ductElement",
        identifier: element.identifier,
        display_name: element.display_name,
        length: element.length,
        segmentIds,
        ductType: element.duct_type,
      });
    }
  }
}

export function pipeRenderables(systems: HotWaterSystemModelData[]): LineElementOutput {
  const output: LineElementOutput = { lines: [], elements: [] };
  for (const system of systems) {
    for (const trunk of Object.values(system.distribution_piping)) {
      addPipeElement(output, trunk.pipe_element, "distribution");
      for (const branch of Object.values(trunk.branches)) {
        addPipeElement(output, branch.pipe_element, "distribution");
        for (const fixture of Object.values(branch.fixtures)) {
          addPipeElement(output, fixture, "distribution");
        }
      }
    }
    for (const recirc of Object.values(system.recirc_piping)) {
      addPipeElement(output, recirc, "recirc");
    }
  }
  return output;
}

function addPipeElement(
  output: LineElementOutput,
  element: PipeElementModelData,
  pipeKind: "distribution" | "recirc",
): void {
  const segmentIds: string[] = [];
  // Source dict order is stable display order only; it is not a reliable
  // start-to-end physical path order across exported HBJSON fixtures.
  for (const [segmentKey, segment] of Object.entries(element.segments)) {
    const id = `pipe:${pipeKind}:${element.identifier}:${segmentKey}`;
    segmentIds.push(id);
    const points = pointsFromLineSegment(segment.geometry);
    output.lines.push({
      id,
      lens: "hot-water",
      kind: "line",
      points,
      lineStyle: pipeKind === "distribution" ? "pipe-distribution" : "pipe-recirc",
      meta: {
        id,
        type: "pipeSegmentLine",
        identifier: element.identifier,
        display_name: element.display_name,
        face_type: "Pipe",
        boundary_condition: null,
        area: null,
        properties: {},
        vertices: points,
        diameter_mm: segment.diameter_mm,
        insulation_thickness_mm: segment.insulation_thickness_mm,
        insulation_conductivity: segment.insulation_conductivity,
        insulation_reflective: segment.insulation_reflective,
        insulation_quality: segment.insulation_quality,
        daily_period: segment.daily_period,
        water_temp_c: segment.water_temp_c,
        material_value: segment.material_value,
        length: segment.length,
        pipe_kind: pipeKind,
      },
    });
  }
  const id = segmentIds[0] ? elementIdForSegmentId(segmentIds[0]) : null;
  if (id) {
    output.elements.push({
      id,
      kind: "pipeElement",
      identifier: element.identifier,
      display_name: element.display_name,
      length: element.length,
      segmentIds,
      pipeKind,
    });
  }
}

function pointsFromLineSegment(
  segment: LineSegment3D,
): [[number, number, number], [number, number, number]] {
  const [px, py, pz] = segment.p;
  const [vx, vy, vz] = segment.v;
  return [
    [px, py, pz],
    [px + vx, py + vy, pz + vz],
  ];
}
