import { create } from "zustand";
import { DEFAULT_MODEL_VIEWER_THEMES, defaultThemeForLens } from "./lib/themeState";
import type {
  LegendFilter,
  ModelViewerErrorKind,
  ModelViewerLens,
  ModelViewerMeasureLine,
  ModelViewerMeasurePoint,
  ModelViewerTheme,
  ViewerLoadPhase,
} from "./types";
import { distanceBetweenMeasurePoints } from "./lib/measureDistance";

/** Cross-component viewer state shared by controls, overlays, and the 3D scene. */
type ModelViewerState = {
  activeFileId: string | null;
  lens: ModelViewerLens;
  themesByLens: Record<ModelViewerLens, ModelViewerTheme>;
  hoverId: string | null;
  selectionId: string | null;
  /** Active legend filter (NEW-VIEW-2), or null when no row is isolated. Cleared
   *  on every lens/theme/file change so a filter never outlives its context. */
  legendFilter: LegendFilter | null;
  measureActive: boolean;
  measureSnap: ModelViewerMeasurePoint | null;
  measurePendingPoint: ModelViewerMeasurePoint | null;
  measureLines: ModelViewerMeasureLine[];
  loadPhase: ViewerLoadPhase;
  errorKind: ModelViewerErrorKind | null;
  cameraRequest: { kind: "fit" | "home" | "zoomTo"; targetId?: string; id: number } | null;
  setActiveFileId: (fileId: string | null) => void;
  setLens: (lens: ModelViewerLens) => void;
  setUrlViewState: (lens: ModelViewerLens, theme: ModelViewerTheme) => void;
  setTheme: (lens: ModelViewerLens, theme: ModelViewerTheme) => void;
  /** Toggle a legend filter key. Plain (`additive` false): single-select — isolate
   *  `key`, or clear if it is already the sole key. Shift (`additive` true): add or
   *  remove `key` from the union, clearing the filter when the set empties. */
  toggleLegendFilterKey: (theme: ModelViewerTheme, key: string, additive?: boolean) => void;
  clearLegendFilter: () => void;
  setHoverId: (objectId: string | null) => void;
  setSelectionId: (objectId: string | null) => void;
  clearSelection: () => void;
  setMeasureActive: (active: boolean) => void;
  toggleMeasure: () => void;
  setMeasureSnap: (point: ModelViewerMeasurePoint | null) => void;
  commitMeasurePoint: (point: ModelViewerMeasurePoint) => ModelViewerMeasureLine | null;
  clearMeasureLines: () => void;
  setLoadState: (phase: ViewerLoadPhase, errorKind?: ModelViewerErrorKind | null) => void;
  requestCamera: (kind: "fit" | "home" | "zoomTo", targetId?: string) => void;
};

export const useModelViewerStore = create<ModelViewerState>()((set) => ({
  activeFileId: null,
  lens: "building",
  themesByLens: DEFAULT_MODEL_VIEWER_THEMES,
  hoverId: null,
  selectionId: null,
  legendFilter: null,
  measureActive: false,
  measureSnap: null,
  measurePendingPoint: null,
  measureLines: [],
  loadPhase: "idle",
  errorKind: null,
  cameraRequest: null,
  setActiveFileId: (fileId) =>
    set({
      activeFileId: fileId,
      hoverId: null,
      selectionId: null,
      legendFilter: null,
      errorKind: null,
      ...inactiveMeasureState(),
    }),
  setLens: (lens) =>
    set((state) => {
      const defaultTheme = defaultThemeForLens(lens);
      if (state.lens === lens) return state;
      return {
        lens,
        themesByLens: { ...state.themesByLens, [lens]: defaultTheme },
        hoverId: null,
        selectionId: null,
        legendFilter: null,
        ...inactiveMeasureState(),
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
        legendFilter: null,
        ...(sameLens ? {} : { hoverId: null, selectionId: null, ...inactiveMeasureState() }),
      };
    }),
  setTheme: (lens, theme) =>
    set((state) =>
      state.themesByLens[lens] === theme
        ? state
        : { themesByLens: { ...state.themesByLens, [lens]: theme }, legendFilter: null },
    ),
  toggleLegendFilterKey: (theme, key, additive = false) =>
    set((state) => {
      const current = state.legendFilter;
      const activeKeys = current?.theme === theme ? current.keys : null;
      if (additive) {
        // Shift-click: flip membership in the union; an empty set is no filter.
        const keys = new Set(activeKeys);
        if (keys.has(key)) keys.delete(key);
        else keys.add(key);
        return { legendFilter: keys.size === 0 ? null : { theme, keys } };
      }
      const isSoleActiveKey = activeKeys !== null && activeKeys.size === 1 && activeKeys.has(key);
      return { legendFilter: isSoleActiveKey ? null : { theme, keys: new Set([key]) } };
    }),
  clearLegendFilter: () =>
    set((state) => (state.legendFilter === null ? state : { legendFilter: null })),
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
  setMeasureActive: (active) =>
    set((state) => {
      if (active) {
        return state.measureActive ? state : activeMeasureState();
      }
      return state.measureActive ||
        state.measureSnap ||
        state.measurePendingPoint ||
        state.measureLines.length > 0
        ? inactiveMeasureState()
        : state;
    }),
  toggleMeasure: () =>
    set((state) => (state.measureActive ? inactiveMeasureState() : activeMeasureState())),
  setMeasureSnap: (point) =>
    set((state) => (sameMeasurePoint(state.measureSnap, point) ? state : { measureSnap: point })),
  commitMeasurePoint: (point) => {
    let committed: ModelViewerMeasureLine | null = null;
    set((state) => {
      if (!state.measureActive) return state;
      if (!state.measurePendingPoint) {
        return { measurePendingPoint: point, measureSnap: point };
      }
      if (state.measurePendingPoint.id === point.id) {
        return { measureSnap: point };
      }
      committed = {
        id: `measure:${state.measureLines.length + 1}:${state.measurePendingPoint.id}:${point.id}`,
        start: state.measurePendingPoint,
        end: point,
        distanceM: distanceBetweenMeasurePoints(state.measurePendingPoint, point),
      };
      return {
        measureLines: [...state.measureLines, committed],
        measurePendingPoint: null,
        measureSnap: point,
      };
    });
    return committed;
  },
  clearMeasureLines: () =>
    set((state) =>
      state.measureSnap || state.measurePendingPoint || state.measureLines.length > 0
        ? { measureSnap: null, measurePendingPoint: null, measureLines: [] }
        : state,
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

function inactiveMeasureState() {
  return {
    measureActive: false,
    measureSnap: null,
    measurePendingPoint: null,
    measureLines: [],
  };
}

function activeMeasureState() {
  return {
    measureActive: true,
    measureSnap: null,
    measurePendingPoint: null,
    measureLines: [],
    hoverId: null,
    selectionId: null,
  };
}

function sameMeasurePoint(
  current: ModelViewerMeasurePoint | null,
  next: ModelViewerMeasurePoint | null,
): boolean {
  return current?.id === next?.id;
}
