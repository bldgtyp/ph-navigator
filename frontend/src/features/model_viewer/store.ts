import { create } from "zustand";
import { DEFAULT_MODEL_VIEWER_THEMES, defaultThemeForLens } from "./lib/themes";
import type {
  ModelViewerErrorKind,
  ModelViewerLens,
  ModelViewerTheme,
  ViewerLoadPhase,
} from "./types";

/**
 * Cross-component viewer state. Phase 1 holds only the active file id
 * (synced from the `?file=` URL param by ModelTab); later phases extend
 * this with lens, theme, selection, and measure state.
 */
type ModelViewerState = {
  activeFileId: string | null;
  lens: ModelViewerLens;
  themesByLens: Record<ModelViewerLens, ModelViewerTheme>;
  hoverId: string | null;
  selectionId: string | null;
  loadPhase: ViewerLoadPhase;
  errorKind: ModelViewerErrorKind | null;
  cameraRequest: { kind: "fit" | "home" | "zoomTo"; targetId?: string; id: number } | null;
  setActiveFileId: (fileId: string | null) => void;
  setLens: (lens: ModelViewerLens) => void;
  setUrlViewState: (lens: ModelViewerLens, theme: ModelViewerTheme) => void;
  setTheme: (lens: ModelViewerLens, theme: ModelViewerTheme) => void;
  setHoverId: (objectId: string | null) => void;
  setSelectionId: (objectId: string | null) => void;
  clearSelection: () => void;
  setLoadState: (phase: ViewerLoadPhase, errorKind?: ModelViewerErrorKind | null) => void;
  requestCamera: (kind: "fit" | "home" | "zoomTo", targetId?: string) => void;
};

export const useModelViewerStore = create<ModelViewerState>()((set) => ({
  activeFileId: null,
  lens: "building",
  themesByLens: DEFAULT_MODEL_VIEWER_THEMES,
  hoverId: null,
  selectionId: null,
  loadPhase: "idle",
  errorKind: null,
  cameraRequest: null,
  setActiveFileId: (fileId) =>
    set({ activeFileId: fileId, hoverId: null, selectionId: null, errorKind: null }),
  setLens: (lens) =>
    set((state) => {
      const defaultTheme = defaultThemeForLens(lens);
      if (state.lens === lens) return state;
      return {
        lens,
        themesByLens: { ...state.themesByLens, [lens]: defaultTheme },
        hoverId: null,
        selectionId: null,
      };
    }),
  setUrlViewState: (lens, theme) =>
    set((state) => {
      const sameLens = state.lens === lens;
      const sameTheme = state.themesByLens[lens] === theme;
      if (sameLens && sameTheme) return state;
      return {
        lens,
        themesByLens: { ...state.themesByLens, [lens]: theme },
        ...(sameLens ? {} : { hoverId: null, selectionId: null }),
      };
    }),
  setTheme: (lens, theme) =>
    set((state) =>
      state.themesByLens[lens] === theme
        ? state
        : { themesByLens: { ...state.themesByLens, [lens]: theme } },
    ),
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
