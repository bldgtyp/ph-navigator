// Ephemeral UI state for the Aperture Builder canvas: selection, hover, and
// stub pick/paste mode hooks that Phase 08 will wire. Selection lives here
// rather than in the document because it is purely a viewing aid — switching
// aperture types or versions clears it. Persisted via Zustand so any
// component on the page (toolbar, overlay, future cards) can subscribe to a
// single source of truth without prop-drilling.

import { create } from "zustand";
import { nextMode, type PickPasteAction } from "../pick-paste-machine";
import type { ApertureElementFrames, ApertureOperation, ApertureSide, GlazingRef } from "../types";

export type ApertureHoveredRegion = {
  elementId: string;
  region: ApertureSide | "glazing";
};

export type AperturePickPasteMode = "idle" | "picking" | "pasting";
export type CanvasZoomUpdate = number | ((current: number) => number);

/** The 6-field assignment payload captured by the Eyedropper. Mirrors
 *  PRD §13 — ``id`` / ``row_span`` / ``column_span`` / ``name`` are not
 *  copied. */
export type PickedAssignment = {
  source_element_id: string;
  operation: ApertureOperation | null;
  glazing: GlazingRef | null;
  frames: ApertureElementFrames;
};

/** One entry in the per-aperture bounded undo stack: snapshot of the
 *  target element's prior 6 fields before a paste. */
export type PasteUndoEntry = {
  target_element_id: string;
  prior: {
    operation: ApertureOperation | null;
    glazing: GlazingRef | null;
    frames: ApertureElementFrames;
  };
};

export const PASTE_UNDO_STACK_LIMIT = 20;

export type ApertureBuilderState = {
  canvasZoom: number;
  hasCanvasZoom: boolean;
  selectionByAperture: Record<string, string[]>;
  hoveredElementId: string | null;
  hoveredRegion: ApertureHoveredRegion | null;
  pickPasteMode: AperturePickPasteMode;
  pickedAssignment: PickedAssignment | null;
  undoStacksByAperture: Record<string, PasteUndoEntry[]>;
  /** Per-aperture set of element ids whose operation-changed warning
   *  banner the user dismissed this session. Cleared on aperture-type
   *  or version switch — purely ephemeral. */
  dismissedOperationWarnings: Record<string, string[]>;

  setCanvasZoom: (next: CanvasZoomUpdate) => void;
  selectSingle: (apertureId: string, elementId: string) => void;
  toggleSelection: (apertureId: string, elementId: string) => void;
  clearSelection: (apertureId: string) => void;
  clearAllSelections: () => void;
  setHoveredElement: (elementId: string | null) => void;
  setHoveredRegion: (value: ApertureHoveredRegion | null) => void;
  dismissOperationWarning: (apertureId: string, elementId: string) => void;
  clearDismissedOperationWarnings: (apertureId: string) => void;

  /** Run an action through the pick/paste state machine. ``pick``
   *  passes the captured 6 fields when selecting a valid source so the
   *  same call atomically advances mode and stashes the payload. */
  pickPasteAction: (action: PickPasteAction, pick?: PickedAssignment | null) => void;
  /** Push one undo entry on the active aperture's stack; trims to
   *  ``PASTE_UNDO_STACK_LIMIT``. */
  pushUndoEntry: (apertureId: string, entry: PasteUndoEntry) => void;
  /** Pop and return the most recent entry, or null if empty. */
  popUndoEntry: (apertureId: string) => PasteUndoEntry | null;
  clearPickPaste: () => void;
  clearUndoStack: (apertureId: string) => void;
  clearAllUndoStacks: () => void;
};

