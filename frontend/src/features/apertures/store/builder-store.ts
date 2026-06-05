// Ephemeral UI state for the Aperture Builder canvas: selection, hover, and
// stub pick/paste mode hooks that Phase 08 will wire. Selection lives here
// rather than in the document because it is purely a viewing aid — switching
// aperture types or versions clears it. Persisted via Zustand so any
// component on the page (toolbar, overlay, future cards) can subscribe to a
// single source of truth without prop-drilling.

import { create } from "zustand";
import type { ApertureSide } from "../types";

export type ApertureHoveredRegion = {
  elementId: string;
  region: ApertureSide | "glazing";
};

export type AperturePickPasteMode = "idle" | "picking" | "picked" | "pasting";

export type ApertureBuilderState = {
  selectionByAperture: Record<string, string[]>;
  hoveredElementId: string | null;
  hoveredRegion: ApertureHoveredRegion | null;
  pickPasteMode: AperturePickPasteMode;

  selectSingle: (apertureId: string, elementId: string) => void;
  extendSelection: (apertureId: string, elementId: string) => void;
  toggleSelection: (apertureId: string, elementId: string) => void;
  clearSelection: (apertureId: string) => void;
  clearAllSelections: () => void;
  setHoveredElement: (elementId: string | null) => void;
  setHoveredRegion: (value: ApertureHoveredRegion | null) => void;
};

export const useApertureBuilderStore = create<ApertureBuilderState>((set) => ({
  selectionByAperture: {},
  hoveredElementId: null,
  hoveredRegion: null,
  pickPasteMode: "idle",

  selectSingle: (apertureId, elementId) =>
    set((state) => {
      const current = state.selectionByAperture[apertureId] ?? [];
      const next = current.length === 1 && current[0] === elementId ? [] : [elementId];
      return {
        selectionByAperture: { ...state.selectionByAperture, [apertureId]: next },
      };
    }),

  extendSelection: (apertureId, elementId) =>
    set((state) => {
      const current = state.selectionByAperture[apertureId] ?? [];
      if (current.includes(elementId)) return state;
      return {
        selectionByAperture: {
          ...state.selectionByAperture,
          [apertureId]: [...current, elementId],
        },
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
