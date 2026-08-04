// Centralises the Phase 08 paste / undo handler chain so the canvas
// container doesn't bloat past the 500-line cap. The state machine,
// undo stack, and dispatch all live in the Zustand store + the route
// layer's ``onPasteAssignment`` callback; this hook is the glue that
// reads the source assignment, dispatches the wire command, records
// the prior state for undo, and fires the 600 ms pulse on success.

import { useCallback, useState } from "react";
import { useApertureBuilderStore, type PickedAssignment } from "../store/builder-store";
import type {
  ApertureAssignmentSnapshot,
  ApertureElement,
  ApertureElementFrames,
  ApertureElementInstalls,
  ApertureOperation,
  FrameRef,
  GlazingRef,
} from "../types";

export type PasteTargetSnapshot = {
  id: string;
  kind: ApertureElement["kind"];
  operation: ApertureOperation | null;
  glazing: GlazingRef | null;
  frames: ApertureElementFrames;
  installs: ApertureElementInstalls;
};

const PASTE_PULSE_MS = 600;

export type UsePickPasteHandlersArgs = {
  apertureId: string;
  onPasteAssignment?: (
    sourceElementId: string,
    targetElementIds: string[],
    payload: PickedAssignment,
  ) => Promise<boolean> | boolean;
  onRestoreAssignment?: (
    targetElementId: string,
    prior: ApertureAssignmentSnapshot,
  ) => Promise<boolean> | boolean;
};

export function usePickPasteHandlers({
  apertureId,
  onPasteAssignment,
  onRestoreAssignment,
}: UsePickPasteHandlersArgs) {
  const pickPasteMode = useApertureBuilderStore((s) => s.pickPasteMode);
  const pickedAssignment = useApertureBuilderStore((s) => s.pickedAssignment);
  const pickPasteAction = useApertureBuilderStore((s) => s.pickPasteAction);
  const pushUndoEntry = useApertureBuilderStore((s) => s.pushUndoEntry);
  const popUndoEntry = useApertureBuilderStore((s) => s.popUndoEntry);
  const undoDepth = useApertureBuilderStore((s) => s.undoStacksByAperture[apertureId]?.length ?? 0);
  const [flashTargetId, setFlashTargetId] = useState<string | null>(null);

  const flash = useCallback((id: string) => {
    setFlashTargetId(id);
    window.setTimeout(() => setFlashTargetId(null), PASTE_PULSE_MS);
  }, []);

  const pasteOnto = useCallback(
    async (target: PasteTargetSnapshot) => {
      if (pickPasteMode !== "pasting" || !pickedAssignment) return;
      if (!onPasteAssignment) return;
      if (target.kind !== "glazed") return;
      if (target.id === pickedAssignment.source_element_id) return;
      try {
        const prior = assignmentSnapshot(target);
        const succeeded = await onPasteAssignment(
          pickedAssignment.source_element_id,
          [target.id],
          pickedAssignment,
        );
        if (!succeeded) return;
        pushUndoEntry(apertureId, { target_element_id: target.id, prior });
        flash(target.id);
      } catch {
        // Backend rejected; leave undo stack + mode untouched.
      }
    },
    [apertureId, flash, onPasteAssignment, pickPasteMode, pickedAssignment, pushUndoEntry],
  );

  const undoLastPaste = useCallback(async () => {
    const entry = popUndoEntry(apertureId);
    if (!entry) return;
    try {
      if (!onRestoreAssignment) {
        pushUndoEntry(apertureId, entry);
        return;
      }
      const succeeded = await onRestoreAssignment(entry.target_element_id, entry.prior);
      if (!succeeded) {
        pushUndoEntry(apertureId, entry);
        return;
      }
      flash(entry.target_element_id);
    } catch {
      // Backend rejected; restore the entry so Undo remains available.
      pushUndoEntry(apertureId, entry);
    }
  }, [apertureId, flash, onRestoreAssignment, popUndoEntry, pushUndoEntry]);

  const capturePickFromElement = useCallback(
    (el: ApertureElement) => {
      if (el.kind !== "glazed") return;
      pickPasteAction(
        { type: "click-element" },
        {
          source_element_id: el.id,
          source_element_kind: el.kind,
          operation: el.operation,
          glazing: el.glazing,
          frames: el.frames,
        },
      );
    },
    [pickPasteAction],
  );

  return {
    pickPasteMode,
    pickedAssignment,
    flashTargetId,
    undoDepth,
    pasteOnto,
    undoLastPaste,
    capturePickFromElement,
    handleEyedropper: () => pickPasteAction({ type: "click-eyedropper" }),
    handlePaintBucket: () => pickPasteAction({ type: "click-paint-bucket" }),
    sendEsc: () => pickPasteAction({ type: "esc" }),
  };
}

function assignmentSnapshot(target: PasteTargetSnapshot): ApertureAssignmentSnapshot {
  return {
    operation: target.operation,
    glazing_id: projectRefId(target.glazing),
    frames: {
      top: projectRefId(target.frames.top),
      right: projectRefId(target.frames.right),
      bottom: projectRefId(target.frames.bottom),
      left: projectRefId(target.frames.left),
    },
    installs: { ...target.installs },
  };
}

function projectRefId(ref: FrameRef | GlazingRef | null): string | null {
  if (ref === null) return null;
  const id = (ref as FrameRef & { id?: unknown }).id;
  if (typeof id === "string") return id;
  throw new Error("Aperture assignment reference is missing its project id.");
}
