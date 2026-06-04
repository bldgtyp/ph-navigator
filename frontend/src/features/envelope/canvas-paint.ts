import type { AssemblyLayer, AssemblySegment, EnvelopeCommand } from "./types";

export type AssemblyCanvasPaintMode = "idle" | "picking" | "picked" | "pasting";

export type SegmentAssignment = {
  project_material_id: string | null;
  is_continuous_insulation: boolean;
  steel_stud_spacing_mm: number | null;
};

export type PickedSegmentAssignment = SegmentAssignment & {
  sourceLayerId: string;
  sourceSegmentId: string;
};

export type LastPaintAssignment = {
  layerId: string;
  segmentId: string;
  previous: SegmentAssignment;
};

export type AssemblyCanvasPaintController = {
  mode: AssemblyCanvasPaintMode;
  pickedSourceKey: string | null;
  pastePulseKey: string | null;
  canStartPasting: boolean;
  canUndoPaint: boolean;
  startPicking: () => void;
  startPasting: () => void;
  undoLastPaint: () => void;
  clear: () => void;
  pickSegment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
  paintSegment: (layer: AssemblyLayer, segment: AssemblySegment) => void;
};

export function assignmentFromSegment(segment: AssemblySegment): SegmentAssignment {
  return {
    project_material_id: segment.project_material_id,
    is_continuous_insulation: segment.is_continuous_insulation,
    steel_stud_spacing_mm: segment.steel_stud_spacing_mm,
  };
}

export function assignmentsEqual(left: SegmentAssignment, right: SegmentAssignment): boolean {
  return (
    left.project_material_id === right.project_material_id &&
    left.is_continuous_insulation === right.is_continuous_insulation &&
    left.steel_stud_spacing_mm === right.steel_stud_spacing_mm
  );
}

export function segmentCanvasKey(layerId: string, segmentId: string): string {
  return `${layerId}:${segmentId}`;
}

export function pasteAssignmentCommand({
  assemblyId,
  layerId,
  segmentId,
  assignment,
}: {
  assemblyId: string;
  layerId: string;
  segmentId: string;
  assignment: SegmentAssignment;
}): Extract<EnvelopeCommand, { kind: "paste_assignment" }> {
  return {
    kind: "paste_assignment",
    assembly_id: assemblyId,
    layer_id: layerId,
    segment_id: segmentId,
    project_material_id: assignment.project_material_id,
    is_continuous_insulation: assignment.is_continuous_insulation,
    steel_stud_spacing_mm: assignment.steel_stud_spacing_mm,
  };
}
