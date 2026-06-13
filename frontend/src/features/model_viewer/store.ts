import { create } from "zustand";
import type { ModelViewerErrorKind, ModelViewerLens, ViewerLoadPhase } from "./types";

/**
 * Cross-component viewer state. Phase 1 holds only the active file id
 * (synced from the `?file=` URL param by ModelTab); later phases extend
 * this with lens, theme, selection, and measure state.
 */
type ModelViewerState = {
  activeFileId: string | null;
  lens: ModelViewerLens;
  hoverId: string | null;
  selectionId: string | null;
  loadPhase: ViewerLoadPhase;
  errorKind: ModelViewerErrorKind | null;
  cameraRequest: { kind: "fit" | "home" | "zoomTo"; targetId?: string; id: number } | null;
  setActiveFileId: (fileId: string | null) => void;
  setHoverId: (objectId: string | null) => void;
  setSelectionId: (objectId: string | null) => void;
  clearSelection: () => void;
  setLoadState: (phase: ViewerLoadPhase, errorKind?: ModelViewerErrorKind | null) => void;
  requestCamera: (kind: "fit" | "home" | "zoomTo", targetId?: string) => void;
};

export const useModelViewerStore = create<ModelViewerState>()((set) => ({
  activeFileId: null,
  lens: "building",
  hoverId: null,
  selectionId: null,
  loadPhase: "idle",
  errorKind: null,
  cameraRequest: null,
  setActiveFileId: (fileId) =>
    set({ activeFileId: fileId, hoverId: null, selectionId: null, errorKind: null }),
  setHoverId: (objectId) =>
    set((state) => (state.hoverId === objectId ? state : { hoverId: objectId })),
  setSelectionId: (objectId) =>
    set((state) => (state.selectionId === objectId ? state : { selectionId: objectId })),
  clearSelection: () =>
    set((state) =>
      state.hoverId === null && state.selectionId === null
        ? state
        : { hoverId: null, selectionId: null },
    ),
  setLoadState: (phase, errorKind = null) =>
    set((state) =>
      state.loadPhase === phase && state.errorKind === errorKind
        ? state
        : { loadPhase: phase, errorKind },
    ),
  requestCamera: (kind, targetId) =>
    set((state) => ({
      cameraRequest: { kind, targetId, id: (state.cameraRequest?.id ?? 0) + 1 },
    })),
}));
