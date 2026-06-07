import { useCallback, useEffect, useRef, useState } from "react";
import {
  assignmentFromSegment,
  assignmentsEqual,
  pasteAssignmentCommand,
  segmentCanvasKey,
  type AssemblyCanvasPaintController,
  type AssemblyCanvasPaintMode,
  type LastPaintAssignment,
  type PickedSegmentAssignment,
} from "../canvas-paint";
import type { Assembly, AssemblyLayer, AssemblySegment, EnvelopeCommand } from "../types";

type ApplyCommand = (command: EnvelopeCommand) => Promise<boolean>;

/**
 * Owns the paint-bucket / eyedropper state machine.
 *
 * `inFlightRef` coexists with the outer `applyCommand` in-flight guard because
 * `applyCommand` is also invoked from non-paint sources (dialogs, header
 * rename, toolbar flips). Scoping a second ref to paint-originated commands
 * prevents a rapid-click paint loop from blocking unrelated dispatches.
 */
export function usePaintMode(args: {
  canEdit: boolean;
  activeAssembly: Assembly | null;
  applyCommand: ApplyCommand;
  commandPending: boolean;
}): AssemblyCanvasPaintController {
  const { canEdit, activeAssembly, applyCommand, commandPending } = args;
  const [mode, setMode] = useState<AssemblyCanvasPaintMode>("idle");
  const [pickedAssignment, setPickedAssignment] = useState<PickedSegmentAssignment | null>(null);
  const [lastPaint, setLastPaint] = useState<LastPaintAssignment | null>(null);
  const [pastePulseKey, setPastePulseKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const clear = useCallback(() => {
    setMode("idle");
    setPickedAssignment(null);
  }, []);

  useEffect(() => {
    if (!canEdit) clear();
  }, [canEdit, clear]);

  useEffect(() => {
    clear();
    setLastPaint(null);
  }, [activeAssembly?.id, clear]);

  useEffect(() => {
    if (mode === "idle") return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clear();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, clear]);

  useEffect(() => {
    if (!pastePulseKey) return;
    const timeoutId = window.setTimeout(() => setPastePulseKey(null), 600);
    return () => window.clearTimeout(timeoutId);
  }, [pastePulseKey]);

  const startPicking = useCallback(() => {
    if (!canEdit) return;
    setPickedAssignment(null);
    setMode("picking");
  }, [canEdit]);

  const startPasting = useCallback(() => {
    if (!canEdit || !pickedAssignment) return;
    setMode("pasting");
  }, [canEdit, pickedAssignment]);

  const pickSegment = useCallback(
    (layer: AssemblyLayer, segment: AssemblySegment) => {
      if (!canEdit) return;
      setPickedAssignment({
        ...assignmentFromSegment(segment),
        sourceLayerId: layer.id,
        sourceSegmentId: segment.id,
      });
      setMode("picked");
    },
    [canEdit],
  );

  const paintSegment = useCallback(
    async (layer: AssemblyLayer, segment: AssemblySegment): Promise<void> => {
      if (!canEdit || !activeAssembly || !pickedAssignment) return;
      if (inFlightRef.current || commandPending) return;
      const previous = assignmentFromSegment(segment);
      if (assignmentsEqual(previous, pickedAssignment)) return;
      inFlightRef.current = true;
      const success = await applyCommand(
        pasteAssignmentCommand({
          assemblyId: activeAssembly.id,
          layerId: layer.id,
          segmentId: segment.id,
          assignment: pickedAssignment,
        }),
      );
      inFlightRef.current = false;
      if (!success) return;
      setLastPaint({ layerId: layer.id, segmentId: segment.id, previous });
      setPastePulseKey(segmentCanvasKey(layer.id, segment.id));
    },
    [canEdit, activeAssembly, pickedAssignment, commandPending, applyCommand],
  );

  const undoLastPaint = useCallback(async (): Promise<void> => {
    if (!canEdit || !activeAssembly || !lastPaint) return;
    if (inFlightRef.current || commandPending) return;
    inFlightRef.current = true;
    const success = await applyCommand(
      pasteAssignmentCommand({
        assemblyId: activeAssembly.id,
        layerId: lastPaint.layerId,
        segmentId: lastPaint.segmentId,
        assignment: lastPaint.previous,
      }),
    );
    inFlightRef.current = false;
    if (!success) return;
    setPastePulseKey(segmentCanvasKey(lastPaint.layerId, lastPaint.segmentId));
    setLastPaint(null);
  }, [canEdit, activeAssembly, lastPaint, commandPending, applyCommand]);

  return {
    mode,
    pickedSourceKey: pickedAssignment
      ? segmentCanvasKey(pickedAssignment.sourceLayerId, pickedAssignment.sourceSegmentId)
      : null,
    pastePulseKey,
    canStartPasting: pickedAssignment !== null && !commandPending,
    canUndoPaint: lastPaint !== null && !commandPending,
    startPicking,
    startPasting,
    undoLastPaint: () => void undoLastPaint(),
    clear,
    pickSegment,
    paintSegment: (layer, segment) => void paintSegment(layer, segment),
  };
}
