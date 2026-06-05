// Centralises the Phase 08 paste / undo handler chain so the canvas
// container doesn't bloat past the 500-line cap. The state machine,
// undo stack, and dispatch all live in the Zustand store + the route
// layer's ``onPasteAssignment`` callback; this hook is the glue that
// reads the source assignment, dispatches the wire command, records
// the prior state for undo, and fires the 600 ms pulse on success.

import { useCallback, useState } from "react";
import { useApertureBuilderStore, type PickedAssignment } from "../store/builder-store";
import type {
  ApertureElement,
  ApertureElementFrames,
  ApertureOperation,
  GlazingRef,
} from "../types";

export type PasteTargetSnapshot = {
  id: string;
  operation: ApertureOperation | null;
  glazing: GlazingRef | null;
  frames: ApertureElementFrames;
};

const PASTE_PULSE_MS = 600;

export type UsePickPasteHandlersArgs = {
  apertureId: string;
  onPasteAssignment?: (
    sourceElementId: string,
    targetElementIds: string[],
    payload: PickedAssignment,
  ) => Promise<void> | void;
};

export function usePickPasteHandlers({ apertureId, onPasteAssignment }: UsePickPasteHandlersArgs) {
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
      if (target.id === pickedAssignment.source_element_id) return;
      const prior = {
        operation: target.operation,
        glazing: target.glazing,
        frames: target.frames,
      };
      try {
        await onPasteAssignment?.(
          pickedAssignment.source_element_id,
          [target.id],
          pickedAssignment,
        );
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
    const revertPayload: PickedAssignment = {
      source_element_id: entry.target_element_id,
      operation: entry.prior.operation,
      glazing: entry.prior.glazing,
      frames: entry.prior.frames,
    };
    await onPasteAssignment?.(entry.target_element_id, [entry.target_element_id], revertPayload);
    flash(entry.target_element_id);
  }, [apertureId, flash, onPasteAssignment, popUndoEntry]);

  const capturePickFromElement = useCallback(
    (el: ApertureElement) => {
      pickPasteAction(
        { type: "click-element" },
        {
          source_element_id: el.id,
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