export const useApertureBuilderStore = create<ApertureBuilderState>((set, get) => ({
  canvasZoom: 1,
  hasCanvasZoom: false,
  selectionByAperture: {},
  hoveredElementId: null,
  hoveredRegion: null,
  pickPasteMode: "idle",
  pickedAssignment: null,
  undoStacksByAperture: {},
  dismissedOperationWarnings: {},

  setCanvasZoom: (next) =>
    set((state) => {
      const nextZoom = typeof next === "function" ? next(state.canvasZoom) : next;
      if (state.hasCanvasZoom && state.canvasZoom === nextZoom) return state;
      return { canvasZoom: nextZoom, hasCanvasZoom: true };
    }),

  selectSingle: (apertureId, elementId) =>
    set((state) => {
      const current = state.selectionByAperture[apertureId] ?? [];
      const next = current.length === 1 && current[0] === elementId ? [] : [elementId];
      return {
        selectionByAperture: { ...state.selectionByAperture, [apertureId]: next },
      };
    }),

  toggleSelection: (apertureId, elementId) =>
    set((state) => {
      const current = state.selectionByAperture[apertureId] ?? [];
      const next = current.includes(elementId)
        ? current.filter((id) => id !== elementId)
        : [...current, elementId];
      return {
        selectionByAperture: { ...state.selectionByAperture, [apertureId]: next },
      };
    }),

  clearSelection: (apertureId) =>
    set((state) => {
      if (!state.selectionByAperture[apertureId]?.length) return state;
      return {
        selectionByAperture: { ...state.selectionByAperture, [apertureId]: [] },
      };
    }),

  clearAllSelections: () => set({ selectionByAperture: {} }),

  setHoveredElement: (elementId) => set({ hoveredElementId: elementId }),
  setHoveredRegion: (value) => set({ hoveredRegion: value }),

  dismissOperationWarning: (apertureId, elementId) =>
    set((state) => {
      const current = state.dismissedOperationWarnings[apertureId] ?? [];
      if (current.includes(elementId)) return state;
      return {
        dismissedOperationWarnings: {
          ...state.dismissedOperationWarnings,
          [apertureId]: [...current, elementId],
        },
      };
    }),

  clearDismissedOperationWarnings: (apertureId) =>
    set((state) => {
      if (!state.dismissedOperationWarnings[apertureId]?.length) return state;
      const next = { ...state.dismissedOperationWarnings };
      delete next[apertureId];
      return { dismissedOperationWarnings: next };
    }),

  pickPasteAction: (action, pick) =>
    set((state) => {
      if (state.pickPasteMode === "picking" && action.type === "click-element" && !pick) {
        return state;
      }
      const mode = nextMode(state.pickPasteMode, action);
      // Drop the captured payload when the machine resets to idle.
      let assignment = state.pickedAssignment;
      if (mode === "idle") {
        assignment = null;
      } else if (state.pickPasteMode === "picking" && action.type === "click-element") {
        assignment = pick ?? null;
      }
      if (mode === state.pickPasteMode && assignment === state.pickedAssignment) return state;
      return { pickPasteMode: mode, pickedAssignment: assignment };
    }),

  pushUndoEntry: (apertureId, entry) =>
    set((state) => {
      const current = state.undoStacksByAperture[apertureId] ?? [];
      const next = [...current, entry];
      while (next.length > PASTE_UNDO_STACK_LIMIT) next.shift();
      return {
        undoStacksByAperture: { ...state.undoStacksByAperture, [apertureId]: next },
      };
    }),

  popUndoEntry: (apertureId) => {
    // Read-then-write via get/set rather than mutating a closure inside
    // the set() updater — Zustand may invoke the updater more than once
    // under React 18 concurrent batching, which would lose or duplicate
    // the popped entry against the closure variable.
    const stack = get().undoStacksByAperture[apertureId] ?? [];
    const popped = stack.at(-1) ?? null;
    if (popped === null) return null;
    set((state) => ({
      undoStacksByAperture: {
        ...state.undoStacksByAperture,
        [apertureId]: stack.slice(0, -1),
      },
    }));
    return popped;
  },

  clearPickPaste: () => set({ pickPasteMode: "idle", pickedAssignment: null }),

  clearUndoStack: (apertureId) =>
    set((state) => {
      if (!state.undoStacksByAperture[apertureId]?.length) return state;
      const next = { ...state.undoStacksByAperture };
      delete next[apertureId];
      return { undoStacksByAperture: next };
    }),

  clearAllUndoStacks: () =>
    set({ undoStacksByAperture: {}, pickPasteMode: "idle", pickedAssignment: null }),
}));

// Stable empty array so selectors that fall back to "no selection" don't
// return a fresh `[]` reference on every render and trigger Zustand's
// snapshot loop guard.
const EMPTY_SELECTION: readonly string[] = Object.freeze([]);

export function selectionForAperture(
  state: ApertureBuilderState,
  apertureId: string | null | undefined,
): readonly string[] {
  if (!apertureId) return EMPTY_SELECTION;
  return state.selectionByAperture[apertureId] ?? EMPTY_SELECTION;
}
